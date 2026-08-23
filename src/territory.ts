import { assertCoordinates, calculateDistance } from './distance.js';
import { assertServiceAreaConfiguration } from './configuration.js';
import { DistanceProviderError } from './errors.js';
import { isPointInPolygon } from './polygon.js';
import { assertDistanceMeasurement, type DistanceMeasurement, type DistanceProvider } from './providers.js';
import type {
  Coordinates,
  RadiusServiceArea,
  ServiceAreaCheck,
  ServiceAreaConfiguration,
  ServiceAreaEffect,
  ServiceAreaEvaluation,
  ServiceAreaMatch,
  ServiceAreaOrigin,
} from './types.js';

function effectOf(effect?: ServiceAreaEffect): ServiceAreaEffect {
  return effect ?? 'include';
}

function radiusCheck(
  area: RadiusServiceArea,
  origin: ServiceAreaOrigin,
  measurement: DistanceMeasurement,
  providerId: string,
): ServiceAreaCheck {
  return {
    areaId: area.id,
    ...(area.name ? { areaName: area.name } : {}),
    type: 'radius',
    effect: effectOf(area.effect),
    method: measurement.method,
    originId: origin.id,
    ...(origin.name ? { originName: origin.name } : {}),
    providerId,
    distance: measurement.distance,
    radius: area.radius,
    unit: area.unit,
    remainingDistance: area.radius - measurement.distance,
    ...(measurement.durationSeconds === undefined ? {} : { durationSeconds: measurement.durationSeconds }),
    isMatch: measurement.distance <= area.radius,
  };
}

function finalize(destination: Coordinates, checks: ServiceAreaCheck[]): ServiceAreaEvaluation {
  const matches: ServiceAreaMatch[] = checks
    .filter(check => check.isMatch)
    .map(({ isMatch: _isMatch, ...match }) => match);
  const exclusion = matches.find(match => match.effect === 'exclude');
  const inclusion = matches.find(match => match.effect === 'include');
  const decidingMatch = exclusion ?? inclusion;
  const status = exclusion ? 'excluded' : inclusion ? 'inside' : 'outside';
  return {
    destination: { ...destination },
    isInside: status === 'inside',
    status,
    checks,
    matches,
    ...(decidingMatch ? { decidingMatch } : {}),
  };
}

export function evaluateServiceArea(
  configuration: ServiceAreaConfiguration,
  destination: Coordinates,
): ServiceAreaEvaluation {
  assertServiceAreaConfiguration(configuration);
  assertCoordinates(destination, 'destination');
  const origins = new Map(configuration.origins.map(origin => [origin.id, origin]));
  const checks: ServiceAreaCheck[] = [];

  for (const area of configuration.areas) {
    if (area.type === 'polygon') {
      checks.push({
        areaId: area.id,
        ...(area.name ? { areaName: area.name } : {}),
        type: 'polygon',
        effect: effectOf(area.effect),
        method: 'polygon-ray-casting',
        isMatch: isPointInPolygon(destination, area.vertices),
      });
      continue;
    }

    const origin = origins.get(area.originId)!;
    const measurement = {
      distance: calculateDistance(origin.coordinates, destination, area.unit),
      unit: area.unit,
      method: 'haversine',
    };
    checks.push(radiusCheck(area, origin, measurement, 'haversine'));
  }
  return finalize(destination, checks);
}

export async function evaluateServiceAreaWithProvider(
  configuration: ServiceAreaConfiguration,
  destination: Coordinates,
  provider: DistanceProvider,
): Promise<ServiceAreaEvaluation> {
  assertServiceAreaConfiguration(configuration);
  assertCoordinates(destination, 'destination');
  const providerId = provider.id.trim();
  if (!providerId) {
    throw new DistanceProviderError('INVALID_PROVIDER_ID', provider.id, 'distance provider id is required');
  }
  const origins = new Map(configuration.origins.map(origin => [origin.id, origin]));
  const measurements = new Map<string, DistanceMeasurement>();
  const checks: ServiceAreaCheck[] = [];

  for (const area of configuration.areas) {
    if (area.type === 'polygon') {
      checks.push({
        areaId: area.id,
        ...(area.name ? { areaName: area.name } : {}),
        type: 'polygon',
        effect: effectOf(area.effect),
        method: 'polygon-ray-casting',
        isMatch: isPointInPolygon(destination, area.vertices),
      });
      continue;
    }

    const origin = origins.get(area.originId)!;
    const cacheKey = JSON.stringify([area.originId, area.unit]);
    let measurement = measurements.get(cacheKey);
    if (!measurement) {
      measurement = await provider.measure(origin.coordinates, destination, area.unit);
      assertDistanceMeasurement(measurement, area.unit, providerId);
      measurements.set(cacheKey, measurement);
    }
    checks.push(radiusCheck(area, origin, measurement, providerId));
  }
  return finalize(destination, checks);
}
