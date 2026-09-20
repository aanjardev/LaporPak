"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, FileSearch, ShieldAlert } from "lucide-react";
import { InlineFeedback, SlowStatus } from "@/components/action-feedback";

type Verification = { valid: boolean; ticket_number: string; document_type: "receipt" | "verified"; version: number; village_name: string; issued_at: string | null; status: string; file_sha256: string | null };
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function VerifyDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  const [hashResult, setHashResult] = useState<"" | "match" | "mismatch">("");
  const [hashing, setHashing] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    fetch(`${API_BASE_URL}/api/v1/verify/${token}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(response.status === 404 ? "Dokumen tidak ditemukan." : "Verifikasi belum dapat dimuat."); setData(await response.json()); })
      .catch((reason) => { if (!active) return; if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Verifikasi gagal"); else setError("Pemeriksaan melewati batas waktu. Muat ulang untuk mencoba lagi."); })
      .finally(() => window.clearTimeout(timer));
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [token]);
  async function inspect(file: File) {
    setHashing(true); setHashResult("");
    try { const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map((value) => value.toString(16).padStart(2, "0")).join(""); setHashResult(digest === data?.file_sha256 ? "match" : "mismatch"); }
    finally { setHashing(false); }
  }
  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-12"><div className="ui-panel overflow-hidden"><div className="bg-brand p-6 text-white"><p className="text-sm font-semibold text-brand-accent">LaporPak</p><h1 className="mt-2 text-2xl font-bold">Verifikasi dokumen digital</h1></div><div className="p-6">{error ? <InlineFeedback kind="error" title="Dokumen belum dapat diperiksa" detail={error} action={<button type="button" onClick={() => window.location.reload()} className="min-h-11 font-semibold underline underline-offset-4">Coba lagi</button>} /> : !data ? <div role="status"><p>Memeriksa token {token.slice(0, 8)}…</p><SlowStatus active /></div> : <><div className={`flex gap-3 ${data.valid ? "text-emerald-700" : "text-amber-800"}`}>{data.valid ? <CheckCircle2 /> : <ShieldAlert />}<div><p className="font-bold">{data.valid ? "Rekaman dokumen berlaku" : `Dokumen ${data.status}`}</p><p className="mt-1 text-sm">QR membuktikan adanya rekaman penerbitan di LaporPak.</p></div></div><dl className="mt-6 grid gap-4 rounded-lg bg-muted p-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Desa penerbit</dt><dd className="font-semibold">{data.village_name}</dd></div><div><dt className="text-xs text-muted-foreground">Nomor laporan</dt><dd className="font-semibold">{data.ticket_number}</dd></div><div><dt className="text-xs text-muted-foreground">Jenis</dt><dd className="font-semibold">{data.document_type === "receipt" ? "Bukti Penerimaan" : "Laporan Terverifikasi"}</dd></div><div><dt className="text-xs text-muted-foreground">Versi</dt><dd className="font-semibold">{data.version}</dd></div></dl><div className="mt-6 border-t border-border pt-6"><h2 className="flex items-center gap-2 font-bold"><FileSearch size={19} />Periksa keutuhan PDF</h2><p className="mt-2 text-sm text-muted-foreground">Pilih salinan PDF. Pemeriksaan SHA-256 dilakukan di browser; file tidak diunggah.</p><input type="file" accept="application/pdf" disabled={hashing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspect(file); }} className="mt-4 block min-h-11 w-full text-sm" />{hashing && <p role="status" className="mt-3 text-sm text-muted-foreground">Menghitung hash file…</p>}{hashResult && <p role={hashResult === "match" ? "status" : "alert"} className={`mt-3 text-sm font-semibold ${hashResult === "match" ? "text-emerald-700" : "text-rose-700"}`}>{hashResult === "match" ? "Hash cocok. File sama dengan rekaman penerbitan." : "Hash tidak cocok. File berbeda atau telah diubah."}</p>}</div></>}</div></div></main>;
}
