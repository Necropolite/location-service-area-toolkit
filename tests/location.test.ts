import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDistance,
  calculateDistanceKilometers,
  calculateDistanceMiles,
  evaluateDistanceAgainstRadius,
  evaluateRadius,
  geocodeAddress,
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
  assert.throws(
    () => calculateDistanceMiles({ latitude: 91, longitude: 0 }, origin),
    /latitude/,
  );
  assert.throws(
    () => calculateDistanceMiles(origin, { latitude: 0, longitude: 181 }),
    /longitude/,
  );
  assert.throws(() => evaluateRadius(origin, oneDegreeEast, -1), /radius/);
  assert.throws(() => evaluateDistanceAgainstRadius(Number.NaN, 10), /distance/);
});

test('geocodes an address using explicit provider configuration', async () => {
  let requestUrl = '';
  let requestHeaders: HeadersInit | undefined;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = input.toString();
    requestHeaders = init?.headers;
    return new Response(
      JSON.stringify([
        {
          lat: '34.7837',
          lon: '-83.4168',
          display_name: 'Lakemont, Rabun County, Georgia, United States',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
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

test('returns undefined when a geocoder finds no address', async () => {
  const fetchImpl = (async () =>
    new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

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

  await assert.rejects(
    () => geocodeAddress('Somewhere', { fetchImpl }),
    /status 503/,
  );
});
