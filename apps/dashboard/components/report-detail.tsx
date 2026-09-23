"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, MapPin, UserRound } from "lucide-react";
import { saveReportDecision } from "@/app/reports/[id]/actions";
import { categoryLabels, formatLocation, formatReportDate, StatusBadge, statusLabels, urgencyLabels } from "@/components/report-display";
import type { ReportAttachment, ReportDetail, ReportStatus } from "@/lib/reports";
import { ReportDocumentsPanel } from "@/components/report-documents-panel";
import { ReportReferralPanel } from "@/components/report-referral-panel";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { SlowStatus, useToast } from "@/components/action-feedback";
import { LazyPanel } from "@/components/lazy-panel";

function ReportPhoto({ attachment, reportId, ticketNumber, index, isMock }: {
  attachment: ReportAttachment;
  reportId: string;
  ticketNumber: string;
  index: number;
  isMock: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = `/api/reports/${encodeURIComponent(reportId)}/attachments/${encodeURIComponent(attachment.id)}`;
  const supported = ["image/jpeg", "image/png", "image/webp"].includes(attachment.mime_type ?? "");

  return (
    <li className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      <div className="relative aspect-[4/3] bg-muted">
        {supported && !failed ? (
          <Image
            src={src}
            alt={`Foto lampiran ${index + 1} untuk laporan ${ticketNumber}`}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <p role="status" className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Foto belum dapat ditampilkan. Muat ulang halaman untuk mencoba lagi.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
        <span className="min-w-0 break-all text-foreground">{attachment.file_name || `Foto ${index + 1}`}</span>
        {supported && !failed && (
          <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Buka foto
          </a>
        )}
      </div>
      <p className="px-3 pb-3 text-xs text-slate-600">
        {attachment.file_size.toLocaleString("id-ID")} byte · {formatReportDate(attachment.created_at)}
      </p>
      {isMock && <p className="px-3 pb-3 text-xs text-amber-900">Foto simulasi untuk uji tampilan.</p>}
    </li>
  );
}

export function ReportDetailView({ initialReport, actionsEnabled, isMock }: { initialReport: ReportDetail; actionsEnabled: boolean; isMock: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [report, setReport] = useState(initialReport);
  const [decision, setDecision] = useState<ReportStatus | "">("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "success" | "saved_unavailable" | "conflict" | "error">("idle");
  const saving = useRef(false);
  const confirmed = useRef(false);
  const decisionForm = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const availableActions = report.allowed_transitions;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !actionsEnabled || state === "saved_unavailable" || state === "conflict") return;
    if (!decision || !availableActions.includes(decision) || !reason.trim()) {
      setState("error");
      return;
    }
    if (!confirmed.current) { setConfirmOpen(true); return; }
    confirmed.current = false;

    saving.current = true;
    setState("saving");
    try {
      const result = await saveReportDecision(report.id, { status: decision, reason: reason.trim() }, isMock ? report.status : undefined);
      if (!result.ok) {
        if (result.status === 401) {
          router.replace(`/login?reauth=1&next=${encodeURIComponent(`/reports/${encodeURIComponent(report.id)}`)}`);
        } else if (result.status === 403) {
          router.replace("/access-denied");
        } else if (result.status === 404) {
          window.location.reload();
        } else {
          setState(result.status === 409 ? "conflict" : "error");
        }
        return;
      }
      if (isMock) {
        setReport((current) => ({
          ...current,
          status: result.data.status,
          updated_at: result.data.updated_at,
          verified_at: result.data.status === "verified" ? result.data.updated_at : current.verified_at,
          resolved_at: result.data.status === "resolved" ? result.data.updated_at : current.resolved_at,
          status_history: [
            ...current.status_history,
            {
              old_status: current.status,
              new_status: result.data.status,
              actor_type: "admin",
              actor_display_name: "Petugas",
              notes: reason.trim(),
              created_at: result.data.updated_at,
            },
          ],
        }));
      } else if (result.report) {
        setReport(result.report);
      } else {
        setState("saved_unavailable");
        return;
      }
      setDecision("");
      setReason("");
      setState("success");
      toast({ kind: "success", title: "Keputusan laporan tersimpan", detail: `Status ${report.ticket_number} sudah diperbarui.` });
    } catch {
      setState("error");
    } finally {
      saving.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/reports" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" size={17} /> Kembali ke daftar laporan</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2"><p className="text-sm font-semibold text-brand">Detail laporan</p><h1 className="break-words text-3xl font-bold tracking-tight text-foreground sm:text-3xl">{report.ticket_number}</h1><p className="text-sm text-muted-foreground">Dibuat <time dateTime={report.created_at}>{formatReportDate(report.created_at)}</time></p>{actionsEnabled && availableActions.length > 0 && <a href="#keputusan-petugas" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden">Lompat ke aksi petugas</a>}</div>
        <StatusBadge status={report.status} />
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="informasi-laporan" className="ui-panel p-5 sm:p-6">
            <h2 id="informasi-laporan" className="text-lg font-semibold">Informasi laporan</h2>
            <div className="mt-6 space-y-5">
              <div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deskripsi warga</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-foreground">{report.description}</p></div>
              <div className="border-t border-border pt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ringkasan bantuan AI</h3><p className="mt-2 break-words text-sm leading-7 text-foreground">{report.summary ?? "Ringkasan belum tersedia."}</p></div>
              <dl className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kategori</dt><dd className="mt-2 text-sm font-medium">{categoryLabels[report.category]}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Urgensi (rekomendasi)</dt><dd className="mt-2 text-sm font-medium">{urgencyLabels[report.urgency]}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><MapPin aria-hidden="true" size={15} /> Lokasi</dt><dd className="mt-2 break-words text-sm font-medium">{formatLocation(report.location)}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><UserRound aria-hidden="true" size={15} /> Pelapor</dt><dd className="mt-2 text-sm font-medium">{report.citizen.display_name}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unit penanggung jawab</dt><dd className="mt-2 break-words text-sm font-medium">{report.responsible_unit?.name ?? "Belum ditetapkan"}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Foto laporan</dt><dd className="mt-2 text-sm font-medium">{report.attachments.length === 0 ? "Belum ada foto" : `${report.attachments.length} foto`}</dd></div>
              </dl>
            </div>
          </section>
          <section aria-labelledby="foto-laporan" className="ui-panel p-5 sm:p-6">
            <h2 id="foto-laporan" className="text-lg font-semibold">Foto laporan</h2>
            {report.attachments.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Belum ada foto pada laporan ini.</p>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {report.attachments.map((attachment, index) => (
                  <ReportPhoto key={attachment.id} attachment={attachment} reportId={report.id} ticketNumber={report.ticket_number} index={index} isMock={isMock} />
                ))}
              </ul>
            )}
          </section>
          <LazyPanel label="Memuat dokumen laporan"><ReportDocumentsPanel reportId={report.id} disabled={isMock} /></LazyPanel>
          <LazyPanel label="Memuat progres rujukan"><ReportReferralPanel reportId={report.id} reportStatus={report.status} disabled={isMock} /></LazyPanel>
          <section aria-labelledby="riwayat-status" className="defer-render ui-panel p-5 sm:p-6">
            <h2 id="riwayat-status" className="text-lg font-semibold">Riwayat status</h2>
            {report.status_history.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Belum ada riwayat status.</p> : (
              <ol className="mt-6 space-y-5 border-l-2 border-border pl-5">
                {report.status_history.map((entry, index) => (
                  <li key={`${entry.created_at}-${index}`} className="relative min-w-0">
                    <span aria-hidden="true" className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-brand ring-2 ring-slate-200" />
                    <p className="text-sm font-semibold text-foreground">{statusLabels[entry.new_status]}</p>
                    <p className="mt-1 text-xs text-muted-foreground"><time dateTime={entry.created_at}>{formatReportDate(entry.created_at)}</time> · {entry.actor_type === "system" ? "Sistem" : "Petugas"}</p>
                    {entry.notes && <p className="mt-2 break-words text-sm leading-6 text-foreground">{entry.notes}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <aside aria-label="Ringkasan penanganan" className="min-w-0 space-y-6">
          <section className="ui-panel p-5">
            <h2 className="text-base font-semibold">Penanganan</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="text-muted-foreground">Status saat ini</dt><dd className="mt-1 font-semibold text-foreground">{statusLabels[report.status]}</dd></div>
              <div><dt className="text-muted-foreground">Diverifikasi</dt><dd className="mt-1 font-medium">{report.verified_at ? formatReportDate(report.verified_at) : "Belum diverifikasi"}</dd></div>
              <div><dt className="text-muted-foreground">Diselesaikan</dt><dd className="mt-1 font-medium">{report.resolved_at ? formatReportDate(report.resolved_at) : "Belum selesai"}</dd></div>
              <div><dt className="flex items-center gap-1.5 text-muted-foreground"><Clock3 aria-hidden="true" size={15} /> Terakhir diperbarui</dt><dd className="mt-1 font-medium">{formatReportDate(report.updated_at)}</dd></div>
            </dl>
          </section>
          {actionsEnabled && availableActions.length > 0 && state !== "saved_unavailable" && state !== "conflict" && (
            <section aria-labelledby="keputusan-petugas" className="scroll-mt-4 ui-panel p-5">
              <h2 id="keputusan-petugas" className="text-base font-semibold">Aksi petugas</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Periksa laporan dan pilih langkah penanganan berikutnya.</p>
              <form ref={decisionForm} onSubmit={handleSubmit} className="mt-5 space-y-4" aria-busy={state === "saving"}>
                <fieldset disabled={state === "saving"} className="space-y-4">
                  <legend className="text-sm font-semibold">Pilih tindakan</legend>
                  <div className="mt-2 space-y-2">
                    {availableActions.map((action) => <label key={action} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm"><input type="radio" name="decision" value={action} required checked={decision === action} onChange={() => { setDecision(action); setState("idle"); }} /> {action === "verified" ? "Verifikasi laporan" : action === "rejected" ? "Tolak laporan" : action === "in_progress" ? "Mulai penanganan" : action === "forwarded" ? "Teruskan laporan" : "Selesaikan laporan"}</label>)}
                  </div>
                  <div>
                    <label htmlFor="decision-reason" className="text-sm font-semibold">Alasan atau catatan tindakan</label>
                    <textarea id="decision-reason" name="reason" required value={reason} onChange={(event) => { setReason(event.target.value); setState("idle"); }} rows={4} className="ui-control mt-2 p-3 leading-6" placeholder="Jelaskan tindakan petugas" />
                  </div>
                  <button type="submit" className="ui-primary w-full">{state === "saving" ? "Menyimpan…" : "Simpan tindakan"}</button>
                </fieldset>
              </form>
              {state === "saving" && <p role="status" className="mt-3 text-sm text-muted-foreground">Tindakan sedang disimpan…</p>}
              <SlowStatus active={state === "saving"} />
              {state === "error" && <p role="alert" className="mt-3 text-sm text-rose-800">Tindakan belum tersimpan. Periksa pilihan dan alasan, lalu coba lagi.</p>}
              {isMock && <p className="mt-3 text-xs leading-5 text-amber-900">Simulasi: perubahan hanya terlihat sampai halaman dimuat ulang.</p>}
            </section>
          )}
          {state === "success" && <p role="status" className="ui-alert-success p-4 text-sm leading-6 text-emerald-950">{isMock ? "Tindakan berhasil disimulasikan. Status kembali semula setelah halaman dimuat ulang." : "Tindakan berhasil disimpan."}</p>}
          {state === "conflict" && <div role="alert" className="ui-alert-error p-4 text-sm leading-6 text-rose-950"><p>Status laporan telah berubah. Muat ulang halaman sebelum membuat keputusan lagi.</p><button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-lg border border-rose-300 px-4 text-sm font-semibold">Muat ulang halaman</button></div>}
          {state === "saved_unavailable" && <div role="status" className="ui-alert-warning p-4 text-sm leading-6 text-amber-950"><p>Keputusan berhasil disimpan, tetapi detail terbaru belum dapat dimuat. Muat ulang halaman untuk melihat status resmi.</p><button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-lg border border-amber-400 px-4 text-sm font-semibold">Muat ulang halaman</button></div>}
          <p className="rounded-lg border border-border bg-muted p-4 text-sm leading-6 text-brand">Ringkasan dan urgensi membantu petugas meninjau laporan. Keputusan penanganan tetap dilakukan oleh petugas berwenang.</p>
        </aside>
      </div>
      <ConfirmationDialog open={confirmOpen} onOpenChange={setConfirmOpen} title={`Konfirmasi tindakan untuk ${report.ticket_number}`} description={`Status akan diubah menjadi ${decision ? statusLabels[decision] : "status yang dipilih"}. Catatan keputusan akan masuk ke riwayat resmi.`} confirmLabel="Simpan keputusan" pending={state === "saving"} tone={decision === "rejected" ? "danger" : "default"} onConfirm={() => { confirmed.current = true; setConfirmOpen(false); decisionForm.current?.requestSubmit(); }} />
    </div>
  );
}
