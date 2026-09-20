"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, MessageCircleWarning } from "lucide-react";
import { getActivationQueue, getMonitoring, type VillageMonitoring } from "@/lib/admin";

export function AdminDashboard() {
  const [queue, setQueue] = useState<VillageMonitoring[]>([]);
  const [villages, setVillages] = useState<VillageMonitoring[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([getActivationQueue(), getMonitoring()]).then(([a, b]) => { setQueue(a.items); setVillages(b.items); }).catch((reason) => setError(reason.message)); }, []);
  return <div className="mx-auto max-w-7xl space-y-10">
    <div><p className="text-sm font-semibold text-brand">Kendali layanan</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Aktivasi dan monitoring desa</h1><p className="mt-2 text-sm text-muted-foreground">Ringkasan operasional tanpa identitas, lampiran, atau detail warga.</p></div>
    {error && <p className="ui-alert-error px-4 py-3 text-sm">{error}</p>}
    <section id="aktivasi"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Aktivasi Desa</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{queue.length} menunggu</span></div><div className="mt-4 overflow-hidden rounded-xl border border-border bg-card"><TableHeader /><div className="divide-y divide-border">{queue.length ? queue.map((item) => <VillageRow key={item.id} item={item} />) : <p className="p-6 text-sm text-muted-foreground">Tidak ada pengajuan yang menunggu.</p>}</div></div></section>
    <section id="monitoring"><h2 className="text-xl font-bold">Monitoring Desa</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{villages.map((item) => <Link key={item.id} href={`/admin/villages/${item.id}`} className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.activation_status.replaceAll("_", " ")}</p></div>{item.whatsapp_connected ? <CheckCircle2 className="text-emerald-600" size={20} /> : <MessageCircleWarning className="text-amber-600" size={20} />}</div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><Metric value={item.total_reports} label="REPORT" /><Metric value={item.total_requests} label="REQUEST" /><Metric value={item.knowledge_documents} label="ASK" /></div></Link>)}</div></section>
  </div>;
}

function TableHeader() { return <div className="hidden grid-cols-[1fr_140px_160px] gap-4 bg-muted/60 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid"><span>Desa</span><span>Kelengkapan</span><span>Aksi</span></div>; }
function VillageRow({ item }: { item: VillageMonitoring }) { return <div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_140px_160px] md:items-center"><div><p className="font-semibold">{item.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={13} />{item.activation_requested_at ? new Date(item.activation_requested_at).toLocaleDateString("id-ID") : "-"}</p></div><span className={`text-sm font-semibold ${item.profile_complete ? "text-emerald-700" : "text-amber-700"}`}>{item.profile_complete ? "Lengkap" : "Belum lengkap"}</span><Link href={`/admin/villages/${item.id}`} className="ui-primary justify-center">Periksa</Link></div>; }
function Metric({ value, label }: { value: number; label: string }) { return <div className="rounded-lg bg-muted p-2"><p className="text-xl font-bold">{value}</p><p className="text-[10px] font-semibold text-muted-foreground">{label}</p></div>; }
