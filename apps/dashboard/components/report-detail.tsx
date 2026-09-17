"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, MapPin, UserRound } from "lucide-react";
import { saveReportDecision } from "@/app/reports/[id]/actions";
import { categoryLabels, formatLocation, formatReportDate, StatusBadge, statusLabels, urgencyLabels } from "@/components/report-display";
import type { ReportDetail } from "@/lib/reports";

type Decision = "verified" | "rejected";

export function ReportDetailView({ initialReport, actionsEnabled, isMock }: { initialReport: ReportDetail; actionsEnabled: boolean; isMock: boolean }) {
  const router = useRouter();
  const [report, setReport] = useState(initialReport);
  const [decision, setDecision] = useState<Decision | "">("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "success" | "saved_unavailable" | "conflict" | "error">("idle");
  const saving = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !actionsEnabled || state === "saved_unavailable" || state === "conflict" || report.status !== "pending_verification") return;
    if (!decision || !reason.trim()) {
      setState("error");
      return;
    }

    saving.current = true;
    setState("saving");
    try {
      const result = await saveReportDecision(report.id, { status: decision, reason: reason.trim() });
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
          status_history: [
            ...current.status_history,
            {
              old_status: current.status,
              new_status: result.data.status,
              actor_type: "admin",
              actor_identifier: null,
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
      setState("success");
    } catch {
      setState("error");
    } finally {
      saving.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/reports" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-sky-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"><ArrowLeft aria-hidden="true" size={17} /> Kembali ke daftar laporan</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2"><p className="text-sm font-semibold text-sky-800">Detail laporan</p><h1 className="break-words text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{report.ticket_number}</h1><p className="text-sm text-slate-600">Dibuat <time dateTime={report.created_at}>{formatReportDate(report.created_at)}</time></p>{actionsEnabled && report.status === "pending_verification" && <a href="#keputusan-petugas" className="inline-flex min-h-11 items-center text-sm font-semibold text-sky-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 lg:hidden">Lompat ke keputusan petugas</a>}</div>
        <StatusBadge status={report.status} />
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="informasi-laporan" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="informasi-laporan" className="text-lg font-semibold">Informasi laporan</h2>
            <div className="mt-6 space-y-5">
              <div><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deskripsi warga</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-900">{report.description}</p></div>
              <div className="border-t border-slate-100 pt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ringkasan</h3><p className="mt-2 break-words text-sm leading-7 text-slate-800">{report.summary ?? "Ringkasan belum tersedia."}</p></div>
              <dl className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori</dt><dd className="mt-2 text-sm font-medium">{categoryLabels[report.category]}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Urgensi</dt><dd className="mt-2 text-sm font-medium">{urgencyLabels[report.urgency]}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><MapPin aria-hidden="true" size={15} /> Lokasi</dt><dd className="mt-2 break-words text-sm font-medium">{formatLocation(report.location)}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><UserRound aria-hidden="true" size={15} /> Pelapor</dt><dd className="mt-2 text-sm font-medium">{report.citizen.display_name}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit penanggung jawab</dt><dd className="mt-2 text-sm font-medium">{report.responsible_unit ?? "Belum ditetapkan"}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lampiran</dt><dd className="mt-2 text-sm font-medium">{report.attachments.length === 0 ? "Belum ada lampiran" : `${report.attachments.length} lampiran`}</dd></div>
              </dl>
            </div>
          </section>
          <section aria-labelledby="riwayat-status" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="riwayat-status" className="text-lg font-semibold">Riwayat status</h2>
            {report.status_history.length === 0 ? <p className="mt-4 text-sm text-slate-600">Belum ada riwayat status.</p> : (
              <ol className="mt-6 space-y-5 border-l-2 border-slate-200 pl-5">
                {report.status_history.map((entry, index) => (
                  <li key={`${entry.created_at}-${index}`} className="relative min-w-0">
                    <span aria-hidden="true" className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-sky-700 ring-2 ring-slate-200" />
                    <p className="text-sm font-semibold text-slate-900">{statusLabels[entry.new_status]}</p>
                    <p className="mt-1 text-xs text-slate-600"><time dateTime={entry.created_at}>{formatReportDate(entry.created_at)}</time> · {entry.actor_type === "system" ? "Sistem" : "Petugas"}</p>
                    {entry.notes && <p className="mt-2 break-words text-sm leading-6 text-slate-700">{entry.notes}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <aside aria-label="Ringkasan penanganan" className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Penanganan</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="text-slate-600">Status saat ini</dt><dd className="mt-1 font-semibold text-slate-900">{statusLabels[report.status]}</dd></div>
              <div><dt className="text-slate-600">Diverifikasi</dt><dd className="mt-1 font-medium">{report.verified_at ? formatReportDate(report.verified_at) : "Belum diverifikasi"}</dd></div>
              <div><dt className="text-slate-600">Diselesaikan</dt><dd className="mt-1 font-medium">{report.resolved_at ? formatReportDate(report.resolved_at) : "Belum selesai"}</dd></div>
              <div><dt className="flex items-center gap-1.5 text-slate-600"><Clock3 aria-hidden="true" size={15} /> Terakhir diperbarui</dt><dd className="mt-1 font-medium">{formatReportDate(report.updated_at)}</dd></div>
            </dl>
          </section>
          {actionsEnabled && report.status === "pending_verification" && state !== "saved_unavailable" && state !== "conflict" && (
            <section aria-labelledby="keputusan-petugas" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 id="keputusan-petugas" className="text-base font-semibold">Keputusan petugas</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Periksa laporan sebelum menentukan keputusan.</p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4" aria-busy={state === "saving"}>
                <fieldset disabled={state === "saving"} className="space-y-4">
                  <legend className="text-sm font-semibold">Pilih keputusan</legend>
                  <div className="mt-2 space-y-2">
                    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm"><input type="radio" name="decision" value="verified" required checked={decision === "verified"} onChange={() => setDecision("verified")} /> Verifikasi laporan</label>
                    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm"><input type="radio" name="decision" value="rejected" required checked={decision === "rejected"} onChange={() => setDecision("rejected")} /> Tolak laporan</label>
                  </div>
                  <div>
                    <label htmlFor="decision-reason" className="text-sm font-semibold">Alasan keputusan</label>
                    <textarea id="decision-reason" name="reason" required value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-sky-700" placeholder="Jelaskan hasil pemeriksaan laporan" />
                  </div>
                  <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-sky-800 px-4 text-sm font-semibold text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-wait disabled:opacity-60">{state === "saving" ? "Menyimpan…" : "Simpan keputusan"}</button>
                </fieldset>
              </form>
              {state === "saving" && <p role="status" className="mt-3 text-sm text-slate-600">Keputusan sedang disimpan…</p>}
              {state === "error" && <p role="alert" className="mt-3 text-sm text-rose-800">Keputusan belum tersimpan. Periksa pilihan dan alasan, lalu coba lagi.</p>}
              {isMock && <p className="mt-3 text-xs leading-5 text-amber-900">Simulasi: perubahan hanya terlihat sampai halaman dimuat ulang.</p>}
            </section>
          )}
          {state === "success" && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">{isMock ? "Keputusan berhasil disimulasikan. Status kembali semula setelah halaman dimuat ulang." : "Keputusan berhasil disimpan."}</p>}
          {state === "conflict" && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950"><p>Status laporan telah berubah. Muat ulang halaman sebelum membuat keputusan lagi.</p><button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-lg border border-rose-300 px-4 text-sm font-semibold">Muat ulang halaman</button></div>}
          {state === "saved_unavailable" && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p>Keputusan berhasil disimpan, tetapi detail terbaru belum dapat dimuat. Muat ulang halaman untuk melihat status resmi.</p><button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-lg border border-amber-400 px-4 text-sm font-semibold">Muat ulang halaman</button></div>}
          <p className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-950">Informasi dan rekomendasi AI membantu petugas meninjau laporan. Keputusan penanganan tetap dilakukan oleh petugas berwenang.</p>
        </aside>
      </div>
    </div>
  );
}
