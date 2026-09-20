"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  ArrowLeft, Bot, Building2, CheckCircle2, Clock3, FileText,
  LoaderCircle, MapPin, MessageCircle, Phone, ShieldCheck, XCircle,
} from "lucide-react";
import { decideActivation } from "@/lib/admin";
import { getVillage, type VillageDetail } from "@/lib/villages";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { InlineFeedback, useToast } from "@/components/action-feedback";

export default function SuperAdminVillagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [decision, setDecision] = useState<"approved" | "changes_requested" | null>(null);
  useEffect(() => { getVillage(id).then(setVillage).catch((cause) => setError(cause.message)); }, [id]);
  async function decide(status: "approved" | "changes_requested") {
    setPending(true); setError("");
    try {
      const saved = await decideActivation(id, status, reason);
      setDecision(null);
      try { setVillage(await getVillage(id)); }
      catch { setVillage((current) => current ? { ...current, activation_status: saved.activation_status } : current); setError("Keputusan tersimpan. Tampilan lengkap belum berhasil diperbarui; gunakan muat ulang sebelum tindakan lain."); }
      setReason("");
      toast({ kind: "success", title: status === "approved" ? "Desa disetujui" : "Pengajuan dikembalikan", detail: `${village?.name || "Desa"} telah diperbarui.` });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Keputusan gagal"); }
    finally { setPending(false); }
  }
  if (error && !village) return <div className="mx-auto max-w-7xl"><Link href="/admin/villages" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand"><ArrowLeft size={16} />Kembali ke monitoring</Link><p className="ui-alert-error mt-5 border p-4 text-sm text-rose-900">{error}</p></div>;
  if (!village) return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={19} />Memuat profil dan statistik desa…</div>;
  const m = village.metadata;
  const ai = m.ai_personality;
  return <div className="mx-auto max-w-7xl space-y-7">
    <Link href="/admin/villages" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand hover:underline"><ArrowLeft size={16} />Kembali ke monitoring</Link>
    <header className="ui-panel overflow-hidden"><div className="h-1.5 bg-primary" /><div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7"><div className="flex gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand text-white"><Building2 size={24} /></span><div><p className="text-xs font-bold uppercase tracking-[.12em] text-brand">Detail operasional desa</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">{village.name}</h1><p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"><span>{m.village_code || "Kode belum diisi"}</span><span>•</span><span>{m.district || "Kecamatan belum diisi"}, {m.regency || "Kabupaten belum diisi"}</span></p></div></div><ActivationBadge value={village.activation_status} /></div></header>
    {error && <InlineFeedback kind="error" title="Data belum sepenuhnya diperbarui" detail={error} action={<button type="button" onClick={() => window.location.reload()} className="min-h-11 font-semibold underline underline-offset-4">Muat ulang</button>} />}

    <section aria-label="Ringkasan layanan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={FileText} label="Total REPORT" value={village.stats.total_reports} detail={`${village.stats.pending_reports} masih berjalan`} />
      <Metric icon={ShieldCheck} label="REPORT selesai" value={village.stats.resolved_reports} detail="Status resolved" />
      <Metric icon={FileText} label="Total REQUEST" value={village.stats.total_requests} detail={`${village.stats.pending_requests} menunggu review`} />
      <Metric icon={MessageCircle} label="WhatsApp" value={village.stats.whatsapp_connected ? "Terhubung" : "Terputus"} detail="Status gateway saat ini" good={village.stats.whatsapp_connected} />
    </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
      <div className="space-y-6">
        <section className="ui-panel p-5 sm:p-6"><SectionTitle icon={MapPin} title="Profil dan wilayah" description="Informasi publik desa untuk pemeriksaan aktivasi." /><dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2"><Item label="Provinsi" value={m.province} /><Item label="Kabupaten/Kota" value={m.regency} /><Item label="Kecamatan" value={m.district} /><Item label="Kode desa" value={m.village_code} /><Item label="Alamat kantor" value={m.address} wide /><Item label="Kontak layanan" value={m.contact_phone} icon={Phone} /><Item label="Email layanan" value={m.contact_email} /><Item label="Jam pelayanan" value={m.office_hours} icon={Clock3} /></dl></section>
        <section className="ui-panel p-5 sm:p-6"><SectionTitle icon={Bot} title="Personalisasi AI" description="Konfigurasi percakapan aktif untuk desa ini; Super Admin hanya dapat membaca." /><dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2"><Item label="Nama asisten" value={`${ai.emoji || "📋"} ${ai.name || "LaporPak"}`} /><Item label="Status AI" value={m.is_ai_enabled ? "Aktif" : "Nonaktif"} /><Item label="Karakter" value={ai.vibe} /><Item label="Gaya bahasa" value={ai.tone} /><Item label="Sapaan pembuka" value={ai.welcome_message} wide /></dl></section>
      </div>
      <div className="space-y-6">
        <section className="ui-panel p-5 sm:p-6"><SectionTitle icon={FileText} title="Distribusi status" description="Angka agregat tanpa identitas atau isi laporan warga." /><div className="mt-6 space-y-6"><StatusCounts title="REPORT" values={village.stats.report_status_counts} /><StatusCounts title="REQUEST" values={village.stats.request_status_counts} /></div><div className="mt-5 border-t border-border pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sumber knowledge aktif</p><p className="mt-2 text-2xl font-bold text-brand">{village.stats.knowledge_documents}</p></div></section>
        <section className="ui-panel p-5 sm:p-6"><SectionTitle icon={ShieldCheck} title="Kesiapan layanan" description="Pemeriksaan ringkas sebelum desa diaktifkan." /><div className="mt-5 space-y-3"><Check label="Profil wilayah dan kantor" ok={Boolean(m.village_code && m.province && m.regency && m.district && m.address)} /><Check label="Kontak dan jam pelayanan" ok={Boolean(m.contact_phone && m.office_hours)} /><Check label="Kanal WhatsApp" ok={village.stats.whatsapp_connected} /><Check label="Personalisasi AI" ok={Boolean(ai.name && ai.tone && ai.welcome_message)} /></div></section>
      </div>
    </div>

    {village.activation_status === "pending_review" && <section className="ui-panel border-l-4 border-l-primary p-5 sm:p-6"><h2 className="text-lg font-bold">Keputusan aktivasi</h2><p className="mt-2 text-sm text-muted-foreground">Persetujuan membuka layanan operasional desa. Pengembalian wajib menyertakan alasan yang jelas.</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tuliskan alasan jika pengajuan perlu dikembalikan…" className="ui-control mt-5 min-h-28 p-3" /><div className="mt-4 flex flex-wrap gap-3"><button disabled={pending} onClick={() => setDecision("approved")} className="ui-primary gap-2"><CheckCircle2 size={17} />Setujui desa</button><button disabled={pending || reason.trim().length < 3} onClick={() => setDecision("changes_requested")} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle size={17} />Kembalikan untuk perbaikan</button></div></section>}
    {village.activation_review_reason && village.activation_status === "changes_requested" && <section className="ui-alert-warning border p-5"><h2 className="font-bold text-amber-950">Catatan pemeriksaan</h2><p className="mt-2 text-sm text-amber-900">{village.activation_review_reason}</p></section>}
    <ConfirmationDialog open={decision !== null} onOpenChange={(open) => { if (!open) setDecision(null); }} title={decision === "approved" ? `Aktifkan ${village.name}?` : `Kembalikan pengajuan ${village.name}?`} description={decision === "approved" ? "Layanan operasional desa akan dibuka setelah persetujuan tersimpan." : "Admin desa akan melihat alasan dan dapat memperbaiki profil sebelum mengajukan kembali."} confirmLabel={decision === "approved" ? "Setujui dan aktifkan" : "Kembalikan pengajuan"} tone={decision === "changes_requested" ? "danger" : "default"} pending={pending} onConfirm={() => { if (decision) return decide(decision); }} />
  </div>;
}

function ActivationBadge({ value }: { value: string }) { const approved = value === "approved"; return <span className={`ui-badge shrink-0 gap-1.5 ${approved ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{approved ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{value.replaceAll("_", " ")}</span>; }
function Metric({ icon: Icon, label, value, detail, good }: { icon: typeof FileText; label: string; value: number | string; detail: string; good?: boolean }) { return <article className="ui-panel p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-3 text-2xl font-bold ${good === false ? "text-amber-700" : "text-brand"}`}>{value}</p></div><span className={`flex size-10 items-center justify-center rounded-md ${good ? "bg-emerald-50 text-emerald-700" : "bg-muted text-brand"}`}><Icon size={20} /></span></div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></article>; }
function SectionTitle({ icon: Icon, title, description }: { icon: typeof MapPin; title: string; description: string }) { return <div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-brand"><Icon size={19} /></span><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>; }
function Item({ label, value, wide, icon: Icon }: { label: string; value?: string; wide?: boolean; icon?: typeof Phone }) { return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1.5 flex items-start gap-2 text-sm font-semibold">{Icon && <Icon className="mt-0.5 shrink-0 text-muted-foreground" size={15} />}{value || "Belum diisi"}</dd></div>; }
function Check({ label, ok }: { label: string; ok: boolean }) { return <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-3"><span className="text-sm font-medium">{label}</span><span className={`flex items-center gap-1 text-xs font-semibold ${ok ? "text-emerald-700" : "text-amber-700"}`}>{ok ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}{ok ? "Siap" : "Perlu diperiksa"}</span></div>; }
function StatusCounts({ title, values }: { title: string; values: Record<string, number> }) { const total = Object.values(values).reduce((sum, value) => sum + value, 0); return <div><div className="flex items-center justify-between"><p className="text-sm font-bold">{title}</p><span className="text-xs text-muted-foreground">{total} total</span></div><div className="mt-3 space-y-2">{Object.keys(values).length ? Object.entries(values).map(([key, value]) => <div key={key}><div className="flex items-center justify-between text-xs"><span className="capitalize text-muted-foreground">{key.replaceAll("_", " ")}</span><strong>{value}</strong></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand" style={{ width: `${total ? Math.max(6, value / total * 100) : 0}%` }} /></div></div>) : <p className="text-xs text-muted-foreground">Belum ada data</p>}</div></div>; }
