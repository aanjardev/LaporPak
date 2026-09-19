import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAdminAccessToken, requireSignedIn } from "@/lib/auth";
import { getKnowledgeDocument, KnowledgeApiError } from "@/lib/knowledge";

import { updateKnowledgeAction } from "../actions";
import { KnowledgeForm } from "../knowledge-form";
import { KnowledgeUnavailable } from "../knowledge-unavailable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function KnowledgeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  await requireSignedIn(`/reports/knowledge/${id}`);
  const query = await searchParams;
  let document;
  try {
    document = await getKnowledgeDocument(id, await getAdminAccessToken());
  } catch (error) {
    if (error instanceof KnowledgeApiError) {
      if (error.status === 401) redirect(`/login?reauth=1&next=${encodeURIComponent(`/reports/knowledge/${encodeURIComponent(id)}`)}`);
      if (error.status === 403) redirect("/access-denied");
      if (error.status === 404) notFound();
    }
    return <KnowledgeUnavailable />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/reports/knowledge" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">← Kembali ke sumber</Link>
      <header className="min-w-0"><p className="text-sm font-semibold text-brand">Edit sumber ASK</p><h1 className="mt-1 break-all text-3xl font-bold">{document.title}</h1></header>
      {query.saved === "1" && <p role="status" className="ui-alert-success p-3 text-sm text-emerald-900">Perubahan berhasil disimpan.</p>}
      <KnowledgeForm mode="edit" action={updateKnowledgeAction.bind(null, id)} initialValues={{ title: document.title, category: document.category ?? "custom", serviceKey: document.service_key ?? "", content: document.content, isMandatory: document.is_mandatory }} />
    </div>
  );
}
