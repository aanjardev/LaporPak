"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, LoaderCircle, MessageCircleWarning, RefreshCw, Search } from "lucide-react";
import { getMonitoring, type VillageMonitoring } from "@/lib/admin";

type Filter = "all" | "approved" | "pending" | "disconnected";

export function MonitoringDashboard() {
  const [items, setItems] = useState<VillageMonitoring[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { setItems((await getMonitoring()).items); } catch (reason) { setError(reason instanceof Error ? reason.message : "Monitoring gagal dimuat"); } finally { setLoading(false); } }
  useEffect(() => {
    let active = true;
    getMonitoring()
      .then((result) => { if (active) setItems(result.items); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Monitoring gagal dimuat"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.name} ${String(item.metadata?.district || "")} ${String(item.metadata?.regency || "")}`.toLowerCase();
    if (!text.includes(query.trim().toLowerCase())) return false;
    if (filter === "approved") return item.activation_status === "approved";
    if (filter === "pending") return item.activation_status !== "approved";
    if (filter === "disconnected") return !item.whatsapp_connected;
    return true;
  }), [items, query, filter]);
  return <div className="mx-auto max-w-7xl space-y-7">
    <header className="ui-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-brand">Kesehatan operasional</p><h1 className="mt-2">Monitoring Desa</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Telusuri profil, aktivasi, WhatsApp, dan volume layanan setiap desa.</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-semibold text-brand hover:bg-muted"><RefreshCw className={loading ? "animate-spin" : ""} size={16} />Perbarui</button></header>
    {error && <div className="ui-alert-error border px-4 py-3 text-sm text-rose-900">{error}</div>}
    <section className="ui-panel p-4 sm:p-5"><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]"><label><span className="text-xs font-semibold text-muted-foreground">Cari desa atau wilayah</span><div className="relative mt-1.5"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama desa, kecamatan, kabupaten…" className="ui-control pl-10 pr-3" /></div></label><label><span className="text-xs font-semibold text-muted-foreground">Kondisi</span><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="ui-control mt-1.5 px-3"><option value="all">Semua desa</option><option value="approved">Sudah aktif</option><option value="pending">Belum aktif</option><option value="disconnected">WhatsApp bermasalah</option></select></label></div></section>
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Menampilkan <strong className="text-foreground">{visible.length}</strong> dari {items.length} desa</p></div>
    {loading && !items.length ? <div className="ui-panel flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={18} />Memuat monitoring…</div> : visible.length ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <VillageCard key={item.id} item={item} />)}</section> : <section className="ui-panel flex min-h-64 flex-col items-center justify-center px-5 text-center"><Building2 className="text-muted-foreground" size={32} /><h2 className="mt-4 font-bold">Desa tidak ditemukan</h2><p className="mt-2 text-sm text-muted-foreground">Ubah kata kunci atau filter kondisi.</p></section>}
  </div>;
}

function VillageCard({ item }: { item: VillageMonitoring }) { return <Link href={`/admin/villages/${item.id}`} className="group ui-panel overflow-hidden transition hover:border-brand"><div className="border-b border-border p-5"><div className="flex items-start justify-between gap-4"><span className="flex size-11 items-center justify-center rounded-md bg-brand text-white"><Building2 size={21} /></span>{item.whatsapp_connected ? <span className="ui-badge gap-1 bg-emerald-50 text-emerald-700 ring-emerald-200"><CheckCircle2 size={13} />WhatsApp aktif</span> : <span className="ui-badge gap-1 bg-amber-50 text-amber-800 ring-amber-200"><MessageCircleWarning size={13} />Perlu koneksi</span>}</div><h2 className="mt-4 text-lg font-bold text-brand group-hover:underline">{item.name}</h2><p className="mt-1 text-xs text-muted-foreground">{String(item.metadata?.district || "Kecamatan belum diisi")} · {String(item.metadata?.regency || "Kabupaten belum diisi")}</p></div><div className="grid grid-cols-3 divide-x divide-border bg-muted/35 text-center"><Metric value={item.total_reports} label="REPORT" /><Metric value={item.total_requests} label="REQUEST" /><Metric value={item.knowledge_documents} label="Knowledge" /></div><div className="flex items-center justify-between px-5 py-4"><span className={`ui-badge ${item.activation_status === "approved" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{item.activation_status.replaceAll("_", " ")}</span><span className="inline-flex items-center gap-1 text-sm font-semibold text-brand">Lihat detail <ArrowRight size={15} /></span></div></Link>; }
function Metric({ value, label }: { value: number; label: string }) { return <div className="px-2 py-4"><p className="text-xl font-bold text-brand">{value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p></div>; }
