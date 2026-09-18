import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminAccessToken, requireSignedIn } from "@/lib/auth";
import { getKnowledgeDocument } from "@/lib/knowledge";

import { updateKnowledgeAction } from "../actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function KnowledgeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  await requireSignedIn(`/reports/knowledge/${id}`);
  const query = await searchParams;
  let document;
  try {
    document = await getKnowledgeDocument(id, await getAdminAccessToken());
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/reports/knowledge" className="text-sm font-semibold text-sky-800 hover:underline">← Kembali ke sumber</Link>
      <header><p className="text-sm font-semibold text-sky-800">Edit sumber ASK</p><h1 className="mt-1 text-3xl font-bold">{document.title}</h1></header>
      {query.saved && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Perubahan berhasil disimpan.</p>}
      {query.error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">Perubahan gagal disimpan.</p>}
      <form action={updateKnowledgeAction.bind(null, id)} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="grid gap-1.5 text-sm font-medium">Judul<input required name="title" defaultValue={document.title} className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">Kategori<select name="category" defaultValue={document.category ?? "custom"} className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal"><option value="village_profile">Profil desa</option><option value="sop">SOP</option><option value="governance">Pemerintahan</option><option value="custom">Lainnya</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium">Kunci layanan<input name="service_key" pattern="[a-z0-9_-]+" defaultValue={document.service_key ?? ""} className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal" /></label>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">Isi Markdown<textarea required name="content" defaultValue={document.content} rows={16} className="rounded-lg border border-slate-300 p-3 font-mono text-sm font-normal" /></label>
        <label className="flex items-center gap-2 text-sm"><input name="is_mandatory" type="checkbox" defaultChecked={document.is_mandatory} /> Sumber wajib untuk desa</label>
        <button className="min-h-11 justify-self-start rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white hover:bg-sky-900">Simpan perubahan</button>
      </form>
    </div>
  );
}
