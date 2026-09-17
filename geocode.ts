/**
 * Geocoding helper for client addresses.
 *
 * Uses the Manus Google Maps proxy (via `server/_core/map.ts`) to resolve each
 * client's `address` field into a lat/lng pair. We bias the search toward the
 * UAE so short/ambiguous addresses snap to the right place, and fall back to
 * querying by company name if the address itself doesn't resolve.
 */
import { makeRequest, type GeocodingResult } from "./_core/map";

export type GeocodeHit = {
  lat: number;
  lng: number;
  formattedAddress: string;
  source: "google";
};

/**
 * Resolve a single query string to coordinates, biased to the UAE.
 * Returns null when Google has no match.
 */
export async function geocodeQuery(query: string): Promise<GeocodeHit | null> {
  if (!query || !query.trim()) return null;

  const res = await makeRequest<GeocodingResult>("/maps/api/geocode/json", {
    address: query,
    // UAE bounding box (Al Silaa ↔ Ras Al Khaimah). This softly biases
    // Google toward the region without hard-filtering results.
    bounds: "22.6,51.5|26.2,56.5",
    region: "ae",
  });

  if (res.status !== "OK" || !res.results.length) return null;
  const first = res.results[0];
  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formattedAddress: first.formatted_address,
    source: "google",
  };
}

/**
 * Try the client's address first, then fall back to the company name.
 * Returns null when neither resolves.
 */
export async function geocodeClient(input: {
  companyName: string;
  address?: string | null;
}): Promise<GeocodeHit | null> {
  const candidates: string[] = [];
  if (input.address) candidates.push(input.address);
  // Always also try "CompanyName, UAE" so vague addresses like "Dubai" still
  // land near the business if Google knows it.
  candidates.push(`${input.companyName}, United Arab Emirates`);
  if (input.address) {
    candidates.push(`${input.companyName}, ${input.address}`);
  }

  for (const q of candidates) {
    try {
      const hit = await geocodeQuery(q);
      if (hit) return hit;
    } catch {
      // Swallow and try the next candidate.
    }
  }
  return null;
}
