"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { onboardVillage } from "@/lib/admin";

const fields = [
  ["display_name", "Nama penanggung jawab"], ["contact_phone", "Kontak penanggung jawab"],
  ["village_name", "Nama desa"], ["village_code", "Kode desa"],
  ["province", "Provinsi"], ["regency", "Kabupaten/Kota"], ["district", "Kecamatan"],
  ["address", "Alamat kantor"], ["service_contact_phone", "Kontak layanan"],
  ["contact_email", "Email layanan (opsional)"], ["office_hours", "Jam pelayanan"],
] as const;

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={async (event) => {
    event.preventDefault(); setPending(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    if (!data.contact_email) delete data.contact_email;
    try { await onboardVillage(data); router.push("/reports/settings"); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Onboarding gagal"); }
    finally { setPending(false); }
  }}>
    {fields.map(([name, label]) => <label key={name} className={`block text-sm font-semibold ${name === "address" || name === "office_hours" ? "sm:col-span-2" : ""}`}>
      {label}<input name={name} required={name !== "contact_email"} className="ui-control mt-1.5 px-3" />
    </label>)}
    {error && <p role="alert" className="ui-alert-error px-3 py-2 text-sm sm:col-span-2">{error}</p>}
    <button disabled={pending} className="ui-primary sm:col-span-2">{pending ? "Menyimpan…" : "Buat profil desa"}</button>
  </form>;
}
