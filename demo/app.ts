import { evaluateRadius, geocodeAddress, type Coordinates, type DistanceUnit } from '../src/index.ts';

type CachedPlace = { coordinates: Coordinates; displayName?: string; cachedAt: number };
const cacheKey = 'service-area-checker-geocodes-v1';
const providerUrl = 'https://nominatim.openstreetmap.org';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function readCache(): Record<string, CachedPlace> {
  try { return JSON.parse(localStorage.getItem(cacheKey) || '{}'); } catch { return {}; }
}
function normalize(value: string) { return value.trim().toLowerCase().replace(/\s+/g, ' '); }
async function lookup(address: string, delay: boolean) {
  const cache = readCache();
  const key = normalize(address);
  const existing = cache[key];
  if (existing && Date.now() - existing.cachedAt < 30 * 24 * 60 * 60 * 1000) return existing;
  if (delay) await wait(1100);
  const result = await geocodeAddress(address, {
    apiBaseUrl: providerUrl,
    countryCodes: ['us'],
    language: 'en',
    timeoutMs: 8000,
  });
  if (!result) throw new Error('One of those addresses could not be found. Add a city, state, or ZIP code and try again.');
  const stored = { ...result, cachedAt: Date.now() };
  cache[key] = stored;
  localStorage.setItem(cacheKey, JSON.stringify(cache));
  return stored;
}
function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: value < 10 ? 2 : 1 }).format(value);
}
function renderConfig(origin?: CachedPlace) {
  $('config-output').textContent = JSON.stringify({
    businessName: $<HTMLInputElement>('business-name').value.trim(),
    originAddress: $<HTMLInputElement>('origin-address').value.trim(),
    originCoordinates: origin?.coordinates ?? null,
    radius: Number($<HTMLInputElement>('radius').value),
    unit: $<HTMLSelectElement>('unit').value,
  }, null, 2);
}
async function checkArea(event: SubmitEvent) {
  event.preventDefault();
  const button = document.querySelector<HTMLButtonElement>('.primary')!;
  const status = $('form-status');
  const originAddress = $<HTMLInputElement>('origin-address').value;
  const customerAddress = $<HTMLInputElement>('customer-address').value;
  const radius = Number($<HTMLInputElement>('radius').value);
  const unit = $<HTMLSelectElement>('unit').value as DistanceUnit;
  if (!Number.isFinite(radius) || radius < 0) { status.textContent = 'Enter a valid non-negative service radius.'; return; }

  button.disabled = true;
  button.textContent = 'Checking addresses...';
  status.textContent = '';
  try {
    const before = readCache();
    const origin = await lookup(originAddress, false);
    const customerWasCached = Boolean(before[normalize(customerAddress)]);
    const customer = await lookup(customerAddress, !customerWasCached && !before[normalize(originAddress)]);
    const result = evaluateRadius(origin.coordinates, customer.coordinates, radius, unit);
    const remaining = radius - result.distance;
    $('result-title').textContent = result.isInside ? 'Inside the service area' : 'Outside the service area';
    $('result-summary').textContent = result.isInside
      ? 'This address meets the configured distance policy.'
      : 'This address is beyond the configured service radius.';
    $('distance-value').textContent = formatNumber(result.distance);
    $('distance-unit').textContent = unit + ' away';
    $('origin-result').textContent = origin.displayName || originAddress;
    $('customer-result').textContent = customer.displayName || customerAddress;
    $('remaining-result').textContent = result.isInside
      ? formatNumber(remaining) + ' ' + unit + ' remaining'
      : formatNumber(Math.abs(remaining)) + ' ' + unit + ' beyond limit';
    document.querySelector('.result')?.classList.toggle('outside', !result.isInside);
    renderConfig(origin);
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
  $<HTMLInputElement>('customer-address').value = 'Lakemont, GA';
  renderConfig();
}
$('checker-form').addEventListener('submit', checkArea as EventListener);
$('load-example').addEventListener('click', loadExample);
document.querySelectorAll('input,select').forEach(element => element.addEventListener('input', () => renderConfig()));
renderConfig();
