import type { Coordinates, DistanceUnit } from './types.js';

const earthRadiusByUnit: Record<DistanceUnit, number> = {
  miles: 3958.8,
  kilometers: 6371.0088,
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function assertCoordinates(coordinates: Coordinates, label = 'coordinates') {
  const { latitude, longitude } = coordinates;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`${label}.latitude must be between -90 and 90`);
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`${label}.longitude must be between -180 and 180`);
  }
}

export function calculateDistance(
  start: Coordinates,
  end: Coordinates,
  unit: DistanceUnit = 'miles',
) {
  assertCoordinates(start, 'start');
  assertCoordinates(end, 'end');

  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusByUnit[unit] * c;
}

export function calculateDistanceMiles(start: Coordinates, end: Coordinates) {
  return calculateDistance(start, end, 'miles');
}

export function calculateDistanceKilometers(start: Coordinates, end: Coordinates) {
  return calculateDistance(start, end, 'kilometers');
}
