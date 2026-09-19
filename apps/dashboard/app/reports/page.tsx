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
      redirect(`/login?reauth=1&next=${encodeURIComponent(pageHref(query, query.page))}`);
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
      <header className="ui-page-header">
        <p className="text-sm font-semibold text-brand">Layanan warga / REPORT</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-3xl">Laporan warga</h1>
      </header>

      <section aria-label="Pencarian dan filter laporan" className="ui-panel p-4 sm:p-5">
        <form action="/reports" method="get" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_155px_155px_170px_auto] xl:items-end">
          <div className="space-y-1.5">
            <label htmlFor="search" className="text-sm font-medium text-foreground">Cari laporan</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input id="search" name="search" type="search" defaultValue={query.search ?? ""} placeholder="Nomor tiket, deskripsi, atau lokasi" className="ui-control pl-10 pr-3" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-sm font-medium text-foreground">Status</label>
            <select id="status" name="status" defaultValue={query.status ?? ""} className="ui-control px-3">
              <option value="">Semua status</option>
              {reportStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="urgency" className="text-sm font-medium text-foreground">Urgensi</label>
            <select id="urgency" name="urgency" defaultValue={query.urgency ?? ""} className="ui-control px-3">
              <option value="">Semua urgensi</option>
              {reportUrgencies.map((value) => <option key={value} value={value}>{urgencyLabels[value]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="category" className="text-sm font-medium text-foreground">Kategori</label>
            <select id="category" name="category" defaultValue={query.category ?? ""} className="ui-control px-3">
              <option value="">Semua kategori</option>
              {reportCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
            </select>
          </div>
          <button type="submit" className="ui-primary">
            Terapkan
          </button>
        </form>
        {(query.search || query.status || query.urgency || query.category) && (
          <Link href="/reports" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Hapus filter</Link>
        )}
      </section>

      <section aria-labelledby="hasil-laporan" className="overflow-hidden ui-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-6">
          <h2 id="hasil-laporan" className="text-lg font-semibold text-foreground">Daftar laporan</h2>
          <p className="text-sm text-muted-foreground">{result.total} laporan</p>
        </div>

        {result.items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><Inbox aria-hidden="true" size={27} /></span>
            <h3 className="mt-4 text-lg font-semibold">Belum ada laporan yang cocok</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Coba ubah kata kunci atau filter untuk melihat laporan lain.</p>
            <Link href="/reports" className="mt-5 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">Lihat semua laporan</Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {result.items.map((report) => (
                <Link key={report.id} href={`/reports/${report.id}`} aria-label={`Buka detail laporan ${report.ticket_number}`} className="group block p-4 transition-colors hover:bg-background focus-visible:bg-background focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
                  <article className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-sm font-bold text-brand group-hover:underline">{report.ticket_number}</span>
                      <StatusBadge status={report.status} />
                    </div>
                    <p className="break-words text-sm font-medium leading-6 text-foreground">{report.description}</p>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div><dt className="text-muted-foreground">Kategori</dt><dd className="mt-0.5 font-medium">{categoryLabels[report.category]}</dd></div>
                      <div><dt className="text-muted-foreground">Urgensi</dt><dd className="mt-0.5 font-medium">{urgencyLabels[report.urgency]}</dd></div>
                      <div className="col-span-2"><dt className="text-muted-foreground">Lokasi</dt><dd className="mt-0.5 break-words font-medium">{formatLocation(report.location)}</dd></div>
                    </dl>
                    <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                      <time dateTime={report.created_at}>{formatReportDate(report.created_at)}</time>
                      <span className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand">Buka detail <ArrowRight aria-hidden="true" size={15} /></span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-background text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-semibold">Tiket dan laporan</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Kategori / lokasi</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Urgensi</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Dibuat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.items.map((report) => (
                    <tr key={report.id} className="group relative cursor-pointer align-top transition-colors hover:bg-background focus-within:bg-background">
                      <td className="max-w-xs px-5 py-4">
                        <Link href={`/reports/${report.id}`} aria-label={`Buka detail laporan ${report.ticket_number}`} className="font-semibold text-brand underline-offset-4 after:absolute after:inset-0 after:z-10 after:content-[''] group-hover:underline focus-visible:outline-2 focus-visible:outline-ring">{report.ticket_number}</Link>
                        <p className="mt-1 line-clamp-2 leading-5 text-foreground">{report.description}</p>
                      </td>
                      <td className="px-4 py-4"><span className="font-medium">{categoryLabels[report.category]}</span><span className="mt-1 block text-xs text-muted-foreground">{formatLocation(report.location)}</span></td>
                      <td className="px-4 py-4 text-foreground">{urgencyLabels[report.urgency]}</td>
                      <td className="px-4 py-4"><StatusBadge status={report.status} /></td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground"><time dateTime={report.created_at}>{formatReportDate(report.created_at)}</time></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 text-sm sm:px-6">
          <p className="text-muted-foreground">Menampilkan {start}–{end} dari {result.total}</p>
          <nav aria-label="Halaman laporan" className="flex items-center gap-2">
            {result.page > 1 ? (
              <Link href={pageHref(query, result.page - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-input px-3 font-medium text-foreground hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"><ChevronLeft aria-hidden="true" size={16} /> Sebelumnya</Link>
            ) : null}
            <span className="px-1 text-muted-foreground">{result.page} / {totalPages}</span>
            {result.page < totalPages ? (
              <Link href={pageHref(query, result.page + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-input px-3 font-medium text-foreground hover:bg-background focus-visible:outline-2 focus-visible:outline-ring">Berikutnya <ChevronRight aria-hidden="true" size={16} /></Link>
            ) : null}
          </nav>
        </div>
      </section>
    </div>
  );
}
