"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Building2, CheckCircle2, ClipboardCheck, FileText,
  LoaderCircle, MessageCircle, RefreshCw, Sparkles,
} from "lucide-react";
import { getMonitoring, type VillageMonitoring } from "@/lib/admin";

export function AdminDashboard() {
  const [queue, setQueue] = useState<VillageMonitoring[]>([]);
  const [villages, setVillages] = useState<VillageMonitoring[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError("");
    try {
      const monitoring = await getMonitoring();
      setVillages(monitoring.items);
      setQueue(monitoring.items.filter((item) => item.activation_status === "pending_review"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Dashboard gagal dimuat"); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    getMonitoring()
      .then((monitoring) => {
        if (!active) return;
        setVillages(monitoring.items);
        setQueue(monitoring.items.filter((item) => item.activation_status === "pending_review"));
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Dashboard gagal dimuat"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => ({
    active: villages.filter((item) => item.activation_status === "approved").length,
    connected: villages.filter((item) => item.whatsapp_connected).length,
    reports: villages.reduce((sum, item) => sum + item.total_reports, 0),
    requests: villages.reduce((sum, item) => sum + item.total_requests, 0),
  }), [villages]);

  return <div className="mx-auto max-w-7xl space-y-8">
    <header className="ui-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.12em] text-brand">Kendali layanan</p><h1 className="mt-2">Dashboard Super Admin</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Pantau kesiapan desa, aktivasi, dan kesehatan kanal tanpa membuka data pribadi warga.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-semibold text-brand hover:bg-muted disabled:opacity-60"><RefreshCw className={loading ? "animate-spin" : ""} size={16} />Perbarui data</button>
    </header>
    {error && <div className="ui-alert-error border px-4 py-3 text-sm text-rose-900">{error}</div>}

    <section aria-label="Ringkasan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={Building2} label="Total desa" value={villages.length} detail={`${totals.active} sudah aktif`} />
      <Kpi icon={ClipboardCheck} label="Menunggu aktivasi" value={queue.length} detail={queue.length ? "Perlu pemeriksaan" : "Antrean bersih"} attention={queue.length > 0} />
      <Kpi icon={MessageCircle} label="WhatsApp sehat" value={totals.connected} detail={`dari ${villages.length} desa`} />
      <Kpi icon={FileText} label="Aktivitas layanan" value={totals.reports + totals.requests} detail={`${totals.reports} REPORT · ${totals.requests} REQUEST`} />
    </section>

    {loading && !villages.length ? <div className="ui-panel flex min-h-52 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={20} />Mengambil ringkasan desa…</div> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
      <section className="ui-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><h2 className="text-lg font-bold">Kesehatan desa</h2><p className="mt-1 text-xs text-muted-foreground">Desa yang perlu perhatian operasional.</p></div><Link href="/admin/villages" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand hover:underline">Lihat semua <ArrowRight size={15} /></Link></div>
        <div className="divide-y divide-border">{villages.length ? villages.slice(0, 5).map((item) => <VillageHealth key={item.id} item={item} />) : <Empty text="Belum ada desa yang dapat dimonitor." />}</div>
      </section>
      <aside className="space-y-6">
        <section className="ui-panel overflow-hidden"><div className="border-b border-border px-5 py-4"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Antrean aktivasi</h2><span className="ui-badge bg-amber-50 text-amber-800 ring-amber-200">{queue.length} menunggu</span></div></div><div className="divide-y divide-border">{queue.length ? queue.slice(0, 4).map((item) => <Link key={item.id} href={`/admin/villages/${item.id}`} className="flex min-h-16 items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50"><div><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.profile_complete ? "Profil lengkap" : "Profil perlu dilengkapi"}</p></div><ArrowRight className="shrink-0 text-brand" size={17} /></Link>) : <Empty text="Tidak ada pengajuan yang menunggu." />}</div><Link href="/admin/activations" className="flex min-h-12 items-center justify-center border-t border-border text-sm font-semibold text-brand hover:bg-muted">Buka halaman aktivasi</Link></section>
        <section className="rounded-lg bg-brand p-5 text-white"><Sparkles className="text-primary" size={22} /><h2 className="mt-4 text-lg font-bold">Batas akses terjaga</h2><p className="mt-2 text-sm leading-6 text-white/70">Portal ini hanya menampilkan profil desa dan angka agregat. Identitas, pesan, dan lampiran warga tetap berada pada Admin Desa.</p></section>
      </aside>
    </div>}
  </div>;
}

function Kpi({ icon: Icon, label, value, detail, attention }: { icon: typeof Building2; label: string; value: number; detail: string; attention?: boolean }) { return <article className={`ui-panel border-l-4 p-5 ${attention ? "border-l-primary" : "border-l-brand"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-bold text-brand">{value}</p></div><span className={`flex size-10 items-center justify-center rounded-md ${attention ? "bg-amber-50 text-amber-700" : "bg-muted text-brand"}`}><Icon size={20} /></span></div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></article>; }
function VillageHealth({ item }: { item: VillageMonitoring }) { const healthy = item.whatsapp_connected && item.profile_complete && item.activation_status === "approved"; return <Link href={`/admin/villages/${item.id}`} className="grid gap-3 px-5 py-4 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{String(item.metadata?.district || "Kecamatan belum diisi")} · {item.total_reports} REPORT · {item.total_requests} REQUEST</p></div><span className={`ui-badge ${item.whatsapp_connected ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{item.whatsapp_connected ? "WhatsApp aktif" : "WhatsApp terputus"}</span><span className={`flex items-center gap-1 text-xs font-semibold ${healthy ? "text-emerald-700" : "text-amber-700"}`}>{healthy ? <CheckCircle2 size={15} /> : <MessageCircle size={15} />}{healthy ? "Sehat" : "Perlu perhatian"}</span></Link>; }
function Empty({ text }: { text: string }) { return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{text}</p>; }
