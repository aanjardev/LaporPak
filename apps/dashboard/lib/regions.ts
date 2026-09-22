import { apiFetch } from "./admin.ts";

export interface Region { code: string; name: string }
interface RegionList { items: Region[] }

export type RegionLevel = "provinces" | "regencies" | "districts" | "villages";

export function getRegions(level: RegionLevel, parentCode = "", signal?: AbortSignal) {
  const query = level === "regencies" ? `?province_code=${encodeURIComponent(parentCode)}`
    : level === "districts" ? `?regency_code=${encodeURIComponent(parentCode)}`
      : level === "villages" ? `?district_code=${encodeURIComponent(parentCode)}` : "";
  return apiFetch<RegionList>(`/api/v1/regions/${level}${query}`, { signal }).then((result) => result.items);
}
