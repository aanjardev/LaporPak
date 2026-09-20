"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import { getActivationQueue, type VillageMonitoring } from "@/lib/admin";

export function ActivationDashboard() {
  const [items, setItems] = useState<VillageMonitoring[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { setItems((await getActivationQueue()).items); } catch (reason) { setError(reason instanceof Error ? reason.message : "Antrean gagal dimuat"); } finally { setLoading(false); } }
  useEffect(() => {
    let active = true;
    getActivationQueue()
      .then((result) => { if (active) setItems(result.items); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Antrean gagal dimuat"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className="mx-auto max-w-7xl space-y-7">
    <header className="ui-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-brand">Persetujuan layanan</p><h1 className="mt-2">Aktivasi Desa</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Periksa kelengkapan profil dan kesiapan layanan sebelum desa diaktifkan.</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-semibold text-brand hover:bg-muted"><RefreshCw className={loading ? "animate-spin" : ""} size={16} />Perbarui</button></header>
    {error && <div className="ui-alert-error border px-4 py-3 text-sm text-rose-900">{error}</div>}
    <section className="ui-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><h2 className="font-bold">Pengajuan menunggu pemeriksaan</h2><p className="mt-1 text-xs text-muted-foreground">Urutan terbaru ditampilkan lebih dahulu.</p></div><span className="ui-badge bg-amber-50 text-amber-800 ring-amber-200">{items.length} menunggu</span></div>
      <div className="hidden grid-cols-[minmax(0,1fr)_170px_150px_130px] gap-4 bg-muted/60 px-6 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground md:grid"><span>Desa</span><span>Pengajuan</span><span>Kelengkapan</span><span>Aksi</span></div>
      <div className="divide-y divide-border">{loading && !items.length ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={18} />Memuat pengajuan…</div> : items.length ? items.map((item) => <div key={item.id} className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_170px_150px_130px] md:items-center md:px-6"><div><p className="font-semibold text-brand">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{String(item.metadata?.district || "Kecamatan belum diisi")} · {String(item.metadata?.regency || "Kabupaten belum diisi")}</p></div><p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 size={15} />{item.activation_requested_at ? new Date(item.activation_requested_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</p><span className={`inline-flex items-center gap-1 text-sm font-semibold ${item.profile_complete ? "text-emerald-700" : "text-amber-700"}`}><CheckCircle2 size={16} />{item.profile_complete ? "Lengkap" : "Belum lengkap"}</span><Link href={`/admin/villages/${item.id}`} className="ui-primary px-4">Periksa <ArrowRight size={15} /></Link></div>) : <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center"><span className="flex size-12 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><ClipboardCheck size={24} /></span><h3 className="mt-4 font-bold">Tidak ada antrean aktivasi</h3><p className="mt-2 text-sm text-muted-foreground">Semua pengajuan desa sudah diperiksa.</p></div>}</div>
    </section>
  </div>;
}
