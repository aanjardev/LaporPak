import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, MapPin, UserRound } from "lucide-react";
import { categoryLabels, formatLocation, formatReportDate, StatusBadge, statusLabels, urgencyLabels } from "@/components/report-display";
import { getReportById } from "@/lib/reports";
import { ReportUnavailable } from "@/components/report-unavailable";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let report;
  try {
    report = await getReportById(id);
  } catch {
    return <ReportUnavailable />;
  }
  if (!report) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/reports" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-sky-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"><ArrowLeft aria-hidden="true" size={17} /> Kembali ke daftar laporan</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2"><p className="text-sm font-semibold text-sky-800">Detail laporan</p><h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{report.ticket_number}</h1><p className="text-sm text-slate-600">Dibuat <time dateTime={report.created_at}>{formatReportDate(report.created_at)}</time></p></div>
        <StatusBadge status={report.status} />
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-6">
          <section aria-labelledby="informasi-laporan" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="informasi-laporan" className="text-lg font-semibold">Informasi laporan</h2>
            <div className="mt-6 space-y-5">
              <div><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deskripsi warga</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-900">{report.description}</p></div>
              <div className="border-t border-slate-100 pt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ringkasan</h3><p className="mt-2 text-sm leading-7 text-slate-800">{report.summary ?? "Ringkasan belum tersedia."}</p></div>
              <dl className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori</dt><dd className="mt-2 text-sm font-medium">{categoryLabels[report.category]}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Urgensi</dt><dd className="mt-2 text-sm font-medium">{urgencyLabels[report.urgency]}</dd></div>
                <div><dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><MapPin aria-hidden="true" size={15} /> Lokasi</dt><dd className="mt-2 text-sm font-medium">{formatLocation(report.location)}</dd></div>
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
                  <li key={`${entry.created_at}-${index}`} className="relative">
                    <span aria-hidden="true" className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-sky-700 ring-2 ring-slate-200" />
                    <p className="text-sm font-semibold text-slate-900">{statusLabels[entry.new_status]}</p>
                    <p className="mt-1 text-xs text-slate-600"><time dateTime={entry.created_at}>{formatReportDate(entry.created_at)}</time> · {entry.actor_type === "system" ? "Sistem" : "Petugas"}</p>
                    {entry.notes && <p className="mt-2 text-sm leading-6 text-slate-700">{entry.notes}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <aside aria-label="Ringkasan penanganan" className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Penanganan</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="text-slate-600">Status saat ini</dt><dd className="mt-1 font-semibold text-slate-900">{statusLabels[report.status]}</dd></div>
              <div><dt className="text-slate-600">Diverifikasi</dt><dd className="mt-1 font-medium">{report.verified_at ? formatReportDate(report.verified_at) : "Belum diverifikasi"}</dd></div>
              <div><dt className="text-slate-600">Diselesaikan</dt><dd className="mt-1 font-medium">{report.resolved_at ? formatReportDate(report.resolved_at) : "Belum selesai"}</dd></div>
              <div><dt className="flex items-center gap-1.5 text-slate-600"><Clock3 aria-hidden="true" size={15} /> Terakhir diperbarui</dt><dd className="mt-1 font-medium">{formatReportDate(report.updated_at)}</dd></div>
            </dl>
          </section>
          <p className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-950">Informasi dan rekomendasi AI membantu petugas meninjau laporan. Keputusan penanganan tetap dilakukan oleh petugas berwenang.</p>
        </aside>
      </div>
    </div>
  );
}
