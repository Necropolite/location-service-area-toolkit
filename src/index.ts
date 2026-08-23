export {
  assertCoordinates,
  calculateDistance,
  calculateDistanceKilometers,
  calculateDistanceMiles,
} from './distance.js';

export {
  geocodeAddress,
  type GeocodeResult,
  type NominatimGeocoderOptions,
} from './nominatim.js';

export {
  evaluateDistanceAgainstRadius,
  evaluateRadius,
} from './service-area.js';

export type {
  Coordinates,
  DistanceUnit,
  RadiusEvaluation,
} from './types.js';
