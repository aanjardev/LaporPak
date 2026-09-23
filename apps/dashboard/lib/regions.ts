import { apiFetch } from "./admin.ts";

export interface Region { code: string; name: string }
interface RegionList { items: Region[] }

export type RegionLevel = "provinces" | "regencies" | "districts" | "villages";

const REGION_CACHE_MS = 5 * 60_000;
const cache = new Map<string, { expiresAt: number; items: Region[] }>();
const pending = new Map<string, Promise<Region[]>>();

export function getRegions(level: RegionLevel, parentCode = "", signal?: AbortSignal) {
  const query = level === "regencies" ? `?province_code=${encodeURIComponent(parentCode)}`
    : level === "districts" ? `?regency_code=${encodeURIComponent(parentCode)}`
      : level === "villages" ? `?district_code=${encodeURIComponent(parentCode)}` : "";
  const endpoint = `/api/v1/regions/${level}${query}`;
  const cached = cache.get(endpoint);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.items);

  const active = pending.get(endpoint);
  if (active) return active;

  // Region data is reference data. Keep the request alive when a form unmounts
  // so a later field can reuse the result; the caller still guards its own state
  // updates with the supplied signal.
  const request = apiFetch<RegionList>(endpoint)
    .then((result) => {
      cache.set(endpoint, { expiresAt: Date.now() + REGION_CACHE_MS, items: result.items });
      return result.items;
    })
    .finally(() => pending.delete(endpoint));
  pending.set(endpoint, request);
  return signal ? Promise.race([request, abortOn(signal)]) : request;
}

function abortOn(signal: AbortSignal): Promise<never> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
}

export function clearRegionCache() {
  cache.clear();
}
