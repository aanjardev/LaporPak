"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, CheckCircle2, FileText, LoaderCircle, MessageCircle, RefreshCw, Save, Send,
  Smartphone, Unplug, UserRound,
} from "lucide-react";
import type { AdminMe, AdminVillage } from "@/lib/admin";
import { submitActivation, updateMe } from "@/lib/admin";
import {
  disconnectWhatsApp, getWhatsAppStatus, startWhatsAppPairing, updateVillage,
  uploadVillageLogo,
  type VillageAIPersonality, type VillageMetadata, type WhatsAppChannelInfo,
} from "@/lib/villages";
import { InlineFeedback, PendingButton, SlowStatus, useToast } from "@/components/action-feedback";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";

const input = "ui-control mt-1.5 px-3";

export function SettingsForm({ admin, village }: { admin: AdminMe; village: AdminVillage }) {
  const toast = useToast();
  const [metadata, setMetadata] = useState(village.metadata as Partial<VillageMetadata>);
  const [villageName, setVillageName] = useState(village.name);
  const personality = metadata.ai_personality || {} as VillageAIPersonality;
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [wa, setWa] = useState<WhatsAppChannelInfo | null>(null);
  const [waLoading, setWaLoading] = useState(true);
  const [waError, setWaError] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoRevision, setLogoRevision] = useState(0);
  const [hasStoredLogo, setHasStoredLogo] = useState(Boolean(metadata.has_logo || metadata.logo_file_name));
  const [dirty, setDirty] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [activationStatus, setActivationStatus] = useState(village.activation_status);
  const errorRef = useRef<HTMLDivElement>(null);
  const selectedLogoUrl = useMemo(() => logo ? URL.createObjectURL(logo) : null, [logo]);

  useEffect(() => () => {
    if (selectedLogoUrl) URL.revokeObjectURL(selectedLogoUrl);
  }, [selectedLogoUrl]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const refreshWhatsApp = useCallback(async () => {
    setWaLoading(true);
    setWaError("");
    try {
      const status = await getWhatsAppStatus(village.id);
      setWa(status);
      if (status.is_connected) {
        setQr(null);
        setQrExpiresAt(null);
      }
    } catch (reason) {
      setWaError(reason instanceof Error ? reason.message : "Status WhatsApp tidak dapat diperiksa");
    } finally {
      setWaLoading(false);
    }
  }, [village.id]);

  useEffect(() => {
    let active = true;
    getWhatsAppStatus(village.id)
      .then((status) => { if (active) setWa(status); })
      .catch((reason) => { if (active) setWaError(reason instanceof Error ? reason.message : "Status WhatsApp tidak dapat diperiksa"); })
      .finally(() => { if (active) setWaLoading(false); });
    return () => { active = false; };
  }, [village.id]);

  useEffect(() => {
    if (!qr) return;
    let active = true;
    let timer: number;
    async function poll() {
      if (!active) return;
      if (document.visibilityState === "hidden") { timer = window.setTimeout(poll, 3_000); return; }
      if (qrExpiresAt && Date.now() >= new Date(qrExpiresAt).getTime()) {
        setQr(null);
        setWaError("QR telah kedaluwarsa. Tampilkan QR baru untuk melanjutkan.");
        return;
      }
      try {
        const status = await getWhatsAppStatus(village.id);
        if (!active) return;
        setWa(status);
        if (status.is_connected) {
          setQr(null);
          setQrExpiresAt(null);
          setNotice("WhatsApp terhubung dan chatbot siap menerima pesan.");
          toast({ kind: "success", title: "WhatsApp terhubung", detail: "Chatbot siap menerima pesan warga." });
          return;
        }
      } catch { /* Status manual tetap tersedia bila satu polling gagal. */ }
      if (active) timer = window.setTimeout(poll, 3_000);
    }
    timer = window.setTimeout(poll, 3_000);
    return () => { active = false; window.clearTimeout(timer); };
  }, [qr, qrExpiresAt, toast, village.id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setNotice(""); setError("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
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
      regency_type: String(data.regency_type) as "Kabupaten" | "Kota",
      postal_code: String(data.postal_code),
      document_official_name: String(data.document_official_name),
      document_official_title: String(data.document_official_title),
    };
    let accountSaved = false;
    let profileSaved = false;
    try {
      await updateMe({ display_name: String(data.display_name), contact_phone: String(data.contact_phone) });
      accountSaved = true;
      const savedVillage = await updateVillage(village.id, { name: String(data.village_name), metadata: nextMetadata });
      profileSaved = true;
      setVillageName(savedVillage.name);
      setMetadata(savedVillage.metadata);
      if (logo) {
        try {
          const logoVillage = await uploadVillageLogo(village.id, logo);
          setMetadata(logoVillage.metadata);
          setHasStoredLogo(true);
        } catch (reason) {
          setError(`Profil tersimpan. Logo belum berhasil diunggah. ${reason instanceof Error ? reason.message : "Coba unggah kembali."}`);
          toast({ kind: "warning", title: "Sebagian pengaturan tersimpan", detail: "Profil tersimpan, tetapi logo masih perlu diunggah." });
          return;
        }
        setLogo(null);
        setLogoRevision(Date.now());
        const input = form.elements.namedItem("logo");
        if (input instanceof HTMLInputElement) input.value = "";
      }
      setNotice("Pengaturan berhasil disimpan.");
      setDirty(false);
      toast({ kind: "success", title: "Pengaturan tersimpan", detail: "Profil dan pratinjau sudah diperbarui." });
    } catch (reason) {
      const prefix = profileSaved ? "Profil tersimpan. " : accountSaved ? "Akun tersimpan. Profil desa belum berhasil disimpan. " : "";
      setError(`${prefix}${reason instanceof Error ? reason.message : "Pengaturan gagal disimpan"}`);
    }
    finally { setSaving(false); }
  }

  async function pair() {
    setPairing(true); setNotice(""); setError(""); setWaError(""); setQr(null);
    try {
      const result = await startWhatsAppPairing(village.id);
      setQr(result.qr_data_url || null);
      setQrExpiresAt(result.expires_at || null);
      setWa((current) => ({
        ...current,
        is_connected: result.connected,
        status: result.status,
        message: result.message,
      }));
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "QR WhatsApp gagal dibuat");
    } finally {
      setPairing(false);
    }
  }

  async function disconnect() {
    setPairing(true); setError("");
    try {
      await disconnectWhatsApp(village.id);
      setQr(null); setQrExpiresAt(null);
      setWa((current) => ({ ...current, is_connected: false, status: "disconnected" }));
      setNotice("Koneksi WhatsApp berhasil diputuskan.");
      setDisconnectOpen(false);
      toast({ kind: "success", title: "WhatsApp diputuskan", detail: "Pesan warga tidak akan diproses sampai perangkat ditautkan lagi." });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Koneksi gagal diputuskan"); }
    finally { setPairing(false); }
  }

  return <div className="space-y-6">
    {error && <div ref={errorRef} tabIndex={-1}><InlineFeedback kind="error" title="Pengaturan belum tersimpan sepenuhnya" detail={error} /></div>}
    {!error && notice && <InlineFeedback kind="success" title={notice} />}
    <form onSubmit={save} onChange={(event) => {
      setDirty(true);
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
      if (target.name === "village_name") setVillageName(target.value);
      const keys: Record<string, keyof VillageMetadata> = { regency_type: "regency_type", regency: "regency", district: "district", address: "address", postal_code: "postal_code" };
      if (keys[target.name]) setMetadata((current) => ({ ...current, [keys[target.name]]: target.value }));
    }} className="space-y-6">
      <section className="ui-panel p-5 sm:p-6"><Header icon={UserRound} title="Akun" description="Identitas penanggung jawab desa." /><div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nama penanggung jawab" name="display_name" value={admin.display_name} required />
        <Field label="Email terverifikasi" name="email" value={admin.email} disabled />
        <Field label="Kontak penanggung jawab" name="contact_phone" value={admin.contact_phone} required />
        <div><span className="text-sm font-semibold">Kata sandi</span><Link href="/set-password" className="ui-control mt-1.5 flex items-center px-3 text-sm font-semibold text-brand">Ubah kata sandi</Link></div>
      </div></section>

      <section className="ui-panel p-5 sm:p-6"><Header icon={CheckCircle2} title="Profil Desa" description="Data wajib untuk aktivasi dan kop dokumen laporan." /><div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nama desa" name="village_name" value={villageName} required /><Field label="Kode desa" name="village_code" value={metadata.village_code} required />
        <Field label="Provinsi" name="province" value={metadata.province} required />
        <label className="block text-sm font-semibold">Jenis wilayah<span className="ml-1 text-rose-600">*</span><select name="regency_type" defaultValue={metadata.regency_type || "Kabupaten"} required className={`${input}`}><option>Kabupaten</option><option>Kota</option></select></label>
        <Field label="Nama kabupaten/kota" name="regency" value={metadata.regency} required />
        <Field label="Kecamatan" name="district" value={metadata.district} required /><Field label="Kontak layanan" name="service_phone" value={metadata.contact_phone} required />
        <Field label="Email layanan" name="service_email" value={metadata.contact_email} /><Field label="Jam pelayanan" name="office_hours" value={metadata.office_hours} required />
        <Field label="Alamat kantor" name="address" value={metadata.address} required /><Field label="Kode pos" name="postal_code" value={metadata.postal_code} required />
        <Field label="Nama penanggung jawab dokumen" name="document_official_name" value={metadata.document_official_name} required /><Field label="Jabatan" name="document_official_title" value={metadata.document_official_title || "Kepala Desa"} required />
        <label className="block text-sm font-semibold sm:col-span-2">Logo resmi desa<span className="ml-1 text-rose-600">*</span><input name="logo" type="file" accept="image/png,image/jpeg" required={!hasStoredLogo} onChange={(event) => { const file = event.target.files?.[0] || null; if (file && !["image/png", "image/jpeg"].includes(file.type)) { setError("Logo harus berupa PNG atau JPEG."); event.target.value = ""; setLogo(null); return; } if (file && file.size > 2 * 1024 * 1024) { setError("Logo maksimal 2 MB."); event.target.value = ""; setLogo(null); return; } setError(""); setLogo(file); }} className="mt-1.5 block min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:font-semibold" /><span className="mt-1 block text-xs font-normal text-muted-foreground">PNG/JPEG maksimal 2 MB. {logo?.name || metadata.logo_file_name || "Belum ada logo"}</span>{logo && <span role="status" className="mt-1 block text-xs font-medium text-brand">Logo siap diunggah saat pengaturan disimpan.</span>}</label>
      </div></section>

      <section className="ui-panel overflow-hidden"><div className="border-b border-border p-5 sm:p-6"><Header icon={FileText} title="Pratinjau Kop Dokumen" description={dirty ? "Pratinjau memuat perubahan yang belum disimpan." : "Pratinjau sesuai data profil tersimpan."} /></div><div className="bg-white p-6 font-serif text-slate-950 sm:p-8"><div className="grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-4"><div className="flex size-[72px] items-center justify-center">{selectedLogoUrl || hasStoredLogo ? <Image unoptimized src={selectedLogoUrl || `/api/villages/${village.id}/logo?v=${logoRevision}`} alt={`Logo ${villageName}`} width={72} height={72} className="size-[72px] object-contain" /> : <span className="text-xs text-slate-400">Logo desa</span>}</div><div className="text-center"><p className="text-lg font-bold">PEMERINTAH {(metadata.regency_type || "KABUPATEN").toUpperCase()} {(metadata.regency || "...").toUpperCase()}</p><p className="text-lg font-bold">KECAMATAN {(metadata.district || "...").toUpperCase()}</p><p className="text-xl font-bold">KANTOR DESA {villageName.toUpperCase()}</p><p className="mt-1 text-sm">Alamat: {metadata.address || "..."} {metadata.postal_code ? `Kode Pos ${metadata.postal_code}` : ""}</p></div><div aria-hidden="true" /></div><div className="mt-3 border-b-2 border-slate-900" /></div></section>

      <section className="ui-panel p-5 sm:p-6"><Header icon={Bot} title="Personalisasi AI" description="Personalisasi hanya berlaku untuk desa ini; guardrail tetap sama." /><div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nama asisten" name="ai_name" value={personality.name || "LaporPak"} required /><Field label="Emoji" name="ai_emoji" value={personality.emoji || "📋"} />
        <Field label="Gaya bahasa" name="ai_tone" value={personality.tone || "santai dan familiar seperti tetangga"} required /><Field label="Karakter" name="ai_vibe" value={personality.vibe || "Tegas dan membantu"} required />
        <Field label="Sapaan" name="welcome_message" value={personality.welcome_message || "Selamat datang! Saya siap membantu Anda."} required wide />
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold sm:col-span-2"><input type="checkbox" name="is_ai_enabled" defaultChecked={metadata.is_ai_enabled !== false} className="size-4" /> Asisten AI aktif</label>
        <input type="hidden" name="whatsapp_business_name" value={metadata.whatsapp_business_name || village.name} />
      </div></section>

      <div className="flex flex-wrap items-center gap-3"><PendingButton pending={saving} pendingLabel="Menyimpan pengaturan…" disabled={!dirty}><Save size={17} />Simpan semua pengaturan</PendingButton><span role="status" className={`text-sm ${dirty ? "font-semibold text-amber-800" : "text-muted-foreground"}`}>{dirty ? "Ada perubahan yang belum disimpan." : "Semua perubahan sudah tersimpan."}</span></div><SlowStatus active={saving} />
    </form>

    <section className="ui-panel overflow-hidden">
      <div className="border-b border-border p-5 sm:p-6"><Header icon={MessageCircle} title="WhatsApp" description="Status berasal langsung dari gateway OpenClaw, bukan dari konfigurasi tersimpan." /></div>
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex items-center gap-3">
            <span className={`flex size-11 items-center justify-center rounded-md ${wa?.is_connected ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {waLoading ? <LoaderCircle className="animate-spin" size={20} /> : <Smartphone size={20} />}
            </span>
            <div><p className="text-sm font-bold">{waLoading ? "Memeriksa gateway…" : wa?.is_connected ? "WhatsApp terhubung" : "WhatsApp belum terhubung"}</p><p className="mt-1 text-xs text-muted-foreground">{wa?.phone_number || wa?.message || "Gunakan QR untuk menautkan perangkat desa."}</p></div>
          </div>
          {waError && <div className="ui-alert-warning mt-4 border px-4 py-3 text-sm text-amber-900"><p>{waError}</p><button type="button" onClick={() => void refreshWhatsApp()} className="mt-2 font-semibold underline underline-offset-4">Coba periksa lagi</button></div>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={pair} disabled={pairing || waLoading} className="ui-primary">
              {pairing ? <><LoaderCircle className="animate-spin" size={17} />Menyiapkan QR…</> : <><RefreshCw size={17} />{wa?.is_connected ? "Sambungkan ulang" : "Tampilkan QR"}</>}
            </button>
            <button type="button" onClick={() => void refreshWhatsApp()} disabled={pairing || waLoading} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-semibold text-brand hover:bg-muted disabled:opacity-60"><RefreshCw size={16} />Periksa status</button>
            {wa?.is_connected && <button type="button" onClick={() => setDisconnectOpen(true)} disabled={pairing} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50"><Unplug size={16} />Putuskan</button>}
          </div>
          {pairing && <p className="mt-3 text-xs leading-5 text-muted-foreground">OpenClaw sedang menyiapkan akun kanal dan QR. Setup pertama dapat lebih lama; jangan menutup halaman.</p>}
        </div>
        <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-input bg-muted/40 p-4">
          {qr ? <div className="text-center"><Image unoptimized src={qr} alt="QR pairing WhatsApp" width={240} height={240} className="mx-auto bg-white" /><p className="mt-3 text-xs text-muted-foreground">Pindai dari WhatsApp → Perangkat tertaut. Status diperiksa otomatis.</p>{qrExpiresAt && <p className="mt-1 text-[11px] text-muted-foreground">QR berlaku sampai {new Date(qrExpiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.</p>}</div> : <div className="max-w-56 text-center text-muted-foreground"><MessageCircle className="mx-auto" size={32} /><p className="mt-3 text-sm">QR akan tampil di area ini setelah gateway siap.</p></div>}
        </div>
      </div>
    </section>

    {activationStatus !== "approved" && <section className="ui-alert-warning border p-5"><h2 className="font-bold text-amber-950">Aktivasi desa</h2><p className="mt-2 text-sm text-amber-900">Status: {activationStatus.replaceAll("_", " ")}{village.activation_review_reason ? ` — ${village.activation_review_reason}` : ""}</p><PendingButton type="button" pending={activating} pendingLabel="Mengirim pengajuan…" disabled={activationStatus === "pending_review"} onClick={async () => { setActivating(true); setError(""); try { const result = await submitActivation(village.id); setActivationStatus(result.activation_status); setNotice("Pengajuan aktivasi dikirim."); toast({ kind: "success", title: "Pengajuan aktivasi dikirim" }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Pengajuan gagal"); } finally { setActivating(false); } }} className="ui-primary mt-4 gap-2"><Send size={16} />Ajukan aktivasi</PendingButton></section>}
    <ConfirmationDialog open={disconnectOpen} onOpenChange={setDisconnectOpen} title="Putuskan WhatsApp desa?" description="Chatbot berhenti menerima pesan warga sampai perangkat ditautkan kembali." confirmLabel="Putuskan WhatsApp" tone="danger" pending={pairing} onConfirm={disconnect} />
    <UnsavedChangesGuard active={dirty} />
  </div>;
}

function Header({ icon: Icon, title, description }: { icon: typeof UserRound; title: string; description: string }) { return <div className="flex gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand text-white"><Icon size={19} /></div><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>; }
function Field({ label, name, value, required, disabled, wide }: { label: string; name: string; value?: string; required?: boolean; disabled?: boolean; wide?: boolean }) { return <label className={`block text-sm font-semibold ${wide ? "sm:col-span-2" : ""}`}>{label}{required && <span className="ml-1 text-rose-600">*</span>}<input name={name} defaultValue={value || ""} required={required} disabled={disabled} className={`${input} disabled:bg-muted`} /></label>; }
