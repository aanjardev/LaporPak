import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth";
import {
  listServiceRequests,
  ServiceRequestApiError,
} from "@/lib/service-requests";

const statusLabels = {
  pending_review: "Menunggu tinjauan",
  approved: "Disetujui",
  rejected: "Ditolak",
  completed: "Selesai",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requested = Number(typeof params.page === "string" ? params.page : "1");
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  await requireSignedIn(`/reports/requests?page=${page}`);
  let result;
  try {
    result = await listServiceRequests(page);
  } catch (error) {
    if (error instanceof ServiceRequestApiError && error.status === 401) {
      redirect(`/login?reauth=1&next=${encodeURIComponent("/reports/requests")}`);
    }
    if (error instanceof ServiceRequestApiError && error.status === 403) {
      redirect("/access-denied");
    }
    return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-950">Pengajuan belum dapat dimuat. Pastikan FastAPI tersedia lalu coba lagi.</p>;
  }
  const pages = Math.max(1, Math.ceil(result.total / result.page_size));
  if (page > pages) redirect(`/reports/requests?page=${pages}`);

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header><p className="text-sm font-semibold text-sky-800">Layanan warga / REQUEST</p><h1 className="mt-2 text-3xl font-bold">Pengajuan surat domisili</h1><p className="mt-2 text-sm text-slate-600">Petugas tetap menentukan keputusan administratif resmi.</p></header>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 font-semibold">{result.total} pengajuan</div>
        {result.items.length === 0 ? <p className="p-10 text-center text-sm text-slate-600">Belum ada pengajuan.</p> : <div className="divide-y divide-slate-100">{result.items.map((item) => <article key={item.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><Link className="font-semibold text-sky-800 hover:underline" href={`/reports/requests/${item.id}`}>{item.ticket_number}</Link><p className="mt-1 text-sm text-slate-800">{item.applicant_name} · {item.purpose}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("id-ID")}</p></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{statusLabels[item.status]}</span></article>)}</div>}
        <nav className="flex justify-end gap-3 border-t border-slate-200 p-4 text-sm">{page > 1 && <Link href={`/reports/requests?page=${page - 1}`}>Sebelumnya</Link>}<span>{page} / {pages}</span>{page < pages && <Link href={`/reports/requests?page=${page + 1}`}>Berikutnya</Link>}</nav>
      </section>
    </div>
  );
}
