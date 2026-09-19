import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";

import { getAdminAccessToken, requireSignedIn } from "@/lib/auth";
import { KnowledgeApiError, listKnowledgeDocuments } from "@/lib/knowledge";

import { createKnowledgeAction } from "./actions";
import { DeactivateKnowledgeForm, KnowledgeForm } from "./knowledge-form";
import { KnowledgeUnavailable } from "./knowledge-unavailable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const categoryLabels: Record<string, string> = {
  village_profile: "Profil desa",
  sop: "SOP",
  governance: "Pemerintahan",
  custom: "Lainnya",
};

const processingLabels: Record<string, string> = {
  pending: "Menunggu pemrosesan",
  processing: "Sedang diproses",
  ready: "Siap digunakan",
  failed: "Pemrosesan gagal",
};

export default async function KnowledgePage({ searchParams }: { searchParams: SearchParams }) {
  await requireSignedIn("/reports/knowledge");
  const params = await searchParams;
  let documents;
  try {
    documents = (await listKnowledgeDocuments(await getAdminAccessToken())).items;
  } catch (error) {
    if (error instanceof KnowledgeApiError && error.status === 401) {
      redirect(`/login?reauth=1&next=${encodeURIComponent("/reports/knowledge")}`);
    }
    if (error instanceof KnowledgeApiError && error.status === 403) redirect("/access-denied");
    return <KnowledgeUnavailable />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="ui-page-header">
        <p className="text-sm font-semibold text-brand">AI / ASK</p>
        <h1 className="text-3xl font-bold tracking-tight">Sumber pengetahuan</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">ASK hanya memakai sumber aktif dalam cakupan desa admin. Pencarian teks tersedia segera; embedding dapat diproses sesudahnya.</p>
      </header>

      {(params.saved === "1" || params.deleted === "1") && <p role="status" className="ui-alert-success p-3 text-sm text-emerald-900">{params.deleted === "1" ? "Sumber berhasil dinonaktifkan." : "Sumber berhasil disimpan."}</p>}
      {typeof params.error === "string" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{params.error === "not-found" ? "Sumber tidak ditemukan atau aksesnya telah berubah. Muat ulang daftar sebelum mencoba lagi." : params.error === "invalid" ? "Permintaan tidak valid. Muat ulang daftar sebelum mencoba lagi." : "Sumber belum dapat dinonaktifkan. Silakan coba lagi."}</p>}

      <details className="ui-panel p-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><Plus aria-hidden="true" size={18} /> Tambah sumber</summary>
        <KnowledgeForm mode="create" action={createKnowledgeAction} initialValues={{ title: "", category: "village_profile", serviceKey: "", unitId: "", content: "", isMandatory: false }} />
      </details>

      <section className="overflow-hidden ui-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="font-semibold">Dokumen</h2><span className="text-sm text-muted-foreground">{documents.length} sumber</span></div>
        {documents.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground"><BookOpen aria-hidden="true" className="mx-auto mb-3" />Belum ada sumber.</div>
        ) : (
          <div className="divide-y divide-border">{documents.map((document) => (
            <article key={document.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0 flex-1"><Link className="break-all font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href={`/reports/knowledge/${document.id}`}>{document.title}</Link><p className="mt-1 text-xs leading-5 text-muted-foreground">{categoryLabels[document.category ?? "custom"] ?? document.category ?? "Lainnya"} · {processingLabels[document.processing_status] ?? document.processing_status} · {document.is_active ? "aktif" : "nonaktif"}</p></div>
              {document.is_active && <DeactivateKnowledgeForm id={document.id} />}
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}
