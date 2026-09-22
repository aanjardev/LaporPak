"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { onboardVillage } from "@/lib/admin";
import { PendingButton, SlowStatus } from "@/components/action-feedback";
import { RegionFields } from "@/components/region-fields";
import { ValidatedInput } from "@/components/validated-input";

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
    <p className="text-xs text-muted-foreground sm:col-span-2"><span className="text-rose-600">*</span> Wajib diisi. Kolom lain ditandai opsional.</p>
    <ValidatedInput label="Nama penanggung jawab" name="display_name" minLength={2} maxLength={120} required />
    <ValidatedInput label="Kontak penanggung jawab" name="contact_phone" type="tel" inputMode="tel" pattern="\+?[0-9]{8,15}" data-pattern-message="Gunakan 8–15 angka; tanda + hanya boleh di awal." maxLength={16} sanitize="phone" required />
    <RegionFields />
    <div className="sm:col-span-2"><ValidatedInput label="Alamat kantor" name="address" minLength={5} maxLength={500} required /></div>
    <ValidatedInput label="Kontak layanan" name="service_contact_phone" type="tel" inputMode="tel" pattern="\+?[0-9]{8,15}" data-pattern-message="Gunakan 8–15 angka; tanda + hanya boleh di awal." maxLength={16} sanitize="phone" required />
    <ValidatedInput label="Email layanan" name="contact_email" type="email" maxLength={255} />
    <div className="sm:col-span-2"><ValidatedInput label="Jam pelayanan" name="office_hours" minLength={3} maxLength={300} required placeholder="Senin–Jumat, 08.00–15.00" /></div>
    {error && <p role="alert" className="ui-alert-error px-3 py-2 text-sm sm:col-span-2">{error}</p>}
    <div className="sm:col-span-2"><PendingButton pending={pending} pendingLabel="Menyimpan profil…" className="ui-primary w-full">Buat profil desa</PendingButton><div className="mt-2"><SlowStatus active={pending} /></div></div>
  </form>;
}
