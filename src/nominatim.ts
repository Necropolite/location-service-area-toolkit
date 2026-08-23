import { assertCoordinates } from './distance.js';
import type { Geocoder } from './providers.js';
import type { Coordinates, GeocodeResult } from './types.js';

export type NominatimGeocoderOptions = {
  apiBaseUrl?: string;
  countryCodes?: string[];
  fetchImpl?: typeof fetch;
  language?: string;
  timeoutMs?: number;
  userAgent?: string;
};

type NominatimSearchResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

function normalizeApiBaseUrl(value?: string) {
  const candidate = value?.trim() || 'https://nominatim.openstreetmap.org';

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export async function geocodeAddress(
  address: string,
  options: NominatimGeocoderOptions = {},
): Promise<GeocodeResult | undefined> {
  const query = address.trim();
  if (!query) {
    throw new Error('address is required');
  }

  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  if (!apiBaseUrl) {
    throw new Error('Nominatim API base URL is invalid');
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    q: query,
  });

  const countryCodes = options.countryCodes
    ?.map(value => value.trim().toLowerCase())
    .filter(Boolean);
  if (countryCodes?.length) {
    params.set('countrycodes', countryCodes.join(','));
  }

  const headers: Record<string, string> = {};
  if (options.language?.trim()) {
    headers['Accept-Language'] = options.language.trim();
  }
  if (options.userAgent?.trim()) {
    headers['User-Agent'] = options.userAgent.trim();
  }

  const response = await (options.fetchImpl ?? fetch)(
    `${apiBaseUrl}/search?${params.toString()}`,
    {
      cache: 'no-store',
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    },
  );

  if (!response.ok) {
    throw new Error(`Nominatim request failed with status ${response.status}`);
  }

  const results = (await response.json()) as NominatimSearchResult[];
  const first = results[0];
  if (!first) {
    return undefined;
  }

  const coordinates: Coordinates = {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
  };

  if (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
    return undefined;
  }

  assertCoordinates(coordinates, 'result');

  return {
    coordinates,
    displayName: first.display_name?.trim() || undefined,
  };
}

export function createNominatimGeocoder(options: NominatimGeocoderOptions = {}): Geocoder {
  return {
    id: 'nominatim',
    geocode(address) {
      return geocodeAddress(address, options);
    },
  };
}
