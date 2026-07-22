export type Coordinates = { latitude: number; longitude: number };

const LOCATION_TIMEOUT_MS = 5_000;
const USER_AGENT = "FlipLens/1.0 (secondhand listing assistant)";

async function geocode(query: string): Promise<Coordinates | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(LOCATION_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const first = results[0];
    if (!first?.lat || !first.lon) return null;
    return { latitude: Number(first.lat), longitude: Number(first.lon) };
  } catch {
    return null;
  }
}

async function reverseGeocode(coordinates: Coordinates) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.latitude}&lon=${coordinates.longitude}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(LOCATION_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const result = (await response.json()) as { display_name?: string };
    return result.display_name || null;
  } catch {
    return null;
  }
}

async function routeEstimate(from: Coordinates, to: Coordinates) {
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(LOCATION_TIMEOUT_MS),
    });
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
