import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import {
  categoryLabels,
  formatLocation,
  formatReportDate,
  StatusBadge,
  statusLabels,
  urgencyLabels,
} from "@/components/report-display";
import { ReportUnavailable } from "@/components/report-unavailable";
import { requireSignedIn } from "@/lib/auth";
import {
  getReports,
  ReportApiError,
  reportCategories,
  reportStatuses,
  reportUrgencies,
  type ReportCategory,
  type ReportQuery,
  type ReportStatus,
  type ReportUrgency,
} from "@/lib/reports";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value : value?.[0] ?? "";
}

function pageHref(query: ReportQuery, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.urgency) params.set("urgency", query.urgency);
  if (query.category) params.set("category", query.category);
  return `/reports?${params.toString()}`;
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedPage = Number(first(params.page));
  const status = first(params.status);
  const urgency = first(params.urgency);
  const category = first(params.category);
  const query: ReportQuery = {
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    page_size: 20,
    search: first(params.search).trim() || undefined,
    status: reportStatuses.includes(status as ReportStatus) ? (status as ReportStatus) : undefined,
    urgency: reportUrgencies.includes(urgency as ReportUrgency) ? (urgency as ReportUrgency) : undefined,
    category: reportCategories.includes(category as ReportCategory) ? (category as ReportCategory) : undefined,
  };
  await requireSignedIn(pageHref(query, query.page));
  let result;
  try {
    result = await getReports(query);
  } catch (error) {
    if (error instanceof ReportApiError && error.status === 401) {
      redirect(`/login?next=${encodeURIComponent(pageHref(query, query.page))}`);
    }
    if (error instanceof ReportApiError && error.status === 403) {
      redirect("/access-denied");
    }
    return <ReportUnavailable />;
  }
  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
  if (query.page > totalPages) redirect(pageHref(query, totalPages));
  const start = result.total === 0 ? 0 : (result.page - 1) * result.page_size + 1;
  const end = Math.min(result.page * result.page_size, result.total);

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-sky-800">Layanan warga / REPORT</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Laporan warga</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Pantau laporan yang masuk dan buka detailnya untuk melihat informasi serta riwayat penanganan.
        </p>
      </header>

      <section aria-label="Pencarian dan filter laporan" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <form action="/reports" method="get" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_155px_155px_170px_auto] xl:items-end">
          <div className="space-y-1.5">
            <label htmlFor="search" className="text-sm font-medium text-slate-700">Cari laporan</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input id="search" name="search" type="search" defaultValue={query.search ?? ""} placeholder="Nomor tiket, deskripsi, atau lokasi" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-200" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-sm font-medium text-slate-700">Status</label>
            <select id="status" name="status" defaultValue={query.status ?? ""} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-200">
              <option value="">Semua status</option>
              {reportStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="urgency" className="text-sm font-medium text-slate-700">Urgensi</label>
            <select id="urgency" name="urgency" defaultValue={query.urgency ?? ""} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-200">
              <option value="">Semua urgensi</option>
              {reportUrgencies.map((value) => <option key={value} value={value}>{urgencyLabels[value]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="category" className="text-sm font-medium text-slate-700">Kategori</label>
            <select id="category" name="category" defaultValue={query.category ?? ""} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-200">
              <option value="">Semua kategori</option>
              {reportCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
            </select>
          </div>
          <button type="submit" className="min-h-11 rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
            Terapkan
          </button>
        </form>
        {(query.search || query.status || query.urgency || query.category) && (
          <Link href="/reports" className="mt-4 inline-block text-sm font-medium text-sky-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Hapus filter</Link>
        )}
      </section>

      <section aria-labelledby="hasil-laporan" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 id="hasil-laporan" className="text-lg font-semibold text-slate-950">Daftar laporan</h2>
          <p className="text-sm text-slate-600">{result.total} laporan</p>
        </div>

        {result.items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Inbox aria-hidden="true" size={27} /></span>
            <h3 className="mt-4 text-lg font-semibold">Belum ada laporan yang cocok</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Coba ubah kata kunci atau filter untuk melihat laporan lain.</p>
            <Link href="/reports" className="mt-5 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-sky-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-sky-700">Lihat semua laporan</Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-200 md:hidden">
              {result.items.map((report) => (
                <article key={report.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/reports/${report.id}`} className="text-sm font-bold text-sky-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-sky-700">{report.ticket_number}</Link>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="text-sm font-medium leading-6 text-slate-900">{report.description}</p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div><dt className="text-slate-500">Kategori</dt><dd className="mt-0.5 font-medium">{categoryLabels[report.category]}</dd></div>
                    <div><dt className="text-slate-500">Urgensi</dt><dd className="mt-0.5 font-medium">{urgencyLabels[report.urgency]}</dd></div>
                    <div className="col-span-2"><dt className="text-slate-500">Lokasi</dt><dd className="mt-0.5 font-medium">{formatLocation(report.location)}</dd></div>
                  </dl>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <time dateTime={report.created_at}>{formatReportDate(report.created_at)}</time>
                    <Link href={`/reports/${report.id}`} className="inline-flex min-h-10 items-center gap-1 font-semibold text-sky-800 focus-visible:outline-2 focus-visible:outline-sky-700">Detail <ArrowRight aria-hidden="true" size={15} /></Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-semibold">Tiket dan laporan</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Kategori / lokasi</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Urgensi</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Dibuat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((report) => (
                    <tr key={report.id} className="align-top transition-colors hover:bg-slate-50">
                      <td className="max-w-xs px-5 py-4">
                        <Link href={`/reports/${report.id}`} className="font-semibold text-sky-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-sky-700">{report.ticket_number}</Link>
                        <p className="mt-1 line-clamp-2 leading-5 text-slate-800">{report.description}</p>
                      </td>
                      <td className="px-4 py-4"><span className="font-medium">{categoryLabels[report.category]}</span><span className="mt-1 block text-xs text-slate-600">{formatLocation(report.location)}</span></td>
                      <td className="px-4 py-4 text-slate-700">{urgencyLabels[report.urgency]}</td>
                      <td className="px-4 py-4"><StatusBadge status={report.status} /></td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600"><time dateTime={report.created_at}>{formatReportDate(report.created_at)}</time></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 text-sm sm:px-6">
          <p className="text-slate-600">Menampilkan {start}–{end} dari {result.total}</p>
          <nav aria-label="Halaman laporan" className="flex items-center gap-2">
            {result.page > 1 ? (
              <Link href={pageHref(query, result.page - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 px-3 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-700"><ChevronLeft aria-hidden="true" size={16} /> Sebelumnya</Link>
            ) : null}
            <span className="px-1 text-slate-600">{result.page} / {totalPages}</span>
            {result.page < totalPages ? (
              <Link href={pageHref(query, result.page + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 px-3 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-700">Berikutnya <ChevronRight aria-hidden="true" size={16} /></Link>
            ) : null}
          </nav>
        </div>
      </section>
    </div>
  );
}
