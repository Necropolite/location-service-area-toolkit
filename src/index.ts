export { assertCoordinates, calculateDistance, calculateDistanceKilometers, calculateDistanceMiles } from './distance.js';
export { assertServiceAreaConfiguration, validateServiceAreaConfiguration } from './configuration.js';
export {
  DistanceProviderError,
  ServiceAreaConfigurationError,
  type DistanceProviderErrorCode,
  type ServiceAreaValidationCode,
  type ServiceAreaValidationIssue,
} from './errors.js';
export { createNominatimGeocoder, geocodeAddress, type NominatimGeocoderOptions } from './nominatim.js';
export { isPointInPolygon } from './polygon.js';
export {
  assertDistanceMeasurement,
  createHaversineDistanceProvider,
  evaluateRadiusWithProvider,
  type DistanceMeasurement,
  type DistanceProvider,
  type Geocoder,
  type ProviderRadiusEvaluation,
} from './providers.js';
export { evaluateDistanceAgainstRadius, evaluateRadius } from './service-area.js';
export { evaluateServiceArea, evaluateServiceAreaWithProvider } from './territory.js';
export type {
  Coordinates,
  DistanceUnit,
  GeocodeResult,
  PolygonServiceArea,
  RadiusEvaluation,
  RadiusServiceArea,
  ServiceArea,
  ServiceAreaCheck,
  ServiceAreaConfiguration,
  ServiceAreaEffect,
  ServiceAreaEvaluation,
  ServiceAreaMatch,
  ServiceAreaOrigin,
  ServiceAreaStatus,
} from './types.js';
