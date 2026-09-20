"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, CheckCircle2, MessageCircle, Save, Send, UserRound } from "lucide-react";
import type { AdminMe, AdminVillage } from "@/lib/admin";
import { submitActivation, updateMe } from "@/lib/admin";
import {
  disconnectWhatsApp, getWhatsAppStatus, startWhatsAppPairing, updateVillage,
  type VillageAIPersonality, type VillageMetadata, type WhatsAppChannelInfo,
} from "@/lib/villages";

const input = "ui-control mt-1.5 px-3";

export function SettingsForm({ admin, village }: { admin: AdminMe; village: AdminVillage }) {
  const metadata = village.metadata as Partial<VillageMetadata>;
  const personality = metadata.ai_personality || {} as VillageAIPersonality;
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [wa, setWa] = useState<WhatsAppChannelInfo | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => { getWhatsAppStatus(village.id).then(setWa).catch((reason) => setError(reason.message)); }, [village.id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(""); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const nextMetadata: VillageMetadata = {
      ai_personality: {
        name: String(data.ai_name), emoji: String(data.ai_emoji || "📋"),
        vibe: String(data.ai_vibe), welcome_message: String(data.welcome_message),
        custom_greetings: personality.custom_greetings || ["Halo", "Hai", "Assalamualaikum"],
        tone: String(data.ai_tone),
      },
      is_ai_enabled: data.is_ai_enabled === "on",
      whatsapp_business_name: String(data.whatsapp_business_name || ""),
      logo_url: metadata.logo_url, primary_color: metadata.primary_color,
      contact_phone: String(data.service_phone), contact_email: String(data.service_email),
      address: String(data.address), village_code: String(data.village_code),
      province: String(data.province), regency: String(data.regency), district: String(data.district),
      office_hours: String(data.office_hours),
    };
    try {
      await updateMe({ display_name: String(data.display_name), contact_phone: String(data.contact_phone) });
      await updateVillage(village.id, { name: String(data.village_name), metadata: nextMetadata });
      setNotice("Pengaturan berhasil disimpan.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pengaturan gagal disimpan"); }
    finally { setPending(false); }
  }

  async function pair() {
    setPending(true); setError("");
    try { const result = await startWhatsAppPairing(village.id); setQr(result.qr_data_url || null); setNotice(result.message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Pairing gagal"); }
    finally { setPending(false); }
  }

  return <div className="space-y-6">
    {(notice || error) && <p role="status" className={`${error ? "ui-alert-error" : "border-emerald-200 bg-emerald-50 text-emerald-900"} rounded-lg border px-4 py-3 text-sm`}>{error || notice}</p>}
    <form onSubmit={save} className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6"><Header icon={UserRound} title="Akun" description="Identitas penanggung jawab desa." /><div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nama penanggung jawab" name="display_name" value={admin.display_name} required />
        <Field label="Email terverifikasi" name="email" value={admin.email} disabled />
        <Field label="Kontak penanggung jawab" name="contact_phone" value={admin.contact_phone} required />
        <div><span className="text-sm font-semibold">Kata sandi</span><Link href="/set-password" className="ui-control mt-1.5 flex items-center px-3 text-sm font-semibold text-brand">Ubah kata sandi</Link></div>
      </div></section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6"><Header icon={CheckCircle2} title="Profil Desa" description="Data wajib untuk pengajuan aktivasi." /><div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nama desa" name="village_name" value={village.name} required /><Field label="Kode desa" name="village_code" value={metadata.village_code} required />
        <Field label="Provinsi" name="province" value={metadata.province} required /><Field label="Kabupaten/Kota" name="regency" value={metadata.regency} required />
        <Field label="Kecamatan" name="district" value={metadata.district} required /><Field label="Kontak layanan" name="service_phone" value={metadata.contact_phone} required />
        <Field label="Email layanan" name="service_email" value={metadata.contact_email} /><Field label="Jam pelayanan" name="office_hours" value={metadata.office_hours} required />
        <Field label="Alamat kantor" name="address" value={metadata.address} required wide />
      </div></section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6"><Header icon={Bot} title="Personalisasi AI" description="Personalisasi hanya berlaku untuk desa ini; guardrail tetap sama." /><div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nama asisten" name="ai_name" value={personality.name || "LaporPak"} required /><Field label="Emoji" name="ai_emoji" value={personality.emoji || "📋"} />
        <Field label="Gaya bahasa" name="ai_tone" value={personality.tone || "santai dan familiar seperti tetangga"} required /><Field label="Karakter" name="ai_vibe" value={personality.vibe || "Tegas dan membantu"} required />
        <Field label="Sapaan" name="welcome_message" value={personality.welcome_message || "Selamat datang! Saya siap membantu Anda."} required wide />
        <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2"><input type="checkbox" name="is_ai_enabled" defaultChecked={metadata.is_ai_enabled !== false} className="size-4" /> Asisten AI aktif</label>
        <input type="hidden" name="whatsapp_business_name" value={metadata.whatsapp_business_name || village.name} />
      </div></section>

      <button disabled={pending} className="ui-primary gap-2"><Save size={17} />{pending ? "Menyimpan…" : "Simpan semua pengaturan"}</button>
    </form>

    <section className="rounded-xl border border-border bg-card p-5 sm:p-6"><Header icon={MessageCircle} title="WhatsApp" description="Status selalu diperiksa langsung dari gateway OpenClaw." />
      <div className="mt-5 flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${wa?.is_connected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{wa?.is_connected ? `Terhubung ${wa.phone_number || ""}` : "Belum terhubung"}</span>
        <button type="button" onClick={pair} disabled={pending} className="ui-primary">{wa?.is_connected ? "Sambungkan ulang" : "Tampilkan QR"}</button>
        {wa?.is_connected && <button type="button" onClick={async () => { await disconnectWhatsApp(village.id); setWa({ ...wa, is_connected: false, status: "disconnected" }); }} className="ui-secondary">Putuskan</button>}
      </div>
      {qr && <div className="mt-5 inline-block rounded-xl border border-border bg-white p-4"><Image unoptimized src={qr} alt="QR pairing WhatsApp" width={260} height={260} /><p className="mt-2 max-w-[260px] text-center text-xs text-muted-foreground">QR bersifat sementara. Pindai dari menu Perangkat tertaut.</p></div>}
    </section>

    {village.activation_status !== "approved" && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Aktivasi desa</h2><p className="mt-2 text-sm text-amber-900">Status: {village.activation_status.replaceAll("_", " ")}{village.activation_review_reason ? ` — ${village.activation_review_reason}` : ""}</p><button type="button" disabled={pending || village.activation_status === "pending_review"} onClick={async () => { try { await submitActivation(village.id); setNotice("Pengajuan aktivasi dikirim."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Pengajuan gagal"); } }} className="ui-primary mt-4 gap-2"><Send size={16} />Ajukan aktivasi</button></section>}
  </div>;
}

function Header({ icon: Icon, title, description }: { icon: typeof UserRound; title: string; description: string }) { return <div className="flex gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white"><Icon size={19} /></div><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>; }
function Field({ label, name, value, required, disabled, wide }: { label: string; name: string; value?: string; required?: boolean; disabled?: boolean; wide?: boolean }) { return <label className={`block text-sm font-semibold ${wide ? "sm:col-span-2" : ""}`}>{label}<input name={name} defaultValue={value || ""} required={required} disabled={disabled} className={`${input} disabled:bg-muted`} /></label>; }
