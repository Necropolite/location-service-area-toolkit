import { assertCoordinates } from './distance.js';
import type { Coordinates } from './types.js';

const boundaryTolerance = 1e-10;

function pointsEqual(first: Coordinates, second: Coordinates) {
  return first.latitude === second.latitude && first.longitude === second.longitude;
}

function normalizeVertices(vertices: Coordinates[]) {
  if (vertices.length > 1 && pointsEqual(vertices[0], vertices[vertices.length - 1])) {
    return vertices.slice(0, -1);
  }
  return vertices;
}

function isPointOnSegment(point: Coordinates, start: Coordinates, end: Coordinates) {
  const cross = (point.longitude - start.longitude) * (end.latitude - start.latitude) -
    (point.latitude - start.latitude) * (end.longitude - start.longitude);
  if (Math.abs(cross) > boundaryTolerance) return false;

  const longitudeWithin = point.longitude >= Math.min(start.longitude, end.longitude) - boundaryTolerance &&
    point.longitude <= Math.max(start.longitude, end.longitude) + boundaryTolerance;
  const latitudeWithin = point.latitude >= Math.min(start.latitude, end.latitude) - boundaryTolerance &&
    point.latitude <= Math.max(start.latitude, end.latitude) + boundaryTolerance;
  return longitudeWithin && latitudeWithin;
}

export function isPointInPolygon(point: Coordinates, polygon: Coordinates[]) {
  assertCoordinates(point, 'point');
  const vertices = normalizeVertices(polygon);
  if (vertices.length < 3) {
    throw new Error('polygon must contain at least three vertices');
  }
  vertices.forEach((vertex, index) => assertCoordinates(vertex, `polygon[${index}]`));

  let inside = false;
  for (let current = 0, previous = vertices.length - 1; current < vertices.length; previous = current++) {
    const start = vertices[previous];
    const end = vertices[current];
    if (isPointOnSegment(point, start, end)) return true;

    const crossesLatitude = (end.latitude > point.latitude) !== (start.latitude > point.latitude);
    if (crossesLatitude) {
      const intersectionLongitude =
        ((start.longitude - end.longitude) * (point.latitude - end.latitude)) /
          (start.latitude - end.latitude) + end.longitude;
      if (point.longitude < intersectionLongitude) inside = !inside;
    }
  }
  return inside;
}
