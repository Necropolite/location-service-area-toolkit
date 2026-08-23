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
npm run deploy:dry
```

The geocoder tests do not make real Nominatim requests. Provider behavior is tested with injected `fetch` implementations.

## Public service-area checker

The repository now includes a browser-based service-area checker in `demo/`. A business can configure its base address and radius, then check whether a customer address is inside that boundary. The result clearly identifies straight-line distance rather than driving distance.

The checker uses the same exported engine as application consumers. Address searches are explicit user submissions, not autocomplete. Results are cached in the browser for 30 days, uncached requests are spaced to respect the public provider limit, and OpenStreetMap attribution is displayed. Production or higher-volume consumers should configure a commercial or self-hosted geocoder rather than depend on the public Nominatim service.

Build and deploy the static Cloudflare Worker with:

```powershell
npm run deploy:dry
npm run deploy
```

The deployed tool is a proof of concept for booking forms, delivery zones, dispatch areas, and lead qualification. It does not calculate road routes or drive time.

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

demo/
  index.html         public service-area checker
  app.ts             browser integration using the reusable engine
  styles.css         responsive presentation

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

**V1 engine independently verified complete on August 23, 2026.** Standalone validation passed all 9 tests, the TypeScript production build completed successfully, and `npm install` reported 0 vulnerabilities. The same behavior had already been integration-tested inside LocksmithOS with all 33 repository tests and the full Next.js production build passing.

## V1 non-goals

Do not add these until a real consumer requires them:

- drive-time or route calculation;
- polygon geofencing;
- reverse-geocoded address formatting;
- route or drive-time map UI;
- shared server-side persistence or caching;
- automatic retries;
- provider API-key management;
- business-specific service-area policy.
