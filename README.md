# Location Service Area Toolkit

Reusable TypeScript building blocks for geocoding, geographic distance, and explainable service-area decisions.

This repository is the canonical source for the generic location components originally extracted from `Necropolite/LocksmithOS`. LocksmithOS is one consumer of the toolkit, not the definition of it.

## Scope

The module answers one question: **does this coordinate belong to the configured service territory, and why?**

It supports:

- validated Haversine distance in miles or kilometers;
- multiple named business origins;
- multiple radius areas from the same or different origins;
- inclusive and exclusion areas, with exclusions taking precedence;
- polygon areas with boundary-inclusive point checks;
- complete per-area checks plus matched and deciding areas;
- pluggable distance providers for road distance or drive time;
- a generic geocoder interface and a configurable Nominatim implementation;
- typed configuration validation issues and provider errors.

The module deliberately excludes pricing, quotes, service catalogs, customer accounts, lead capture, CRM behavior, jobs, technicians, persistence, and application UI. Applications own those concerns and consume this package's geographic result.

## Development

```powershell
npm install
npm test
npm run build
npm run deploy:dry
```

Geocoder and distance-provider tests use injected implementations. The automated suite does not make live provider requests.

## Public API

```ts
import {
  evaluateServiceArea,
  evaluateServiceAreaWithProvider,
  validateServiceAreaConfiguration,
  createHaversineDistanceProvider,
  createNominatimGeocoder,
  type DistanceProvider,
  type ServiceAreaConfiguration,
} from './src/index.ts';
```

After `npm run build`, the package entry point is `dist/index.js` with declarations in `dist/index.d.ts`.

The original `calculateDistance`, `evaluateRadius`, `evaluateDistanceAgainstRadius`, and `geocodeAddress` functions remain available for simple consumers.

## Configured service areas

Origins are defined once and referenced by radius areas. Reusing an origin ID creates multiple radii from the same location. Polygon areas do not require an origin.

```ts
const configuration: ServiceAreaConfiguration = {
  origins: [
    {
      id: 'clayton',
      name: 'Clayton office',
      coordinates: { latitude: 34.8781, longitude: -83.4007 },
    },
    {
      id: 'dillard',
      name: 'Dillard office',
      coordinates: { latitude: 34.9701, longitude: -83.3874 },
    },
  ],
  areas: [
    {
      id: 'clayton-local',
      name: 'Clayton local area',
      type: 'radius',
      originId: 'clayton',
      radius: 20,
      unit: 'miles',
    },
    {
      id: 'dillard-local',
      name: 'Dillard local area',
      type: 'radius',
      originId: 'dillard',
      radius: 20,
      unit: 'miles',
    },
    {
      id: 'restricted-property',
      name: 'Restricted property',
      type: 'polygon',
      effect: 'exclude',
      vertices: [
        { latitude: 34.90, longitude: -83.45 },
        { latitude: 34.90, longitude: -83.44 },
        { latitude: 34.91, longitude: -83.44 },
        { latitude: 34.91, longitude: -83.45 },
      ],
    },
  ],
};

const result = evaluateServiceArea(configuration, {
  latitude: 34.7837,
  longitude: -83.4168,
});
```

The result contains:

- `status`: `inside`, `outside`, or `excluded`;
- `isInside`: a direct boolean decision;
- `checks`: the result of every configured area in configuration order;
- `matches`: every area containing the destination;
- `decidingMatch`: the exclusion or inclusion that decided the outcome;
- the origin, method, distance, radius, unit, remaining distance, and optional drive duration when applicable.

Area boundaries are inclusive. A radius distance exactly equal to the configured radius is inside. A point on a polygon edge or vertex is also inside. If a point matches both inclusion and exclusion areas, the result is `excluded`. Within the same effect, the first matching area in configuration order is the deciding match, while all matches remain available.

Polygon checks use longitude and latitude with a ray-casting calculation. They are intended for ordinary local or regional service territories and are not a geodesic polygon solution for territories crossing the antimeridian.

## Pluggable distance providers

The synchronous `evaluateServiceArea` function uses Haversine distance. Applications can inject a road-distance provider without coupling provider credentials or API behavior to this package.

```ts
const roadProvider: DistanceProvider = {
  id: 'my-routing-provider',
  async measure(start, end, unit) {
    const route = await fetchRouteFromMyBackend(start, end, unit);
    return {
      distance: route.distance,
      unit,
      method: 'road',
      durationSeconds: route.durationSeconds,
    };
  },
};

const result = await evaluateServiceAreaWithProvider(
  configuration,
  destination,
  roadProvider,
);
```

Radius areas sharing the same origin and unit reuse one provider measurement during an evaluation. Provider results are checked for non-negative finite distance, requested-unit agreement, non-empty method, and valid optional duration.

`createHaversineDistanceProvider()` is included when an application wants the same provider-shaped interface without an external routing service.

## Geocoding providers

`Geocoder` is the generic address-to-coordinate interface. The included Nominatim adapter accepts provider configuration explicitly rather than reading application state.

```ts
const geocoder = createNominatimGeocoder({
  countryCodes: ['us'],
  language: 'en',
  userAgent: 'ExampleApp/1.0',
});

const place = await geocoder.geocode('Lakemont, GA');
```

Nominatim options include a custom API base URL, country filters, language, timeout, server-side user-agent identification, and injected `fetch` for testing. Browser code cannot set a `User-Agent` header, so production and higher-volume applications should call a properly identified commercial, self-hosted, or server-proxied geocoder rather than depending directly on the public endpoint.

## Validation and errors

`validateServiceAreaConfiguration` returns typed issues with `code`, `path`, and `message`. It checks duplicate IDs, coordinate ranges, missing origins, unknown origin references, radius values, units, effects, and polygon vertices.

`evaluateServiceArea` and `evaluateServiceAreaWithProvider` throw `ServiceAreaConfigurationError` when configuration is invalid. Provider output failures throw `DistanceProviderError` with a stable error code and provider ID.

## Demo

The browser demo in `demo/` visibly exercises multiple origins, multiple radius rules, and an optional exclusion radius. Its developer view displays the complete configuration and typed evaluation result. Polygon behavior and custom distance providers are covered by the public API, documentation, and automated tests rather than address-form UI.

The demo caches geocodes in the browser for 30 days, spaces uncached public Nominatim requests, displays OpenStreetMap attribution, and clearly identifies the bundled calculation as straight-line distance.

Build and deploy the static Cloudflare Worker with:

```powershell
npm run deploy:dry
npm run deploy
```

## Repository layout

```text
src/
  configuration.ts  configuration validation
  distance.ts       validated Haversine distance
  errors.ts         typed validation and provider errors
  index.ts          public API
  nominatim.ts      configurable forward geocoder
  polygon.ts        boundary-inclusive point-in-polygon
  providers.ts      geocoder and distance-provider contracts
  service-area.ts   simple radius evaluation
  territory.ts      composed service-area evaluation
  types.ts          public data types

demo/
  index.html        public module demonstration
  app.ts            browser integration
  styles.css        responsive presentation

tests/
  location.test.ts
```

## Status

**Version 1.2 module expansion completed on August 23, 2026.** The current suite covers the original distance, radius, and Nominatim behavior plus multiple origins, multiple radii, exclusion precedence, polygon boundaries, typed validation, generic geocoding, pluggable distance providers, provider result validation, and per-evaluation measurement reuse.
