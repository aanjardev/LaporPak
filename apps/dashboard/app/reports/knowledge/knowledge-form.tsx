"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { deactivateKnowledgeAction, type KnowledgeFormState } from "./actions";

type Values = {
  title: string;
  category: string;
  serviceKey: string;
  content: string;
  isMandatory: boolean;
  unitId?: string;
};

type Props = {
  action: (state: KnowledgeFormState, formData: FormData) => Promise<KnowledgeFormState>;
  initialValues: Values;
  mode: "create" | "edit";
};

const categoryOptions = [
  ["village_profile", "Profil desa"],
  ["sop", "SOP"],
  ["governance", "Pemerintahan"],
  ["custom", "Lainnya"],
] as const;

export function KnowledgeForm({ action, initialValues, mode }: Props) {
  const [state, formAction, pending] = useActionState(action, { message: null });
  const [values, setValues] = useState(initialValues);

  return (
    <form action={formAction} onSubmit={(event) => { if (pending) event.preventDefault(); }} className={mode === "create" ? "mt-5 grid min-w-0 gap-4" : "grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"}>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">Judul
        <input required maxLength={300} name="title" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" />
      </label>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-sm font-medium">Kategori
          <select name="category" value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })} className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
            {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium">Kunci layanan
          <input name="service_key" pattern="[a-z0-9_-]+" required={mode === "edit" && Boolean(initialValues.serviceKey)} value={values.serviceKey} onChange={(event) => setValues({ ...values, serviceKey: event.target.value })} placeholder="contoh: office_hours" className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" />
        </label>
      </div>
      {mode === "edit" && initialValues.serviceKey && <p className="text-xs leading-5 text-slate-600">Kunci layanan yang sudah ada dapat diubah, tetapi belum dapat dikosongkan.</p>}
      {mode === "create" && (
        <label className="grid min-w-0 gap-1.5 text-sm font-medium">ID unit administratif <span className="font-normal text-slate-500">Hanya wajib untuk admin sistem</span>
          <input name="administrative_unit_id" value={values.unitId ?? ""} onChange={(event) => setValues({ ...values, unitId: event.target.value })} placeholder="UUID desa" className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" />
        </label>
      )}
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">Isi Markdown
        <textarea required name="content" value={values.content} onChange={(event) => setValues({ ...values, content: event.target.value })} rows={mode === "create" ? 10 : 16} className="w-full min-w-0 rounded-lg border border-slate-300 p-3 font-mono text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input name="is_mandatory" type="checkbox" checked={values.isMandatory} onChange={(event) => setValues({ ...values, isMandatory: event.target.checked })} className="size-4 accent-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" /> Sumber wajib untuk desa
      </label>
      {!pending && state.message && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">{state.message}</p>}
      {pending && <p role="status" className="text-sm text-slate-600">{mode === "create" ? "Menyimpan sumber…" : "Menyimpan perubahan…"}</p>}
      <button type="submit" disabled={pending} className="min-h-11 justify-self-start rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-wait disabled:opacity-60">
        {pending ? "Menyimpan…" : mode === "create" ? "Simpan sumber" : "Simpan perubahan"}
      </button>
    </form>
  );
}

export function DeactivateKnowledgeForm({ id }: { id: string }) {
  return (
    <form action={deactivateKnowledgeAction}>
      <input type="hidden" name="id" value={id} />
      <DeactivateButton />
    </form>
  );
}

function DeactivateButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60">{pending ? "Menonaktifkan…" : "Nonaktifkan"}</button>;
}
