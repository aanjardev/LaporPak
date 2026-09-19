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

const reviewLabels = {
  draft: "Draf",
  demo: "Data uji",
  approved: "Disetujui",
  rejected: "Ditolak",
} as const;

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
      <header className="space-y-2">
        <p className="text-sm font-semibold text-sky-800">AI / ASK</p>
        <h1 className="text-3xl font-bold tracking-tight">Sumber pengetahuan</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">ASK hanya memakai sumber aktif dalam cakupan desa admin. Pencarian teks tersedia segera; embedding dapat diproses sesudahnya.</p>
      </header>

      {(params.saved === "1" || params.deleted === "1") && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{params.deleted === "1" ? "Sumber berhasil dinonaktifkan." : "Sumber berhasil disimpan."}</p>}
      {typeof params.error === "string" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{params.error === "not-found" ? "Sumber tidak ditemukan atau aksesnya telah berubah. Muat ulang daftar sebelum mencoba lagi." : params.error === "invalid" ? "Permintaan tidak valid. Muat ulang daftar sebelum mencoba lagi." : "Sumber belum dapat dinonaktifkan. Silakan coba lagi."}</p>}

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"><Plus aria-hidden="true" size={18} /> Tambah sumber</summary>
        <KnowledgeForm mode="create" action={createKnowledgeAction} initialValues={{ title: "", category: "village_profile", serviceKey: "", unitId: "", content: "", isMandatory: false }} />
      </details>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Dokumen</h2><span className="text-sm text-slate-600">{documents.length} sumber</span></div>
        {documents.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600"><BookOpen aria-hidden="true" className="mx-auto mb-3" />Belum ada sumber.</div>
        ) : (
          <div className="divide-y divide-slate-100">{documents.map((document) => (
            <article key={document.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0 flex-1"><Link className="break-all font-semibold text-sky-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" href={`/reports/knowledge/${document.id}`}>{document.title}</Link><p className="mt-1 text-xs leading-5 text-slate-600">{categoryLabels[document.category ?? "custom"] ?? document.category ?? "Lainnya"} · {processingLabels[document.processing_status] ?? document.processing_status} · {document.is_active ? "aktif" : "nonaktif"}</p><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{reviewLabels[document.review_status]}</span></div>
              {document.is_active && <DeactivateKnowledgeForm id={document.id} />}
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}
