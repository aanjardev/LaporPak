import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAdminAccessToken, requireSignedIn } from "@/lib/auth";
import { getKnowledgeDocument, KnowledgeApiError } from "@/lib/knowledge";

import { updateKnowledgeAction } from "../actions";
import { KnowledgeForm, KnowledgeReviewForm } from "../knowledge-form";
import { KnowledgeUnavailable } from "../knowledge-unavailable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const reviewLabels = {
  draft: "Draf",
  demo: "Data uji",
  approved: "Disetujui",
  rejected: "Ditolak",
} as const;

export default async function KnowledgeDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
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
      <Link href="/reports/knowledge" className="inline-flex min-h-11 items-center text-sm font-semibold text-sky-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">← Kembali ke sumber</Link>
      <header className="min-w-0">
        <p className="text-sm font-semibold text-sky-800">Edit sumber ASK</p>
        <h1 className="mt-1 break-all text-3xl font-bold">{document.title}</h1>
        <p className="mt-2 text-sm text-slate-600">Status review: <strong>{reviewLabels[document.review_status]}</strong>{document.reviewer_display_name ? ` · ${document.reviewer_display_name}` : ""}</p>
      </header>
      {query.saved === "1" && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Perubahan berhasil disimpan.</p>}
      {query.reviewed === "1" && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Keputusan review berhasil disimpan.</p>}
      <KnowledgeForm mode="edit" action={updateKnowledgeAction.bind(null, id)} initialValues={{ title: document.title, category: document.category ?? "custom", serviceKey: document.service_key ?? "", content: document.content, isMandatory: document.is_mandatory }} />
      <KnowledgeReviewForm id={id} transitions={document.allowed_review_transitions} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Riwayat review</h2>
        {document.review_history.length === 0 ? <p className="mt-3 text-sm text-slate-600">Belum ada keputusan review.</p> : (
          <ol className="mt-4 space-y-4">{document.review_history.map((entry, index) => (
            <li key={`${entry.created_at}-${index}`} className="border-l-2 border-sky-200 pl-4 text-sm">
              <p className="font-semibold">{reviewLabels[entry.new_status]}</p>
              <p className="mt-1 text-slate-600">{entry.actor_display_name ?? "Aktor tidak tersedia"} · {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(entry.created_at))}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{entry.reason}</p>
            </li>
          ))}</ol>
        )}
      </section>
    </div>
  );
}
