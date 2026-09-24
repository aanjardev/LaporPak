import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireSignedIn } from "@/lib/auth";
import { getServiceRequest, ServiceRequestApiError } from "@/lib/service-requests";
import { RequestUnavailable } from "../unavailable";
import { RequestDetailView } from "./decision-form";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSignedIn(`/reports/requests/${encodeURIComponent(id)}`);
  let request;
  try {
    request = await getServiceRequest(id);
  } catch (error) {
    if (error instanceof ServiceRequestApiError && error.status === 404) notFound();
    if (error instanceof ServiceRequestApiError && error.status === 401) {
      redirect(`/login?reauth=1&next=${encodeURIComponent(`/reports/requests/${id}`)}`);
    }
    if (error instanceof ServiceRequestApiError && error.status === 403) {
      redirect("/access-denied");
    }
    return <RequestUnavailable href={`/reports/requests/${encodeURIComponent(id)}`} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/reports/requests" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" size={17} /> Kembali ke antrean</Link>
      <header className="ui-page-header">
        <p className="text-sm font-semibold text-brand">Layanan warga / REQUEST</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-3xl">Detail pengajuan</h1>
        <p className="text-sm text-muted">Data simulasi — prototipe layanan demo, SOP resmi belum ditetapkan.</p>
      </header>
      <RequestDetailView key={`${request.id}:${request.updated_at}`} initialRequest={request} />
    </div>
  );
}
