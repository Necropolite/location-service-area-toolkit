import type {
  Coordinates,
  DistanceUnit,
  ServiceAreaConfiguration,
  ServiceAreaEffect,
} from './types.js';
import {
  ServiceAreaConfigurationError,
  type ServiceAreaValidationIssue,
} from './errors.js';

function coordinateIssues(coordinates: Coordinates, path: string): ServiceAreaValidationIssue[] {
  const issues: ServiceAreaValidationIssue[] = [];
  if (!coordinates || !Number.isFinite(coordinates.latitude) || coordinates.latitude < -90 || coordinates.latitude > 90) {
    issues.push({ code: 'INVALID_COORDINATES', path: `${path}.latitude`, message: 'must be between -90 and 90' });
  }
  if (!coordinates || !Number.isFinite(coordinates.longitude) || coordinates.longitude < -180 || coordinates.longitude > 180) {
    issues.push({ code: 'INVALID_COORDINATES', path: `${path}.longitude`, message: 'must be between -180 and 180' });
  }
  return issues;
}

function validId(value: string) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validEffect(value: ServiceAreaEffect | undefined): value is ServiceAreaEffect | undefined {
  return value === undefined || value === 'include' || value === 'exclude';
}

function validUnit(value: DistanceUnit): value is DistanceUnit {
  return value === 'miles' || value === 'kilometers';
}

export function validateServiceAreaConfiguration(configuration: ServiceAreaConfiguration) {
  const issues: ServiceAreaValidationIssue[] = [];
  if (!configuration || !Array.isArray(configuration.origins)) {
    issues.push({ code: 'MISSING_ORIGINS', path: 'origins', message: 'must be an array' });
  }
  if (!configuration || !Array.isArray(configuration.areas)) {
    issues.push({ code: 'MISSING_AREAS', path: 'areas', message: 'must be an array' });
  }
  if (issues.length) return issues;

  const originIds = new Set<string>();
  configuration.origins.forEach((origin, index) => {
    const path = `origins[${index}]`;
    if (!validId(origin.id)) {
      issues.push({ code: 'INVALID_ID', path: `${path}.id`, message: 'must be a non-empty string' });
    } else if (originIds.has(origin.id)) {
      issues.push({ code: 'DUPLICATE_ID', path: `${path}.id`, message: `duplicates origin id "${origin.id}"` });
    } else {
      originIds.add(origin.id);
    }
    issues.push(...coordinateIssues(origin.coordinates, `${path}.coordinates`));
  });

  const areaIds = new Set<string>();
  configuration.areas.forEach((area, index) => {
    const path = `areas[${index}]`;
    if (!validId(area.id)) {
      issues.push({ code: 'INVALID_ID', path: `${path}.id`, message: 'must be a non-empty string' });
    } else if (areaIds.has(area.id)) {
      issues.push({ code: 'DUPLICATE_ID', path: `${path}.id`, message: `duplicates area id "${area.id}"` });
    } else {
      areaIds.add(area.id);
    }
    if (!validEffect(area.effect)) {
      issues.push({ code: 'INVALID_EFFECT', path: `${path}.effect`, message: 'must be "include" or "exclude"' });
    }

    if (area.type === 'radius') {
      if (!originIds.has(area.originId)) {
        issues.push({ code: 'UNKNOWN_ORIGIN', path: `${path}.originId`, message: `references unknown origin "${area.originId}"` });
      }
      if (!Number.isFinite(area.radius) || area.radius < 0) {
        issues.push({ code: 'INVALID_RADIUS', path: `${path}.radius`, message: 'must be a non-negative finite number' });
      }
      if (!validUnit(area.unit)) {
        issues.push({ code: 'INVALID_UNIT', path: `${path}.unit`, message: 'must be "miles" or "kilometers"' });
      }
      return;
    }

    if (area.type === 'polygon') {
      if (!Array.isArray(area.vertices)) {
        issues.push({ code: 'INVALID_POLYGON', path: `${path}.vertices`, message: 'must be an array' });
        return;
      }
      area.vertices.forEach((vertex, vertexIndex) => {
        issues.push(...coordinateIssues(vertex, `${path}.vertices[${vertexIndex}]`));
      });
      const uniqueVertices = new Set(area.vertices.map(vertex => `${vertex.latitude}:${vertex.longitude}`));
      if (uniqueVertices.size < 3) {
        issues.push({ code: 'INVALID_POLYGON', path: `${path}.vertices`, message: 'must contain at least three unique vertices' });
      }
      return;
    }

    issues.push({ code: 'INVALID_AREA_TYPE', path: `${path}.type`, message: 'must be "radius" or "polygon"' });
  });
  return issues;
}

export function assertServiceAreaConfiguration(configuration: ServiceAreaConfiguration) {
  const issues = validateServiceAreaConfiguration(configuration);
  if (issues.length) throw new ServiceAreaConfigurationError(issues);
}
