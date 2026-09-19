import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

import { requireSignedIn } from "@/lib/auth";
import { getServiceRequests, isRequestPreviewEnabled, requestStatusLabels } from "@/lib/service-requests";
import { RequestUnavailable } from "./unavailable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isRequestPreviewEnabled()) notFound();
  const params = await searchParams;
  const rawPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  await requireSignedIn(`/reports/requests?page=${page}`);

  let result;
  try {
    result = await getServiceRequests(page);
  } catch {
    return <RequestUnavailable />;
  }
  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
  if (page > totalPages) redirect(`/reports/requests?page=${totalPages}`);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-sky-800">Layanan warga / REQUEST</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Pengajuan layanan</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">Pratinjau antrean Surat Keterangan Domisili untuk petugas. Semua nama dan alamat di halaman ini adalah data sintetis.</p>
        <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Data simulasi · belum ada keputusan resmi</p>
      </header>

      <section aria-label="Antrean pengajuan" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">Surat Keterangan Domisili</h2>
          <span className="text-sm text-slate-600">{result.total} pengajuan sintetis</span>
        </div>
        {result.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600"><FileText aria-hidden="true" className="mx-auto mb-3" />Belum ada pengajuan dalam antrean.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {result.items.map((item) => (
              <article key={item.id} className="grid min-w-0 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0 space-y-1">
                  <Link href={`/reports/requests/${item.id}`} className="break-all font-semibold text-sky-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">{item.ticket_number}</Link>
                  <p className="break-words text-sm text-slate-900">{item.applicant_name} · {item.purpose}</p>
                  <p className="text-xs text-slate-600">Diajukan {new Date(item.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })}</p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{requestStatusLabels[item.status]}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      {result.total > result.page_size && (
        <nav aria-label="Halaman pengajuan" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-slate-600">Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/reports/requests?page=${page - 1}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"><ChevronLeft aria-hidden="true" size={16} /> Sebelumnya</Link>}
            {page < totalPages && <Link href={`/reports/requests?page=${page + 1}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Berikutnya <ChevronRight aria-hidden="true" size={16} /></Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
