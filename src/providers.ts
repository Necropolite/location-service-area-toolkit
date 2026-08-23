import { assertCoordinates, calculateDistance } from './distance.js';
import { DistanceProviderError } from './errors.js';
import { evaluateDistanceAgainstRadius } from './service-area.js';
import type { Coordinates, DistanceUnit, GeocodeResult, RadiusEvaluation } from './types.js';

export type DistanceMeasurement = {
  distance: number;
  unit: DistanceUnit;
  method: string;
  durationSeconds?: number;
};

export type DistanceProvider = {
  readonly id: string;
  measure(start: Coordinates, end: Coordinates, unit: DistanceUnit): Promise<DistanceMeasurement>;
};

export type Geocoder = {
  readonly id: string;
  geocode(address: string): Promise<GeocodeResult | undefined>;
};

export type ProviderRadiusEvaluation = RadiusEvaluation & {
  providerId: string;
  method: string;
  durationSeconds?: number;
};

export function createHaversineDistanceProvider(id = 'haversine'): DistanceProvider {
  const providerId = id.trim();
  if (!providerId) {
    throw new DistanceProviderError('INVALID_PROVIDER_ID', id, 'distance provider id is required');
  }

  return {
    id: providerId,
    async measure(start, end, unit) {
      return {
        distance: calculateDistance(start, end, unit),
        unit,
        method: 'haversine',
      };
    },
  };
}

export function assertDistanceMeasurement(
  measurement: DistanceMeasurement,
  requestedUnit: DistanceUnit,
  providerId: string,
) {
  if (!Number.isFinite(measurement.distance) || measurement.distance < 0) {
    throw new DistanceProviderError(
      'INVALID_DISTANCE',
      providerId,
      `distance provider "${providerId}" returned an invalid distance`,
    );
  }
  if (measurement.unit !== requestedUnit) {
    throw new DistanceProviderError(
      'UNIT_MISMATCH',
      providerId,
      `distance provider "${providerId}" returned ${measurement.unit}; expected ${requestedUnit}`,
    );
  }
  if (!measurement.method.trim()) {
    throw new DistanceProviderError(
      'INVALID_METHOD',
      providerId,
      `distance provider "${providerId}" returned an empty method`,
    );
  }
  if (measurement.durationSeconds !== undefined &&
      (!Number.isFinite(measurement.durationSeconds) || measurement.durationSeconds < 0)) {
    throw new DistanceProviderError(
      'INVALID_DURATION',
      providerId,
      `distance provider "${providerId}" returned an invalid duration`,
    );
  }
}

export async function evaluateRadiusWithProvider(
  origin: Coordinates,
  destination: Coordinates,
  radius: number,
  unit: DistanceUnit,
  provider: DistanceProvider,
): Promise<ProviderRadiusEvaluation> {
  assertCoordinates(origin, 'origin');
  assertCoordinates(destination, 'destination');
  const providerId = provider.id.trim();
  if (!providerId) {
    throw new DistanceProviderError('INVALID_PROVIDER_ID', provider.id, 'distance provider id is required');
  }

  const measurement = await provider.measure(origin, destination, unit);
  assertDistanceMeasurement(measurement, unit, providerId);
  return {
    ...evaluateDistanceAgainstRadius(measurement.distance, radius, unit),
    providerId,
    method: measurement.method,
    ...(measurement.durationSeconds === undefined ? {} : { durationSeconds: measurement.durationSeconds }),
  };
}
