import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireSignedIn } from "@/lib/auth";
import { getServiceRequestById, isRequestPreviewEnabled } from "@/lib/service-requests";
import { RequestUnavailable } from "../unavailable";
import { RequestDetailView } from "./decision-form";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isRequestPreviewEnabled()) notFound();
  const { id } = await params;
  await requireSignedIn(`/reports/requests/${encodeURIComponent(id)}`);
  let request;
  try {
    request = await getServiceRequestById(id);
  } catch {
    return <RequestUnavailable href={`/reports/requests/${encodeURIComponent(id)}`} />;
  }
  if (!request) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/reports/requests" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sky-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"><ArrowLeft aria-hidden="true" size={17} /> Kembali ke antrean</Link>
      <header className="space-y-2">
        <p className="text-sm font-semibold text-sky-800">Layanan warga / REQUEST</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Detail pengajuan</h1>
        <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Data simulasi · tidak mengubah database</p>
      </header>
      <RequestDetailView key={request.id} initialRequest={request} />
    </div>
  );
}
