import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

import { requireSignedIn } from "@/lib/auth";
import {
  listServiceRequests,
  ServiceRequestApiError,
} from "@/lib/service-requests";
import { requestStatusLabels } from "@/lib/service-request-types";
import { RequestUnavailable } from "./unavailable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  await requireSignedIn(`/reports/requests?page=${page}`);

  let result;
  try {
    result = await listServiceRequests(page);
  } catch (error) {
    if (error instanceof ServiceRequestApiError && error.status === 401) {
      redirect(`/login?reauth=1&next=${encodeURIComponent(`/reports/requests?page=${page}`)}`);
    }
    if (error instanceof ServiceRequestApiError && error.status === 403) {
      redirect("/access-denied");
    }
    return <RequestUnavailable />;
  }
  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
  if (page > totalPages) redirect(`/reports/requests?page=${totalPages}`);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="ui-page-header">
        <p className="text-sm font-semibold text-brand">Layanan warga / REQUEST</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-3xl">Pengajuan Surat Keterangan Domisili</h1>
      </header>

      <section aria-label="Antrean pengajuan" className="overflow-hidden ui-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="font-semibold">Surat Keterangan Domisili</h2>
          <span className="text-sm text-muted-foreground">{result.total} pengajuan</span>
        </div>
        {result.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground"><FileText aria-hidden="true" className="mx-auto mb-3" />Belum ada pengajuan dalam antrean.</div>
        ) : (
          <div className="divide-y divide-border">
            {result.items.map((item) => (
              <Link key={item.id} href={`/reports/requests/${item.id}`} aria-label={`Buka detail pengajuan ${item.ticket_number}`} className="group block px-5 py-4 transition-colors hover:bg-background focus-visible:bg-background focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
                <article className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0 space-y-1">
                    <span className="break-all font-semibold text-brand group-hover:underline">{item.ticket_number}</span>
                    <p className="break-words text-sm text-foreground">{item.applicant_name}</p>
                    <p className="text-xs text-muted-foreground">Diajukan {new Date(item.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })}</p>
                  </div>
                  <span className="ui-badge bg-muted text-foreground ring-border">{requestStatusLabels[item.status]}</span>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>

      {result.total > result.page_size && (
        <nav aria-label="Halaman pengajuan" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/reports/requests?page=${page - 1}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-input bg-card px-3 font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ChevronLeft aria-hidden="true" size={16} /> Sebelumnya</Link>}
            {page < totalPages && <Link href={`/reports/requests?page=${page + 1}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-input bg-card px-3 font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Berikutnya <ChevronRight aria-hidden="true" size={16} /></Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
