import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import { getAdminAccessToken, requireSignedIn } from "@/lib/auth";
import { KnowledgeApiError, listKnowledgeDocuments } from "@/lib/knowledge";
import { knowledgeDetailPath, knowledgeSettingsPath } from "@/lib/knowledge-route";
import { createKnowledgeAction } from "@/app/reports/knowledge/actions";
import { DeactivateKnowledgeForm, KnowledgeForm } from "@/app/reports/knowledge/knowledge-form";
import { KnowledgeUnavailable } from "@/app/reports/knowledge/knowledge-unavailable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const categoryLabels: Record<string, string> = { village_profile: "Profil desa", sop: "SOP", governance: "Pemerintahan", custom: "Lainnya" };
const processingLabels: Record<string, string> = { pending: "Menunggu pemrosesan", processing: "Sedang diproses", ready: "Siap digunakan", failed: "Pemrosesan gagal" };
const reviewLabels = { draft: "Draf", demo: "Data uji", approved: "Disetujui", rejected: "Ditolak" } as const;

export default async function KnowledgeSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.REPORTS_DATA_SOURCE !== "api") redirect("/reports/settings");
  await requireSignedIn(knowledgeSettingsPath);
  const params = await searchParams;
  let documents;
  try {
    documents = (await listKnowledgeDocuments(await getAdminAccessToken())).items;
  } catch (error) {
    if (error instanceof KnowledgeApiError && error.status === 401) redirect(`/login?reauth=1&next=${encodeURIComponent(knowledgeSettingsPath)}`);
    if (error instanceof KnowledgeApiError && error.status === 403) redirect("/access-denied");
    return <KnowledgeUnavailable />;
  }

  return <div className="space-y-7">
    <div><p className="text-sm font-semibold text-brand">AI / ASK</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Sumber pengetahuan</h2><p className="mt-2 text-sm text-muted-foreground">Kelola informasi yang dipakai asisten saat menjawab pertanyaan warga.</p></div>
    {(params.saved === "1" || params.deleted === "1") && <p role="status" className="ui-alert-success p-3 text-sm text-emerald-900">{params.deleted === "1" ? "Sumber berhasil dinonaktifkan." : "Sumber berhasil disimpan."}</p>}
    {typeof params.error === "string" && <p role="alert" className="ui-alert-error p-3 text-sm text-rose-900">{params.error === "not-found" ? "Sumber tidak ditemukan atau aksesnya telah berubah. Muat ulang daftar sebelum mencoba lagi." : params.error === "invalid" ? "Permintaan tidak valid. Muat ulang daftar sebelum mencoba lagi." : "Sumber belum dapat dinonaktifkan. Silakan coba lagi."}</p>}
    <details className="ui-panel p-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-brand"><Plus aria-hidden="true" size={18} /> Tambah sumber</summary>
      <KnowledgeForm mode="create" action={createKnowledgeAction} initialValues={{ title: "", category: "village_profile", serviceKey: "", unitId: "", content: "", isMandatory: false }} />
    </details>
    <section className="ui-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="font-semibold">Dokumen</h2><span className="text-sm text-muted-foreground">{documents.length} sumber</span></div>
      {documents.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground"><BookOpen aria-hidden="true" className="mx-auto mb-3" />Belum ada sumber. Tambahkan informasi layanan agar ASK dapat menjawab warga.</div> : <div className="divide-y divide-border">{documents.map((document) => <article key={document.id} className="group relative flex min-w-0 flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-background focus-within:bg-background">
        <div className="min-w-0 flex-1"><Link aria-label={`Buka detail sumber ${document.title}`} className="break-all font-semibold text-brand after:absolute after:inset-0 after:z-10 after:content-[''] group-hover:underline" href={knowledgeDetailPath(document.id)}>{document.title}</Link><p className="mt-1 text-xs leading-5 text-muted-foreground">{categoryLabels[document.category ?? "custom"] ?? document.category ?? "Lainnya"} · {processingLabels[document.processing_status] ?? document.processing_status} · {document.is_active ? "aktif" : "nonaktif"}</p><span className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">{reviewLabels[document.review_status]}</span></div>
        {document.is_active && <DeactivateKnowledgeForm id={document.id} />}
      </article>)}</div>}
    </section>
  </div>;
}
