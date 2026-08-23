# Location Service Area Toolkit

Reusable TypeScript building blocks for geographic distance, radius/service-area evaluation, and Nominatim forward geocoding.

This repository is the canonical source for the generic location components originally extracted from `Necropolite/LocksmithOS`. LocksmithOS is one consumer of the toolkit, not the definition of it.

## Scope

V1 contains three reusable pieces:

1. validated coordinate distance using the Haversine formula;
2. configurable radius/service-area evaluation;
3. explicit-config Nominatim forward geocoding.

The package deliberately does not contain application-specific base locations, service radii, pricing, jobs, technicians, UI, persistence, environment-variable conventions, or map components.

## Development

```powershell
npm install
npm test
npm run build
```

The geocoder tests do not make real Nominatim requests. Provider behavior is tested with injected `fetch` implementations.

## Public API

```ts
import {
  calculateDistance,
  calculateDistanceMiles,
  calculateDistanceKilometers,
  evaluateRadius,
  evaluateDistanceAgainstRadius,
  geocodeAddress,
  type Coordinates,
  type DistanceUnit,
} from './src/index.ts';
```

After `npm run build`, the package entry point is `dist/index.js` with declarations in `dist/index.d.ts`.

## Distance

```ts
const miles = calculateDistanceMiles(
  { latitude: 34.0, longitude: -83.0 },
  { latitude: 34.1, longitude: -83.0 },
);
```

Supported units are `miles` and `kilometers`.

Coordinates are validated before calculation:

- latitude must be between -90 and 90;
- longitude must be between -180 and 180.

## Radius and service-area evaluation

Evaluate coordinates directly:

```ts
const result = evaluateRadius(origin, destination, 25, 'miles');
```

Or evaluate an already-known distance:

```ts
const result = evaluateDistanceAgainstRadius(18.4, 25, 'miles');
```

The boundary is inclusive. A distance exactly equal to the configured radius is considered inside.

The same primitive can represent a field-service territory, delivery zone, pickup radius, dispatch area, or another distance-based policy without changing the engine.

## Nominatim geocoding

The geocoder accepts provider configuration explicitly rather than reading application state:

```ts
const result = await geocodeAddress('Lakemont, GA', {
  countryCodes: ['us'],
  language: 'en',
  userAgent: 'ExampleApp/1.0',
});
```

Options include:

- custom API base URL;
- country-code filters;
- language;
- timeout;
- user-agent identification;
- injected `fetch` for testing.

The geocoder returns `undefined` when no result is found and throws for empty input, invalid provider URLs, invalid returned coordinates, or unsuccessful provider responses.

## Repository layout

```text
src/
  index.ts          public API
  types.ts          coordinate and radius types
  distance.ts       validated Haversine distance
  service-area.ts   radius/service-area evaluation
  nominatim.ts      configurable forward geocoder

tests/
  location.test.ts
```

## Tests

The standalone suite covers:

- zero distance;
- miles and kilometers;
- a non-locksmith delivery-zone example;
- inclusive radius boundaries;
- invalid coordinates, radius, and distance inputs;
- Nominatim request construction;
- country/language/provider configuration;
- no-result behavior;
- invalid provider configuration without network access;
- provider failure handling.

## Consumer boundary

Applications should keep their own policy outside this package. LocksmithOS, for example, retains:

- its business base address;
- its business base coordinates;
- its service radius;
- pricing decisions;
- request/job orchestration;
- map UI and GPS interaction;
- business-specific provider identification.

Those application concerns call the generic functions exported here.

## Status

**V1 extracted on August 23, 2026.** The source behavior was verified inside LocksmithOS with 9 location tests passing, 33 total repository tests passing, and the full Next.js production build succeeding, including linting and TypeScript checks.

The standalone repository still needs its own fresh `npm install`, `npm test`, and `npm run build` before the extraction itself is marked independently verified.

## V1 non-goals

Do not add these until a real consumer requires them:

- drive-time or route calculation;
- polygon geofencing;
- reverse-geocoded address formatting;
- map UI components;
- persistence or caching;
- automatic retries;
- provider API-key management;
- business-specific service-area policy.
