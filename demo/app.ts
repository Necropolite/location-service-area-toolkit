import {
  createNominatimGeocoder,
  evaluateServiceArea,
  type Coordinates,
  type DistanceUnit,
  type ServiceAreaConfiguration,
  type ServiceAreaEvaluation,
} from '../src/index.ts';

type CachedPlace = { coordinates: Coordinates; displayName?: string; cachedAt: number };

const cacheKey = 'service-area-checker-geocodes-v1';
const providerUrl = 'https://nominatim.openstreetmap.org';
const cacheLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const geocoder = createNominatimGeocoder({
  apiBaseUrl: providerUrl,
  countryCodes: ['us'],
  language: 'en',
  timeoutMs: 8000,
});
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let lastProviderRequestAt = 0;

function readCache(): Record<string, CachedPlace> {
  try {
    return JSON.parse(localStorage.getItem(cacheKey) || '{}') as Record<string, CachedPlace>;
  } catch {
    return {};
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function lookup(address: string) {
  const cache = readCache();
  const key = normalize(address);
  const existing = cache[key];
  if (existing && Date.now() - existing.cachedAt < cacheLifetimeMs) return existing;

  const waitTime = 1100 - (Date.now() - lastProviderRequestAt);
  if (lastProviderRequestAt && waitTime > 0) await wait(waitTime);
  const result = await geocoder.geocode(address);
  lastProviderRequestAt = Date.now();
  if (!result) {
    throw new Error(`Could not find "${address}". Add a city, state, or ZIP code and try again.`);
  }

  const stored = { ...result, cachedAt: Date.now() };
  cache[key] = stored;
  localStorage.setItem(cacheKey, JSON.stringify(cache));
  return stored;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1,
  }).format(value);
}

function currentSettings() {
  return {
    businessName: $<HTMLInputElement>('business-name').value.trim(),
    primaryOriginAddress: $<HTMLInputElement>('origin-address').value.trim(),
    secondaryOriginAddress: $<HTMLInputElement>('secondary-origin-address').value.trim() || null,
    exclusionAddress: $<HTMLInputElement>('exclusion-address').value.trim() || null,
    radius: Number($<HTMLInputElement>('radius').value),
    exclusionRadius: Number($<HTMLInputElement>('exclusion-radius').value),
    unit: $<HTMLSelectElement>('unit').value,
  };
}

function renderConfig(configuration?: ServiceAreaConfiguration, result?: ServiceAreaEvaluation) {
  $('config-output').textContent = JSON.stringify(
    configuration ? { configuration, destination: result?.destination ?? null, result } : currentSettings(),
    null,
    2,
  );
}

function resultMessage(result: ServiceAreaEvaluation) {
  if (result.status === 'excluded') {
    return {
      title: 'Excluded from service',
      summary: `This location matched the ${result.decidingMatch?.areaName ?? result.decidingMatch?.areaId} exclusion.`,
    };
  }
  if (result.status === 'inside') {
    return {
      title: 'Inside the service area',
      summary: `Matched ${result.decidingMatch?.areaName ?? result.decidingMatch?.areaId}.`,
    };
  }
  return {
    title: 'Outside the service area',
    summary: 'This location did not match any included service area.',
  };
}

async function checkArea(event: SubmitEvent) {
  event.preventDefault();
  const button = document.querySelector<HTMLButtonElement>('.primary')!;
  const status = $('form-status');
  const settings = currentSettings();
  const unit = settings.unit as DistanceUnit;

  if (!Number.isFinite(settings.radius) || settings.radius < 0) {
    status.textContent = 'Enter a valid non-negative service radius.';
    return;
  }
  if (settings.exclusionAddress && (!Number.isFinite(settings.exclusionRadius) || settings.exclusionRadius < 0)) {
    status.textContent = 'Enter a valid non-negative exclusion radius.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Checking territory...';
  status.textContent = 'Looking up uncached addresses one at a time.';

  try {
    const primary = await lookup(settings.primaryOriginAddress);
    const secondary = settings.secondaryOriginAddress
      ? await lookup(settings.secondaryOriginAddress)
      : undefined;
    const exclusion = settings.exclusionAddress
      ? await lookup(settings.exclusionAddress)
      : undefined;
    const customerAddress = $<HTMLInputElement>('customer-address').value.trim();
    const customer = await lookup(customerAddress);

    const configuration: ServiceAreaConfiguration = {
      origins: [
        { id: 'primary', name: 'Primary location', coordinates: primary.coordinates },
        ...(secondary ? [{ id: 'secondary', name: 'Secondary location', coordinates: secondary.coordinates }] : []),
        ...(exclusion ? [{ id: 'exclusion-center', name: 'Exclusion center', coordinates: exclusion.coordinates }] : []),
      ],
      areas: [
        {
          id: 'primary-radius',
          name: 'Primary service radius',
          type: 'radius',
          originId: 'primary',
          radius: settings.radius,
          unit,
        },
        ...(secondary ? [{
          id: 'secondary-radius',
          name: 'Secondary service radius',
          type: 'radius' as const,
          originId: 'secondary',
          radius: settings.radius,
          unit,
        }] : []),
        ...(exclusion ? [{
          id: 'exclusion-radius',
          name: 'Excluded area',
          type: 'radius' as const,
          effect: 'exclude' as const,
          originId: 'exclusion-center',
          radius: settings.exclusionRadius,
          unit,
        }] : []),
      ],
    };

    const result = evaluateServiceArea(configuration, customer.coordinates);
    const message = resultMessage(result);
    const nearestIncluded = result.checks
      .filter(check => check.type === 'radius' && check.effect === 'include')
      .sort((first, second) => (first.distance ?? Infinity) - (second.distance ?? Infinity))[0];
    const decidingCheck = result.decidingMatch?.type === 'radius'
      ? result.checks.find(check => check.areaId === result.decidingMatch?.areaId)
      : undefined;
    const distanceCheck = decidingCheck ?? nearestIncluded;

    $('result-title').textContent = message.title;
    $('result-summary').textContent = message.summary;
    $('distance-value').textContent = distanceCheck?.distance === undefined ? '--' : formatNumber(distanceCheck.distance);
    $('distance-unit').textContent = distanceCheck?.unit ? `${distanceCheck.unit} away` : 'no distance result';
    $('origin-result').textContent = distanceCheck?.originName ?? 'No radius matched';
    $('customer-result').textContent = customer.displayName || customerAddress;
    $('matched-result').textContent = result.decidingMatch?.areaName ?? result.decidingMatch?.areaId ?? 'None';
    $('method-result').textContent = distanceCheck?.method ?? result.decidingMatch?.method ?? 'Haversine / polygon';
    $('remaining-result').textContent = distanceCheck?.remainingDistance === undefined
      ? '--'
      : distanceCheck.remainingDistance >= 0
        ? `${formatNumber(distanceCheck.remainingDistance)} ${distanceCheck.unit} remaining`
        : `${formatNumber(Math.abs(distanceCheck.remainingDistance))} ${distanceCheck.unit} beyond limit`;
    document.querySelector('.result')?.classList.toggle('outside', !result.isInside);
    document.querySelector('.result')?.classList.toggle('excluded', result.status === 'excluded');
    status.textContent = '';
    renderConfig(configuration, result);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Unable to check this service area.';
  } finally {
    button.disabled = false;
    button.textContent = 'Check service area';
  }
}

function loadExample() {
  $<HTMLInputElement>('business-name').value = 'Ridge Mobile Services';
  $<HTMLInputElement>('radius').value = '25';
  $<HTMLSelectElement>('unit').value = 'miles';
  $<HTMLInputElement>('origin-address').value = 'Clayton, GA';
  $<HTMLInputElement>('secondary-origin-address').value = 'Dillard, GA';
  $<HTMLInputElement>('exclusion-address').value = '';
  $<HTMLInputElement>('exclusion-radius').value = '3';
  $<HTMLInputElement>('customer-address').value = 'Lakemont, GA';
  renderConfig();
}

$('checker-form').addEventListener('submit', checkArea as EventListener);
$('load-example').addEventListener('click', loadExample);
document.querySelectorAll('input,select').forEach(element => {
  element.addEventListener('input', () => renderConfig());
});
renderConfig();
