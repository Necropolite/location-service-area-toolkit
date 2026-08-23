import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DistanceProviderError,
  ServiceAreaConfigurationError,
  calculateDistance,
  calculateDistanceKilometers,
  calculateDistanceMiles,
  createHaversineDistanceProvider,
  createNominatimGeocoder,
  evaluateDistanceAgainstRadius,
  evaluateRadius,
  evaluateRadiusWithProvider,
  evaluateServiceArea,
  evaluateServiceAreaWithProvider,
  geocodeAddress,
  isPointInPolygon,
  validateServiceAreaConfiguration,
  type DistanceProvider,
  type ServiceAreaConfiguration,
} from '../src/index.ts';

const origin = { latitude: 0, longitude: 0 };
const oneDegreeEast = { latitude: 0, longitude: 1 };

test('returns zero distance for identical coordinates', () => {
  assert.equal(calculateDistanceMiles(origin, origin), 0);
  assert.equal(calculateDistanceKilometers(origin, origin), 0);
});

test('calculates geographic distance in miles and kilometers', () => {
  const miles = calculateDistanceMiles(origin, oneDegreeEast);
  const kilometers = calculateDistanceKilometers(origin, oneDegreeEast);

  assert.ok(Math.abs(miles - 69.094) < 0.01);
  assert.ok(Math.abs(kilometers - 111.195) < 0.01);
  assert.ok(Math.abs(calculateDistance(origin, oneDegreeEast, 'miles') - miles) < 0.000001);
});

test('evaluates a reusable radius-based delivery zone', () => {
  const warehouse = { latitude: 34.0, longitude: -83.0 };
  const nearbyCustomer = { latitude: 34.1, longitude: -83.0 };
  const evaluation = evaluateRadius(warehouse, nearbyCustomer, 10, 'miles');

  assert.equal(evaluation.unit, 'miles');
  assert.equal(evaluation.radius, 10);
  assert.equal(evaluation.isInside, true);
  assert.ok(evaluation.distance > 6 && evaluation.distance < 8);
});

test('distance-against-radius evaluation includes the boundary', () => {
  assert.deepEqual(evaluateDistanceAgainstRadius(25, 25, 'miles'), {
    distance: 25,
    radius: 25,
    unit: 'miles',
    isInside: true,
  });
  assert.equal(evaluateDistanceAgainstRadius(25.01, 25, 'miles').isInside, false);
});

test('rejects invalid coordinates, radius, and distance inputs', () => {
  assert.throws(() => calculateDistanceMiles({ latitude: 91, longitude: 0 }, origin), /latitude/);
  assert.throws(() => calculateDistanceMiles(origin, { latitude: 0, longitude: 181 }), /longitude/);
  assert.throws(() => evaluateRadius(origin, oneDegreeEast, -1), /radius/);
  assert.throws(() => evaluateDistanceAgainstRadius(Number.NaN, 10), /distance/);
});

test('geocodes an address using explicit provider configuration', async () => {
  let requestUrl = '';
  let requestHeaders: HeadersInit | undefined;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = input.toString();
    requestHeaders = init?.headers;
    return new Response(JSON.stringify([{
      lat: '34.7837',
      lon: '-83.4168',
      display_name: 'Lakemont, Rabun County, Georgia, United States',
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const result = await geocodeAddress('Lakemont, GA', {
    apiBaseUrl: 'https://geocoder.example.test/',
    countryCodes: ['US'],
    fetchImpl,
    language: 'en',
    timeoutMs: 1000,
    userAgent: 'ExampleApp/1.0',
  });

  const url = new URL(requestUrl);
  assert.equal(url.origin, 'https://geocoder.example.test');
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('q'), 'Lakemont, GA');
  assert.equal(url.searchParams.get('countrycodes'), 'us');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
  assert.equal(url.searchParams.get('limit'), '1');
  assert.deepEqual(requestHeaders, {
    'Accept-Language': 'en',
    'User-Agent': 'ExampleApp/1.0',
  });
  assert.deepEqual(result, {
    coordinates: { latitude: 34.7837, longitude: -83.4168 },
    displayName: 'Lakemont, Rabun County, Georgia, United States',
  });
});

test('exposes Nominatim through the generic geocoder interface', async () => {
  const geocoder = createNominatimGeocoder({
    fetchImpl: (async () => new Response('[{"lat":"1","lon":"2"}]', { status: 200 })) as typeof fetch,
  });
  assert.equal(geocoder.id, 'nominatim');
  assert.deepEqual(await geocoder.geocode('A place'), {
    coordinates: { latitude: 1, longitude: 2 },
    displayName: undefined,
  });
});

test('returns undefined when a geocoder finds no address', async () => {
  const fetchImpl = (async () => new Response('[]', { status: 200 })) as typeof fetch;
  assert.equal(await geocodeAddress('Nowhere', { fetchImpl }), undefined);
});

test('rejects empty addresses and invalid geocoder URLs without network access', async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response('[]', { status: 200 });
  }) as typeof fetch;

  await assert.rejects(() => geocodeAddress('   ', { fetchImpl }), /address is required/);
  await assert.rejects(
    () => geocodeAddress('Somewhere', { apiBaseUrl: 'file:///tmp/geocoder', fetchImpl }),
    /base URL is invalid/,
  );
  assert.equal(called, false);
});

test('surfaces geocoder provider failures', async () => {
  const fetchImpl = (async () => new Response('unavailable', { status: 503 })) as typeof fetch;
  await assert.rejects(() => geocodeAddress('Somewhere', { fetchImpl }), /status 503/);
});

test('evaluates multiple business origins and reports the matching origin', () => {
  const configuration: ServiceAreaConfiguration = {
    origins: [
      { id: 'west', name: 'West office', coordinates: { latitude: 0, longitude: 0 } },
      { id: 'east', name: 'East office', coordinates: { latitude: 0, longitude: 5 } },
    ],
    areas: [
      { id: 'west-zone', type: 'radius', originId: 'west', radius: 50, unit: 'miles' },
      { id: 'east-zone', name: 'East radius', type: 'radius', originId: 'east', radius: 50, unit: 'miles' },
    ],
  };

  const result = evaluateServiceArea(configuration, { latitude: 0, longitude: 4.5 });
  assert.equal(result.status, 'inside');
  assert.equal(result.decidingMatch?.areaId, 'east-zone');
  assert.equal(result.decidingMatch?.originId, 'east');
  assert.equal(result.decidingMatch?.originName, 'East office');
  assert.equal(result.decidingMatch?.method, 'haversine');
});

test('reports every matching radius in configuration order', () => {
  const configuration: ServiceAreaConfiguration = {
    origins: [{ id: 'office', coordinates: origin }],
    areas: [
      { id: 'local', type: 'radius', originId: 'office', radius: 40, unit: 'miles' },
      { id: 'regional', type: 'radius', originId: 'office', radius: 80, unit: 'miles' },
    ],
  };
  const result = evaluateServiceArea(configuration, { latitude: 0, longitude: 0.5 });
  assert.deepEqual(result.matches.map(match => match.areaId), ['local', 'regional']);
  assert.equal(result.decidingMatch?.areaId, 'local');
});

test('returns every area check and a negative boundary margin when outside', () => {
  const configuration: ServiceAreaConfiguration = {
    origins: [{ id: 'office', coordinates: origin }],
    areas: [{ id: 'local', type: 'radius', originId: 'office', radius: 10, unit: 'miles' }],
  };
  const result = evaluateServiceArea(configuration, oneDegreeEast);
  assert.equal(result.status, 'outside');
  assert.equal(result.matches.length, 0);
  assert.equal(result.checks.length, 1);
  assert.equal(result.checks[0].isMatch, false);
  assert.ok((result.checks[0].distance ?? 0) > 69);
  assert.ok((result.checks[0].remainingDistance ?? 0) < -59);
});

test('gives exclusion areas precedence over inclusion areas', () => {
  const configuration: ServiceAreaConfiguration = {
    origins: [{ id: 'office', coordinates: origin }],
    areas: [
      { id: 'served', type: 'radius', originId: 'office', radius: 100, unit: 'miles' },
      {
        id: 'blocked',
        name: 'Restricted neighborhood',
        type: 'polygon',
        effect: 'exclude',
        vertices: [
          { latitude: -0.1, longitude: -0.1 },
          { latitude: -0.1, longitude: 0.1 },
          { latitude: 0.1, longitude: 0.1 },
          { latitude: 0.1, longitude: -0.1 },
        ],
      },
    ],
  };

  const result = evaluateServiceArea(configuration, origin);
  assert.equal(result.status, 'excluded');
  assert.equal(result.isInside, false);
  assert.equal(result.decidingMatch?.areaId, 'blocked');
  assert.deepEqual(result.matches.map(match => match.areaId), ['served', 'blocked']);
});

test('evaluates polygon interiors, exteriors, and inclusive boundaries', () => {
  const square = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 2 },
    { latitude: 2, longitude: 2 },
    { latitude: 2, longitude: 0 },
  ];
  assert.equal(isPointInPolygon({ latitude: 1, longitude: 1 }, square), true);
  assert.equal(isPointInPolygon({ latitude: 3, longitude: 1 }, square), false);
  assert.equal(isPointInPolygon({ latitude: 0, longitude: 1 }, square), true);
  assert.equal(isPointInPolygon({ latitude: 0, longitude: 0 }, [...square, square[0]]), true);
});

test('returns typed validation issues and throws a typed configuration error', () => {
  const configuration: ServiceAreaConfiguration = {
    origins: [
      { id: 'same', coordinates: origin },
      { id: 'same', coordinates: { latitude: 91, longitude: 0 } },
    ],
    areas: [{ id: 'zone', type: 'radius', originId: 'missing', radius: -1, unit: 'miles' }],
  };
  const issues = validateServiceAreaConfiguration(configuration);
  assert.deepEqual(issues.map(issue => issue.code), [
    'DUPLICATE_ID',
    'INVALID_COORDINATES',
    'UNKNOWN_ORIGIN',
    'INVALID_RADIUS',
  ]);
  assert.throws(
    () => evaluateServiceArea(configuration, origin),
    error => error instanceof ServiceAreaConfigurationError && error.issues.length === 4,
  );
});

test('supports pluggable road-distance providers and reuses a measurement per origin and unit', async () => {
  let calls = 0;
  const provider: DistanceProvider = {
    id: 'road-provider',
    async measure(_start, _end, unit) {
      calls += 1;
      return { distance: 12, unit, method: 'road', durationSeconds: 900 };
    },
  };
  const configuration: ServiceAreaConfiguration = {
    origins: [{ id: 'office', coordinates: origin }],
    areas: [
      { id: 'local', type: 'radius', originId: 'office', radius: 15, unit: 'miles' },
      { id: 'regional', type: 'radius', originId: 'office', radius: 25, unit: 'miles' },
    ],
  };

  const result = await evaluateServiceAreaWithProvider(configuration, oneDegreeEast, provider);
  assert.equal(calls, 1);
  assert.equal(result.status, 'inside');
  assert.equal(result.decidingMatch?.providerId, 'road-provider');
  assert.equal(result.decidingMatch?.method, 'road');
  assert.equal(result.decidingMatch?.durationSeconds, 900);
});

test('provides a Haversine provider and validates provider measurements', async () => {
  const haversine = createHaversineDistanceProvider();
  const evaluation = await evaluateRadiusWithProvider(origin, oneDegreeEast, 70, 'miles', haversine);
  assert.equal(evaluation.isInside, true);
  assert.equal(evaluation.method, 'haversine');

  const wrongUnitProvider: DistanceProvider = {
    id: 'bad-provider',
    async measure() {
      return { distance: 1, unit: 'kilometers', method: 'road' };
    },
  };
  await assert.rejects(
    () => evaluateRadiusWithProvider(origin, oneDegreeEast, 10, 'miles', wrongUnitProvider),
    error => error instanceof DistanceProviderError && error.code === 'UNIT_MISMATCH',
  );
});
