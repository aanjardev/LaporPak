"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { decideActivation } from "@/lib/admin";
import { getVillage, type VillageDetail } from "@/lib/villages";

export default function SuperAdminVillagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => { getVillage(id).then(setVillage).catch((cause) => setError(cause.message)); }, [id]);
  async function decide(status: "approved" | "changes_requested") {
    setPending(true); setError("");
    try { await decideActivation(id, status, reason); setVillage(await getVillage(id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Keputusan gagal"); }
    finally { setPending(false); }
  }
  if (error && !village) return <p className="ui-alert-error p-4">{error}</p>;
  if (!village) return <p className="text-sm text-muted-foreground">Memuat profil desa…</p>;
  const m = village.metadata;
  return <div className="mx-auto max-w-6xl"><Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-brand"><ArrowLeft size={16} />Kembali</Link>
    <div className="mt-5 rounded-xl border border-border bg-card p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-brand">Pemeriksaan aktivasi</p><h1 className="mt-1 text-3xl font-bold">{village.name}</h1><p className="mt-2 text-sm text-muted-foreground">{m.village_code || "Tanpa kode"} · {m.district || "-"}, {m.regency || "-"}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{village.activation_status.replaceAll("_", " ")}</span></div></div>
    {error && <p className="ui-alert-error mt-5 px-4 py-3 text-sm">{error}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-xl border border-border bg-card p-5"><h2 className="font-bold">Profil dan kesiapan</h2><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><Item label="Provinsi" value={m.province} /><Item label="Kabupaten/Kota" value={m.regency} /><Item label="Kecamatan" value={m.district} /><Item label="Kontak layanan" value={m.contact_phone} /><Item label="Jam pelayanan" value={m.office_hours} /><Item label="Alamat kantor" value={m.address} /></dl></section>
      <section className="rounded-xl border border-border bg-card p-5"><h2 className="font-bold">Kesehatan layanan</h2><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="REPORT" value={village.stats.total_reports} /><Metric label="REQUEST" value={village.stats.total_requests} /><Metric label="Knowledge" value={village.stats.knowledge_documents} /><Metric label="WhatsApp" value={village.stats.whatsapp_connected ? "Terhubung" : "Tidak terhubung"} /></div></section></div>
    <section className="mt-6 rounded-xl border border-border bg-card p-5"><h2 className="font-bold">Ringkasan status</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><StatusCounts title="REPORT" values={village.stats.report_status_counts} /><StatusCounts title="REQUEST" values={village.stats.request_status_counts} /></div></section>
    {village.activation_status === "pending_review" && <section className="mt-6 rounded-xl border border-border bg-card p-5"><h2 className="font-bold">Keputusan aktivasi</h2><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Alasan wajib saat mengembalikan pengajuan" className="ui-control mt-4 min-h-24 p-3" /><div className="mt-4 flex flex-wrap gap-3"><button disabled={pending} onClick={() => decide("approved")} className="ui-primary gap-2"><CheckCircle2 size={17} />Setujui desa</button><button disabled={pending || reason.trim().length < 3} onClick={() => decide("changes_requested")} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50"><XCircle size={17} />Kembalikan</button></div></section>}
  </div>;
}

function Item({ label, value }: { label: string; value?: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value || "Belum diisi"}</dd></div>; }
function Metric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-lg bg-muted p-4"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>; }
function StatusCounts({ title, values }: { title: string; values: Record<string, number> }) { return <div className="rounded-lg border border-border p-4"><p className="text-sm font-bold">{title}</p><div className="mt-3 flex flex-wrap gap-2">{Object.keys(values).length ? Object.entries(values).map(([key, value]) => <span key={key} className="rounded-full bg-muted px-3 py-1 text-xs">{key.replaceAll("_", " ")}: {value}</span>) : <span className="text-xs text-muted-foreground">Belum ada data</span>}</div></div>; }
