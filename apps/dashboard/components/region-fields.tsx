"use client";

import { useEffect, useState } from "react";
import { getRegions, type Region, type RegionLevel } from "@/lib/regions";

export interface RegionSelection {
  province: string;
  regency: string;
  district: string;
  village_name: string;
  village_code: string;
  regency_type: "Kabupaten" | "Kota";
}

const empty: RegionSelection = { province: "", regency: "", district: "", village_name: "", village_code: "", regency_type: "Kabupaten" };

function RegionSelect({ label, code, fallback, items, disabled, loading, onSelect }: {
  label: string; code: string; fallback: string; items: Region[]; disabled: boolean; loading: boolean;
  onSelect: (item: Region) => void;
}) {
  const [touched, setTouched] = useState(false);
  const error = touched && !code ? "Wajib dipilih." : "";
  return <label className="block text-sm font-semibold">{label}<span className="ml-1 text-rose-600" aria-hidden="true">*</span>
    <select required value={code} disabled={disabled || loading} aria-invalid={Boolean(error)} onBlur={() => setTouched(true)} onInvalid={(event) => { event.preventDefault(); setTouched(true); }} onChange={(event) => {
      setTouched(true);
      const item = items.find((candidate) => candidate.code === event.target.value);
      if (item) onSelect(item);
    }} className={`ui-control mt-1.5 px-3 ${error ? "border-rose-500" : ""}`}>
      <option value="">{loading ? "Memuat…" : `Pilih ${label.toLowerCase()}`}</option>
      {code && fallback && !items.some((item) => item.code === code) && <option value={code}>{fallback}</option>}
      {items.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select>
    {error && <span className="mt-1 block text-xs font-normal text-rose-700">{error}</span>}
  </label>;
}

export function RegionFields({ initial, disabled, onChange }: { initial?: Partial<RegionSelection>; disabled?: boolean; onChange?: (value: RegionSelection) => void }) {
  const [value, setValue] = useState<RegionSelection>(() => ({ ...empty, ...initial }));
  const [options, setOptions] = useState<Record<RegionLevel, Region[]>>({ provinces: [], regencies: [], districts: [], villages: [] });
  const [loading, setLoading] = useState<RegionLevel | "">("");
  const [error, setError] = useState("");
  const [failedRequest, setFailedRequest] = useState<{ level: RegionLevel; parentCode: string } | null>(null);
  const parts = value.village_code.split(".");
  const provinceCode = parts[0]?.length === 2 ? parts[0] : "";
  const regencyCode = parts.length >= 2 ? parts.slice(0, 2).join(".") : "";
  const districtCode = parts.length >= 3 ? parts.slice(0, 3).join(".") : "";

  function load(level: RegionLevel, parentCode = "") {
    const controller = new AbortController();
    getRegions(level, parentCode, controller.signal)
      .then((items) => { if (!controller.signal.aborted) { setOptions((current) => ({ ...current, [level]: items })); setError(""); setFailedRequest(null); } })
      .catch((reason) => { if (!controller.signal.aborted && (reason as { code?: string }).code !== "aborted") { setError(reason instanceof Error ? reason.message : "Data wilayah belum dapat dimuat."); setFailedRequest({ level, parentCode }); } })
      .finally(() => { if (!controller.signal.aborted) setLoading((current) => current === level ? "" : current); });
    return () => controller.abort();
  }

  useEffect(() => load("provinces"), []);
  useEffect(() => provinceCode ? load("regencies", provinceCode) : undefined, [provinceCode]);
  useEffect(() => regencyCode ? load("districts", regencyCode) : undefined, [regencyCode]);
  useEffect(() => districtCode ? load("villages", districtCode) : undefined, [districtCode]);

  function update(next: RegionSelection) { setValue(next); onChange?.(next); }
  return <>
    <input type="hidden" name="province" value={value.province} />
    <input type="hidden" name="regency" value={value.regency} />
    <input type="hidden" name="district" value={value.district} />
    <input type="hidden" name="village_name" value={value.village_name} />
    <input type="hidden" name="regency_type" value={value.regency_type} />
    <RegionSelect label="Provinsi" code={provinceCode} fallback={value.province} items={options.provinces} disabled={Boolean(disabled)} loading={loading === "provinces"} onSelect={(item) => { setError(""); setLoading("regencies"); update({ ...empty, province: item.name, village_code: item.code }); }} />
    <RegionSelect label="Kabupaten/Kota" code={regencyCode} fallback={value.regency} items={options.regencies} disabled={Boolean(disabled || !provinceCode)} loading={loading === "regencies"} onSelect={(item) => { setError(""); setLoading("districts"); update({ ...empty, province: value.province, regency: item.name, village_code: item.code, regency_type: /^KOTA\b/i.test(item.name) ? "Kota" : "Kabupaten" }); }} />
    <RegionSelect label="Kecamatan" code={districtCode} fallback={value.district} items={options.districts} disabled={Boolean(disabled || !regencyCode)} loading={loading === "districts"} onSelect={(item) => { setError(""); setLoading("villages"); update({ ...value, district: item.name, village_name: "", village_code: item.code }); }} />
    <RegionSelect label="Desa/Kelurahan" code={value.village_code} fallback={value.village_name} items={options.villages} disabled={Boolean(disabled || !districtCode)} loading={loading === "villages"} onSelect={(item) => { setError(""); update({ ...value, village_name: item.name, village_code: item.code }); }} />
    <label className="block text-sm font-semibold">Kode wilayah desa/kelurahan<span className="ml-1 text-rose-600" aria-hidden="true">*</span>
      <input name="village_code" value={value.village_code} readOnly required className="ui-control mt-1.5 bg-muted px-3" />
      <span className="mt-1 block text-xs font-normal text-muted-foreground">Terisi otomatis dari data wilayah Kemendagri melalui <a href="https://wilayah.id" target="_blank" rel="noreferrer" className="underline">wilayah.id</a>.</span>
    </label>
    {error && <div role="alert" className="ui-alert-warning px-3 py-2 text-sm text-amber-900 sm:col-span-2">{error} <button type="button" onClick={() => { if (failedRequest) { setLoading(failedRequest.level); setError(""); load(failedRequest.level, failedRequest.parentCode); } }} className="font-semibold underline">Coba lagi</button></div>}
  </>;
}
