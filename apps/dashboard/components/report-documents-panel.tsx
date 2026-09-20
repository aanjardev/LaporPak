"use client";

import { Download, FileCheck2, LoaderCircle, RefreshCw, RotateCcw, ShieldX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getReportDocuments, retryReportDocument, reviseReportDocument, revokeReportDocument,
  type ReportDocument,
} from "@/lib/report-documents";

const labels = { receipt: "Bukti Penerimaan Laporan", verified: "Laporan Terverifikasi" };
const statuses = { pending: "Sedang dibuat", ready: "Siap", failed: "Gagal", replaced: "Digantikan", revoked: "Dicabut" };

export function ReportDocumentsPanel({ reportId, disabled = false }: { reportId: string; disabled?: boolean }) {
  const [items, setItems] = useState<ReportDocument[]>([]);
  const [loading, setLoading] = useState(!disabled);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (disabled) return;
    setLoading(true); setError("");
    try { setItems((await getReportDocuments(reportId)).items); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Dokumen tidak dapat dimuat"); }
    finally { setLoading(false); }
  }, [disabled, reportId]);

  useEffect(() => {
    if (disabled) return;
    let active = true;
    getReportDocuments(reportId)
      .then((result) => { if (active) setItems(result.items); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Dokumen tidak dapat dimuat"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [disabled, reportId]);

  async function act(id: string, action: () => Promise<unknown>) {
    setWorking(id); setError("");
    try { await action(); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Tindakan dokumen gagal"); }
    finally { setWorking(null); }
  }

  if (disabled) return null;
  return <section aria-labelledby="dokumen-laporan" className="ui-panel p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="dokumen-laporan" className="text-lg font-semibold">Dokumen Laporan</h2><p className="mt-1 text-sm text-muted-foreground">PDF privat dengan QR verifikasi untuk warga dan petugas.</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold text-brand"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Perbarui</button></div>
    {error && <p role="alert" className="ui-alert-error mt-4 border p-3 text-sm text-rose-900">{error}</p>}
    {loading && items.length === 0 ? <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />Memuat dokumen…</p> : items.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">Dokumen belum tersedia. Lengkapi kop desa bila pembuatan tertunda.</p> : <ul className="mt-5 space-y-3">{items.map((document) => <li key={document.id} className="rounded-lg border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-brand"><FileCheck2 size={19} /></span><div><p className="font-semibold">{labels[document.document_type]}</p><p className="mt-1 text-xs text-muted-foreground">Versi {document.version} · {statuses[document.status]} · Pengiriman {document.delivery_status}</p>{document.revocation_reason && <p className="mt-2 text-xs text-rose-700">{document.revocation_reason}</p>}</div></div><div className="flex flex-wrap gap-2">{["ready", "replaced"].includes(document.status) && <a href={`/api/reports/${reportId}/documents/${document.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold text-brand"><Download size={15} />Unduh</a>}{["failed", "ready"].includes(document.status) && document.delivery_status !== "sent" && <button type="button" disabled={working === document.id} onClick={() => void act(document.id, () => retryReportDocument(reportId, document.id))} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold"><RefreshCw size={15} />Coba lagi</button>}{document.status === "ready" && <button type="button" disabled={working === document.id} onClick={() => { const reason = window.prompt("Alasan menerbitkan revisi:"); if (reason?.trim()) void act(document.id, () => reviseReportDocument(reportId, document.document_type, reason.trim())); }} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold"><RotateCcw size={15} />Revisi</button>}{document.status === "ready" && <button type="button" disabled={working === document.id} onClick={() => { const reason = window.prompt("Alasan pencabutan dokumen:"); if (reason?.trim()) void act(document.id, () => revokeReportDocument(reportId, document.id, reason.trim())); }} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700"><ShieldX size={15} />Cabut</button>}</div></div></li>)}</ul>}
  </section>;
}
