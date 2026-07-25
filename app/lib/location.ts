export type Coordinates = { latitude: number; longitude: number };

const LOCATION_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const USER_AGENT = "FlipLens/1.0 (+https://fliplens.space)";
type CacheEntry<T> = { value: T | null; expiresAt: number };
const geocodeCache = new Map<string, CacheEntry<Coordinates>>();
const reverseCache = new Map<string, CacheEntry<string>>();

function createRequestGate(minimumIntervalMs: number) {
  let queue = Promise.resolve();
  let nextRequestAt = 0;
  return function schedule<T>(operation: () => Promise<T>) {
    const run = queue.then(async () => {
      const waitMs = Math.max(0, nextRequestAt - Date.now());
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      nextRequestAt = Date.now() + minimumIntervalMs;
      return operation();
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  };
}

const scheduleNominatim = createRequestGate(1_100);
const scheduleRouting = createRequestGate(1_100);

function cachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (!entry) return { found: false, value: null as T | null };
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return { found: false, value: null as T | null };
  }
  return { found: true, value: entry.value };
}

function storeValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T | null) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function geocode(query: string): Promise<Coordinates | null> {
  const cacheKey = query.trim().toLocaleLowerCase("en-US");
  const cached = cachedValue(geocodeCache, cacheKey);
  if (cached.found) return cached.value;
  try {
    const response = await scheduleNominatim(() => fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT, Referer: "https://fliplens.space/" },
      signal: AbortSignal.timeout(LOCATION_TIMEOUT_MS),
    }));
    if (!response.ok) return storeValue(geocodeCache, cacheKey, null);
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const first = results[0];
    if (!first?.lat || !first.lon) return storeValue(geocodeCache, cacheKey, null);
    return storeValue(geocodeCache, cacheKey, { latitude: Number(first.lat), longitude: Number(first.lon) });
  } catch {
    return null;
  }
}

async function reverseGeocode(coordinates: Coordinates) {
  const cacheKey = `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;
  const cached = cachedValue(reverseCache, cacheKey);
  if (cached.found) return cached.value;
  try {
    const response = await scheduleNominatim(() => fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.latitude}&lon=${coordinates.longitude}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT, Referer: "https://fliplens.space/" },
      signal: AbortSignal.timeout(LOCATION_TIMEOUT_MS),
    }));
    if (!response.ok) return storeValue(reverseCache, cacheKey, null);
    const result = (await response.json()) as { display_name?: string };
    return storeValue(reverseCache, cacheKey, result.display_name || null);
  } catch {
    return null;
  }
}

async function routeEstimate(from: Coordinates, to: Coordinates) {
  try {
    const response = await scheduleRouting(() => fetch(`https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT, Referer: "https://fliplens.space/" },
      signal: AbortSignal.timeout(LOCATION_TIMEOUT_MS),
    }));
    if (!response.ok) return null;
    const data = (await response.json()) as { routes?: Array<{ distance?: number; duration?: number }> };
    const route = data.routes?.[0];
    if (!route?.distance || !route.duration) return null;
    return {
      distance: `${Math.round(route.distance / 100) / 10} km estimate`,
      travelTime: `${Math.max(1, Math.round(route.duration / 60))} min driving estimate`,
    };
  } catch {
    return null;
  }
}

export async function estimateTravel(startCity: string, listingLocation: string, startCoordinates?: Coordinates) {
  if ((!startCity && !startCoordinates) || !listingLocation) return null;
  const [from, to] = await Promise.all([startCoordinates || geocode(startCity), geocode(listingLocation)]);
  if (!from || !to) return null;
  return routeEstimate(from, to);
}

export async function describeCoordinates(coordinates?: Coordinates) {
  return coordinates ? reverseGeocode(coordinates) : null;
}
