import { calculateDistance } from './distance.js';
import type { Coordinates, DistanceUnit, RadiusEvaluation } from './types.js';

function assertRadius(radius: number) {
  if (!Number.isFinite(radius) || radius < 0) {
    throw new Error('radius must be a non-negative finite number');
  }
}

export function evaluateDistanceAgainstRadius(
  distance: number,
  radius: number,
  unit: DistanceUnit = 'miles',
): RadiusEvaluation {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new Error('distance must be a non-negative finite number');
  }

  assertRadius(radius);

  return {
    distance,
    radius,
    unit,
    isInside: distance <= radius,
  };
}

export function evaluateRadius(
  origin: Coordinates,
  destination: Coordinates,
  radius: number,
  unit: DistanceUnit = 'miles',
): RadiusEvaluation {
  assertRadius(radius);
  const distance = calculateDistance(origin, destination, unit);

  return {
    distance,
    radius,
    unit,
    isInside: distance <= radius,
  };
}
