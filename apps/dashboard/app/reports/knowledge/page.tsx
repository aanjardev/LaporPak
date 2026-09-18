import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";

import { getAdminAccessToken, requireSignedIn } from "@/lib/auth";
import { listKnowledgeDocuments } from "@/lib/knowledge";

import { createKnowledgeAction, deactivateKnowledgeAction } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const categoryLabels: Record<string, string> = {
  village_profile: "Profil desa",
  sop: "SOP",
  governance: "Pemerintahan",
  custom: "Lainnya",
};

export default async function KnowledgePage({ searchParams }: { searchParams: SearchParams }) {
  await requireSignedIn("/reports/knowledge");
  const params = await searchParams;
  let documents;
  try {
    documents = (await listKnowledgeDocuments(await getAdminAccessToken())).items;
  } catch {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">Sumber ASK belum dapat dimuat.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-sky-800">AI / ASK</p>
        <h1 className="text-3xl font-bold tracking-tight">Sumber pengetahuan</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">ASK hanya memakai sumber aktif dalam cakupan desa admin. Pencarian teks tersedia segera; embedding dapat diproses sesudahnya.</p>
      </header>

      {(params.saved || params.deleted) && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Perubahan berhasil disimpan.</p>}
      {params.error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">Perubahan gagal. Periksa isian dan cakupan desa.</p>}

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-sky-900"><Plus size={18} /> Tambah sumber</summary>
        <form action={createKnowledgeAction} className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">Judul<input required name="title" className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">Kategori<select name="category" className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal">{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm font-medium">Kunci layanan<input name="service_key" pattern="[a-z0-9_-]+" placeholder="contoh: office_hours" className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal" /></label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">ID unit administratif <span className="font-normal text-slate-500">Hanya wajib untuk system admin</span><input name="administrative_unit_id" placeholder="UUID desa" className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Isi Markdown<textarea required name="content" rows={10} className="rounded-lg border border-slate-300 p-3 font-mono text-sm font-normal" /></label>
          <label className="flex items-center gap-2 text-sm"><input name="is_mandatory" type="checkbox" /> Sumber wajib untuk desa</label>
          <button className="min-h-11 justify-self-start rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white hover:bg-sky-900">Simpan sumber</button>
        </form>
      </details>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Dokumen</h2><span className="text-sm text-slate-600">{documents.length} sumber</span></div>
        {documents.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600"><BookOpen className="mx-auto mb-3" />Belum ada sumber.</div>
        ) : (
          <div className="divide-y divide-slate-100">{documents.map((document) => (
            <article key={document.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div><Link className="font-semibold text-sky-800 hover:underline" href={`/reports/knowledge/${document.id}`}>{document.title}</Link><p className="mt-1 text-xs text-slate-600">{categoryLabels[document.category ?? "custom"] ?? document.category} · {document.processing_status} · {document.is_active ? "aktif" : "nonaktif"}</p></div>
              {document.is_active && <form action={deactivateKnowledgeAction}><input type="hidden" name="id" value={document.id} /><button className="min-h-10 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-800 hover:bg-red-50">Nonaktifkan</button></form>}
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}
