"use client";

import { Download, FileCheck2, LoaderCircle, RefreshCw, RotateCcw, ShieldX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { InlineFeedback, SlowStatus, useToast } from "@/components/action-feedback";
import {
  createReceiptDocument, getReportDocuments, retryReportDocument, reviseReportDocument, revokeReportDocument,
  type ReportDocument,
} from "@/lib/report-documents";

const labels = { receipt: "Bukti Penerimaan Laporan", verified: "Laporan Terverifikasi" };
const statuses = { pending: "Sedang dibuat", ready: "Siap diunduh", failed: "Pembuatan gagal", replaced: "Digantikan versi baru", revoked: "Dicabut" };
const deliveries = { pending: "Menunggu pengiriman WhatsApp", sent: "Terkirim melalui WhatsApp", failed: "Pengiriman WhatsApp gagal", unknown: "Pengiriman perlu diperiksa" };

type DocumentDialog = { action: "revise" | "revoke"; document: ReportDocument } | null;

export function ReportDocumentsPanel({ reportId, disabled = false }: { reportId: string; disabled?: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<ReportDocument[]>([]);
  const [loading, setLoading] = useState(!disabled);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pollingStopped, setPollingStopped] = useState(false);
  const [dialog, setDialog] = useState<DocumentDialog>(null);
  const pollStartedAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  const previous = useRef<Map<string, ReportDocument["status"]> | null>(null);

  const applyItems = useCallback((next: ReportDocument[]) => {
    if (previous.current) {
      for (const document of next) {
        if (previous.current.get(document.id) === "pending" && document.status === "ready") {
          toast({ kind: "success", title: `${labels[document.document_type]} siap`, detail: "Dokumen sekarang dapat diunduh." });
        }
      }
    }
    previous.current = new Map(next.map((document) => [document.id, document.status]));
    setItems(next);
  }, [toast]);

  const refresh = useCallback(async (manual = false) => {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    if (manual) setRefreshing(true);
    setError("");
    try { applyItems((await getReportDocuments(reportId)).items); setPollingStopped(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Dokumen tidak dapat dimuat. Data terakhir tetap ditampilkan."); }
    finally { inFlight.current = false; setLoading(false); setRefreshing(false); }
  }, [applyItems, disabled, reportId]);

  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    getReportDocuments(reportId, controller.signal)
      .then((result) => applyItems(result.items))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Dokumen tidak dapat dimuat"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [applyItems, disabled, reportId]);

  useEffect(() => {
    const hasPending = items.some((document) => document.status === "pending");
    if (!hasPending) { pollStartedAt.current = null; return; }
    pollStartedAt.current ??= Date.now();
    if (Date.now() - pollStartedAt.current >= 120_000) { setPollingStopped(true); return; }
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [items, refresh]);

  async function act(id: string, action: () => Promise<ReportDocument>, success: string) {
    setWorking(id); setError("");
    try {
      const document = await action();
      setItems((current) => {
        const exists = current.some((item) => item.id === document.id);
        const next = exists ? current.map((item) => item.id === document.id ? document : item) : [document, ...current];
        previous.current = new Map(next.map((item) => [item.id, item.status]));
        return next;
      });
      toast({ kind: "success", title: success });
      try { await refresh(); }
      catch { setError("Tindakan diterima, tetapi tampilan terbaru belum dapat dimuat. Gunakan Perbarui; jangan kirim ulang tindakan."); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tindakan dokumen gagal"); }
    finally { setWorking(null); }
  }

  async function download(document: ReportDocument) {
    const id = `download-${document.id}`;
    setWorking(id); setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(`/api/reports/${reportId}/documents/${document.id}`, { signal: controller.signal });
      if (!response.ok) throw new Error("PDF belum dapat disiapkan. Coba lagi.");
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a");
      link.href = url; link.download = `${labels[document.document_type]}-v${document.version}.pdf`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast({ kind: "info", title: "Unduhan dimulai", detail: "Periksa daftar unduhan browser untuk memastikan file tersimpan." });
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "AbortError" ? "PDF belum selesai disiapkan dalam 60 detik. Coba lagi." : reason instanceof Error ? reason.message : "PDF gagal disiapkan.");
    } finally { window.clearTimeout(timer); setWorking(null); }
  }

  if (disabled) return null;
  return <section aria-labelledby="dokumen-laporan" className="ui-panel p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="dokumen-laporan" className="text-lg font-semibold">Dokumen Laporan</h2><p className="mt-1 text-sm text-muted-foreground">Status PDF dan pengiriman WhatsApp ditampilkan terpisah.</p></div><button type="button" onClick={() => void refresh(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold text-brand disabled:opacity-60"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />{refreshing ? "Memperbarui…" : "Perbarui"}</button></div>
    {error && <div className="mt-4"><InlineFeedback kind="error" title="Dokumen belum dapat diperbarui" detail={error} action={<button type="button" onClick={() => void refresh(true)} className="min-h-11 font-semibold underline underline-offset-4">Coba periksa lagi</button>} /></div>}
    {pollingStopped && <div className="mt-4"><InlineFeedback kind="warning" title="Pembuatan masih berlangsung" detail="Pemeriksaan otomatis dihentikan setelah dua menit. Proses dapat tetap berjalan." action={<button type="button" onClick={() => { pollStartedAt.current = Date.now(); void refresh(true); }} className="min-h-11 font-semibold underline underline-offset-4">Periksa sekarang</button>} /></div>}
    {loading && items.length === 0 ? <p role="status" className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />Memuat dokumen…</p> : items.length === 0 ? <div className="mt-5"><p className="text-sm text-muted-foreground">Dokumen belum tersedia. Buat bukti penerimaan untuk laporan ini.</p><button type="button" disabled={working === "new-receipt"} onClick={() => void act("new-receipt", () => createReceiptDocument(reportId), "Pembuatan PDF dijadwalkan")} className="ui-primary mt-4">{working === "new-receipt" ? <LoaderCircle size={16} className="animate-spin" /> : <FileCheck2 size={16} />}{working === "new-receipt" ? "Menjadwalkan…" : "Buat PDF penerimaan"}</button></div> : <ul className="mt-5 space-y-3">{items.map((document) => <li key={document.id} className="rounded-lg border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-brand"><FileCheck2 size={19} /></span><div><p className="font-semibold">{labels[document.document_type]}</p><dl className="mt-2 space-y-1 text-xs text-muted-foreground"><div><dt className="inline font-semibold">PDF:</dt> <dd className="inline">{statuses[document.status]}</dd></div><div><dt className="inline font-semibold">WhatsApp:</dt> <dd className="inline">{deliveries[document.delivery_status]}</dd></div><div><dt className="inline font-semibold">Versi:</dt> <dd className="inline">{document.version}</dd></div></dl>{document.revocation_reason && <p className="mt-2 text-xs text-rose-700">Alasan: {document.revocation_reason}</p>}</div></div><div className="flex flex-wrap gap-2">{["ready", "replaced"].includes(document.status) && <button type="button" onClick={() => void download(document)} disabled={working === `download-${document.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold text-brand">{working === `download-${document.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}{working === `download-${document.id}` ? "Menyiapkan…" : "Unduh"}</button>}{["failed", "ready"].includes(document.status) && document.delivery_status !== "sent" && <button type="button" disabled={working === document.id} onClick={() => void act(document.id, () => retryReportDocument(reportId, document.id), "Pemrosesan ulang dijadwalkan")} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold"><RefreshCw size={15} />Coba lagi</button>}{document.status === "ready" && <button type="button" disabled={working === document.id} onClick={() => setDialog({ action: "revise", document })} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold"><RotateCcw size={15} />Revisi</button>}{document.status === "ready" && <button type="button" disabled={working === document.id} onClick={() => setDialog({ action: "revoke", document })} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700"><ShieldX size={15} />Cabut</button>}</div></div></li>)}</ul>}
    <SlowStatus active={working !== null} />
    <ConfirmationDialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }} title={dialog?.action === "revoke" ? "Cabut dokumen ini?" : "Terbitkan revisi dokumen?"} description={dialog?.action === "revoke" ? "QR dokumen akan ditandai dicabut. File lama tetap tercatat dalam audit." : "Sistem membuat versi baru dan menandai versi lama sebagai digantikan."} confirmLabel={dialog?.action === "revoke" ? "Cabut dokumen" : "Terbitkan revisi"} tone={dialog?.action === "revoke" ? "danger" : "default"} reasonLabel={dialog?.action === "revoke" ? "Alasan pencabutan" : "Alasan revisi"} reasonRequired pending={dialog ? working === dialog.document.id : false} onConfirm={async (reason) => { if (!dialog) return; const current = dialog; await act(current.document.id, () => current.action === "revoke" ? revokeReportDocument(reportId, current.document.id, reason) : reviseReportDocument(reportId, current.document.document_type, reason), current.action === "revoke" ? "Dokumen dicabut" : "Pembuatan revisi dijadwalkan"); setDialog(null); }} />
  </section>;
}
