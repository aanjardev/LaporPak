import { reportsDataSource } from "@/lib/reports-data-source";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminAccessToken, requireSignedIn } from "@/lib/auth";
import { getKnowledgeDocument, KnowledgeApiError } from "@/lib/knowledge";
import { knowledgeDetailPath, knowledgeSettingsPath } from "@/lib/knowledge-route";
import { updateKnowledgeAction } from "@/app/reports/knowledge/actions";
import { KnowledgeForm, KnowledgeReviewForm } from "@/app/reports/knowledge/knowledge-form";
import { KnowledgeUnavailable } from "@/app/reports/knowledge/knowledge-unavailable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const reviewLabels = { draft: "Draf", demo: "Data simulasi", approved: "Disetujui", rejected: "Ditolak" } as const;

export default async function KnowledgeSettingsDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  if (reportsDataSource() === "mock") redirect("/reports/settings");
  const { id } = await params;
  const returnPath = knowledgeDetailPath(id);
  await requireSignedIn(returnPath);
  const query = await searchParams;
  let document;
  try {
    document = await getKnowledgeDocument(id, await getAdminAccessToken());
  } catch (error) {
    if (error instanceof KnowledgeApiError) {
      if (error.status === 401) redirect(`/login?reauth=1&next=${encodeURIComponent(returnPath)}`);
      if (error.status === 403) redirect("/access-denied");
      if (error.status === 404) notFound();
    }
    return <KnowledgeUnavailable />;
  }

  return <div className="max-w-4xl space-y-6">
    <Link href={knowledgeSettingsPath} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">← Kembali ke sumber</Link>
    <header className="min-w-0"><p className="text-sm font-semibold text-brand">Edit sumber ASK</p><h2 className="mt-1 break-all text-2xl font-bold">{document.title}</h2><p className="mt-2 text-sm text-muted-foreground">Status review: <strong>{reviewLabels[document.review_status]}</strong>{document.reviewer_display_name ? ` · ${document.reviewer_display_name}` : ""}</p></header>
    {query.saved === "1" && <p role="status" className="ui-alert-success p-3 text-sm text-emerald-900">Perubahan berhasil disimpan.</p>}
    {query.reviewed === "1" && <p role="status" className="ui-alert-success p-3 text-sm text-emerald-900">Keputusan review berhasil disimpan.</p>}
    <KnowledgeForm mode="edit" action={updateKnowledgeAction.bind(null, id)} initialValues={{ title: document.title, category: document.category ?? "custom", serviceKey: document.service_key ?? "", content: document.content, isMandatory: document.is_mandatory }} />
    <KnowledgeReviewForm id={id} transitions={document.allowed_review_transitions} />
    <section className="ui-panel p-5"><h2 className="font-semibold">Riwayat review</h2>{document.review_history.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Belum ada keputusan review.</p> : <ol className="mt-4 space-y-4">{document.review_history.map((entry, index) => <li key={`${entry.created_at}-${index}`} className="border-l-2 border-primary/40 pl-4 text-sm"><p className="font-semibold">{reviewLabels[entry.new_status]}</p><p className="mt-1 text-muted-foreground">{entry.actor_display_name ?? "Aktor tidak tersedia"} · {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(entry.created_at))}</p><p className="mt-1 whitespace-pre-wrap text-foreground">{entry.reason}</p></li>)}</ol>}</section>
  </div>;
}
