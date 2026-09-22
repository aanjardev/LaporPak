"use client";

import { CheckCircle2, ClipboardCheck, LoaderCircle, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { InlineFeedback, SlowStatus, useToast } from "@/components/action-feedback";
import {
  approveReferral,
  dispatchReferral,
  getReportReferrals,
  getRoutingOptions,
  reconcileReferral,
  type ReferralProgress,
  type RoutingOption,
} from "@/lib/referrals";

const dispatchLabels: Record<ReferralProgress["dispatch_status"], string> = {
  draft: "Draft",
  awaiting_approval: "Menunggu persetujuan",
  approved: "Disetujui, belum dikirim",
  queued: "Masuk antrean",
  sending: "Sedang dikirim",
  sent: "Terkirim ke kanal simulasi",
  delivery_unknown: "Pengiriman perlu diperiksa",
  failed: "Pengiriman gagal",
  cancelled: "Dibatalkan",
};

const registrationLabels: Record<ReferralProgress["registration_status"], string> = {
  unverified: "Belum terverifikasi",
  pending: "Menunggu pendaftaran",
  registered: "Terdaftar",
  rejected: "Ditolak penerima",
};

const handlingLabels: Record<ReferralProgress["handling_status"], string> = {
  unassigned: "Belum ditangani",
  awaiting_acceptance: "Menunggu penerimaan",
  accepted: "Diterima penerima",
  in_progress: "Sedang ditangani",
  declined: "Ditolak penerima",
  completed: "Selesai di penerima",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-semibold text-foreground">{value}</dd></div>;
}

function ReferralCard({
  item,
  working,
  onApprove,
  onDispatch,
  onReconcile,
}: {
  item: ReferralProgress;
  working: string | null;
  onApprove: (item: ReferralProgress) => void;
  onDispatch: (item: ReferralProgress) => void;
  onReconcile: (item: ReferralProgress) => void;
}) {
  const hash = `${item.package_hash.slice(0, 12)}…`;
  return <li className="rounded-lg border border-border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-brand"><Send size={18} aria-hidden="true" /></span><div className="min-w-0"><p className="font-semibold">{item.target_name}</p><p className="mt-1 break-words text-sm text-muted-foreground">{item.channel_name}{item.is_simulated ? " · Simulasi" : ""}</p></div></div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.dispatch_status === "sent" ? "bg-emerald-100 text-emerald-800" : item.dispatch_status === "failed" || item.dispatch_status === "delivery_unknown" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{dispatchLabels[item.dispatch_status]}</span>
    </div>
    <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
      <StatusLine label="Registrasi" value={registrationLabels[item.registration_status]} />
      <StatusLine label="Penanganan" value={handlingLabels[item.handling_status]} />
      <StatusLine label="Paket" value={`v${item.active_package_version} · ${hash}`} />
      {item.external_reference && <StatusLine label="Referensi penerima" value={item.external_reference} />}
      <StatusLine label="Diperbarui" value={formatDate(item.updated_at)} />
    </dl>
    {item.evidence_reference && <p className="mt-3 break-words text-xs text-muted-foreground">Bukti: {item.evidence_reference}</p>}
    {item.package_snapshot && <div className="mt-4 rounded-md bg-muted p-3 text-sm leading-6"><p className="font-semibold text-brand">Isi paket yang disetujui</p><dl className="mt-2 space-y-2"><div><dt className="font-semibold text-muted-foreground">Ringkasan</dt><dd className="whitespace-pre-wrap break-words">{item.package_snapshot.summary}</dd></div><div><dt className="font-semibold text-muted-foreground">Kronologi</dt><dd className="whitespace-pre-wrap break-words">{item.package_snapshot.chronology}</dd></div><div><dt className="font-semibold text-muted-foreground">Tindakan diminta</dt><dd className="whitespace-pre-wrap break-words">{item.package_snapshot.requested_action}</dd></div><div><dt className="font-semibold text-muted-foreground">Lampiran</dt><dd>{item.package_snapshot.attachment_count} lampiran · identitas warga {item.package_snapshot.share_citizen_identity ? "dibagikan sesuai paket" : "tidak dibagikan"}</dd></div></dl></div>}
    {item.next_action && <p className="mt-3 rounded-md bg-muted p-3 text-sm leading-6 text-brand"><strong>Langkah berikutnya:</strong> {item.next_action}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      {item.dispatch_status === "awaiting_approval" && <button type="button" onClick={() => onApprove(item)} disabled={working !== null} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-3 text-sm font-semibold text-white disabled:opacity-60"><ClipboardCheck size={16} aria-hidden="true" />Setujui paket</button>}
      {item.dispatch_status === "approved" && <button type="button" onClick={() => onDispatch(item)} disabled={working !== null} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-3 text-sm font-semibold text-white disabled:opacity-60"><Send size={16} aria-hidden="true" />Kirim ke kanal</button>}
      {item.dispatch_status === "delivery_unknown" && <button type="button" onClick={() => onReconcile(item)} disabled={working !== null} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold text-brand disabled:opacity-60"><RefreshCw size={16} aria-hidden="true" />Periksa hasil kirim</button>}
    </div>
    {working === item.id && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />Menyimpan tindakan…</p>}
  </li>;
}

export function ReportReferralPanel({ reportId, reportStatus, disabled = false }: { reportId: string; reportStatus: string; disabled?: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<ReferralProgress[]>([]);
  const [candidates, setCandidates] = useState<RoutingOption[]>([]);
  const [needsReview, setNeedsReview] = useState(false);
  const [loading, setLoading] = useState(!disabled);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pollingStopped, setPollingStopped] = useState(false);
  const [approvalItem, setApprovalItem] = useState<ReferralProgress | null>(null);
  const [dispatchItem, setDispatchItem] = useState<ReferralProgress | null>(null);
  const operationKeys = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  const pollStartedAt = useRef<number | null>(null);

  const refresh = useCallback(async (manual = false) => {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    if (manual) setRefreshing(true);
      setError("");
    try {
      const result = await getReportReferrals(reportId);
      setItems(result);
      setPollingStopped(false);
      if (result.length === 0 && reportStatus === "in_progress") {
        const routing = await getRoutingOptions(reportId);
        setCandidates(routing.items);
        setNeedsReview(routing.needs_review);
      } else {
        setCandidates([]);
        setNeedsReview(false);
      }
      pollStartedAt.current = result.some((item) => ["queued", "sending"].includes(item.dispatch_status)) ? (pollStartedAt.current ?? Date.now()) : null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Referral belum dapat dimuat. Data terakhir tetap ditampilkan.");
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [disabled, reportId, reportStatus]);

  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    getReportReferrals(reportId, controller.signal)
      .then(async (result) => {
        setItems(result);
        if (result.length === 0 && reportStatus === "in_progress") {
          const routing = await getRoutingOptions(reportId, controller.signal);
          setCandidates(routing.items);
          setNeedsReview(routing.needs_review);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Referral belum dapat dimuat.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [disabled, reportId, reportStatus]);

  useEffect(() => {
    const active = items.some((item) => ["queued", "sending"].includes(item.dispatch_status));
    if (!active) { pollStartedAt.current = null; return; }
    pollStartedAt.current ??= Date.now();
    if (Date.now() - pollStartedAt.current >= 120_000) { setPollingStopped(true); return; }
    const timer = window.setTimeout(() => { if (document.visibilityState === "visible") void refresh(); }, 5_000);
    return () => window.clearTimeout(timer);
  }, [items, refresh]);

  async function perform(id: string, action: () => Promise<unknown>, success: string) {
    setWorking(id);
    setError("");
    try {
      await action();
      toast({ kind: "success", title: success });
      await refresh(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tindakan referral belum tersimpan. Periksa status terbaru sebelum mencoba lagi.");
    } finally {
      setWorking(null);
    }
  }

  if (disabled) return null;
  return <section aria-labelledby="rujukan-laporan" className="ui-panel p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="rujukan-laporan" className="text-lg font-semibold">Rujukan laporan</h2><p className="mt-1 text-sm text-muted-foreground">Paket, persetujuan petugas, dan progres penerima ditampilkan terpisah.</p></div><button type="button" onClick={() => void refresh(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold text-brand disabled:opacity-60"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />{refreshing ? "Memperbarui…" : "Perbarui"}</button></div>
    {error && <div className="mt-4"><InlineFeedback kind="error" title="Rujukan belum dapat diperbarui" detail={error} action={<button type="button" onClick={() => void refresh(true)} className="min-h-11 font-semibold underline underline-offset-4">Coba periksa lagi</button>} /></div>}
    {pollingStopped && <div className="mt-4"><InlineFeedback kind="warning" title="Pemeriksaan otomatis dihentikan" detail="Proses dapat tetap berjalan. Periksa status secara manual agar tidak mengirim ulang paket yang sama." action={<button type="button" onClick={() => { pollStartedAt.current = Date.now(); setPollingStopped(false); void refresh(true); }} className="min-h-11 font-semibold underline underline-offset-4">Periksa sekarang</button>} /></div>}
    {loading ? <p role="status" className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin" />Memuat progres rujukan…</p> : items.length > 0 ? <ul className="mt-5 space-y-3">{items.map((item) => <ReferralCard key={item.id} item={item} working={working} onApprove={setApprovalItem} onDispatch={setDispatchItem} onReconcile={(current) => void perform(current.id, () => reconcileReferral(current.id), "Hasil pengiriman diperbarui")} />)}</ul> : <div className="mt-5 space-y-3"><p className="text-sm text-muted-foreground">Belum ada paket rujukan untuk laporan ini.</p>{reportStatus !== "in_progress" ? <p className="rounded-md bg-muted p-3 text-sm leading-6 text-brand">Rujukan hanya dapat disiapkan ketika laporan sedang dalam penanganan.</p> : candidates.length === 0 ? <p className={`rounded-md p-3 text-sm leading-6 ${needsReview ? "bg-amber-50 text-amber-950" : "bg-muted text-brand"}`}>{needsReview ? "Belum ada kandidat kanal yang tersedia. Tinjau tujuan secara manual." : "Kandidat rujukan belum tersedia."}</p> : <div><p className="text-sm font-semibold">Kandidat kanal yang tersedia</p><ul className="mt-2 space-y-2">{candidates.map((candidate) => <li key={candidate.channel_id} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"><CheckCircle2 size={16} className="shrink-0 text-emerald-700" aria-hidden="true" /><span>{candidate.target_name} · {candidate.channel_name}{candidate.is_simulated ? " · Simulasi" : ""}</span></li>)}</ul><p className="mt-3 text-xs leading-5 text-muted-foreground">Pembuatan paket dilakukan melalui alur operator yang berwenang; kandidat ini berasal dari backend.</p></div>}</div>}
    <SlowStatus active={working !== null} />
    <ConfirmationDialog open={approvalItem !== null} onOpenChange={(open) => { if (!open) setApprovalItem(null); }} title="Setujui paket rujukan?" description={approvalItem ? `Paket v${approvalItem.active_package_version} untuk ${approvalItem.target_name} akan dapat dikirim setelah persetujuan ini.` : ""} confirmLabel="Setujui paket" reasonLabel="Alasan persetujuan" reasonRequired pending={approvalItem ? working === approvalItem.id : false} onConfirm={async (reason) => { if (!approvalItem) return; const current = approvalItem; await perform(current.id, () => approveReferral(current.id, { package_version: current.active_package_version, package_hash: current.package_hash, reason }), "Paket rujukan disetujui"); setApprovalItem(null); }} />
    <ConfirmationDialog open={dispatchItem !== null} onOpenChange={(open) => { if (!open) setDispatchItem(null); }} title="Kirim paket rujukan?" description={dispatchItem ? `Paket v${dispatchItem.active_package_version} akan masuk antrean kanal ${dispatchItem.channel_name}. Hasil penerima tetap perlu dipantau dari status backend.` : ""} confirmLabel="Kirim ke kanal" pending={dispatchItem ? working === dispatchItem.id : false} onConfirm={async () => { if (!dispatchItem) return; const current = dispatchItem; const operationKey = operationKeys.current.get(current.id) ?? crypto.randomUUID(); operationKeys.current.set(current.id, operationKey); await perform(current.id, () => dispatchReferral(current.id, operationKey), "Permintaan pengiriman masuk antrean"); setDispatchItem(null); }} />
  </section>;
}
