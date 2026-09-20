"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deactivateKnowledgeAction,
  type KnowledgeFormState,
  reviewKnowledgeAction,
} from "./actions";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";

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
  const dirty = useMemo(() =>
    values.title !== initialValues.title ||
    values.category !== initialValues.category ||
    values.serviceKey !== initialValues.serviceKey ||
    values.content !== initialValues.content ||
    values.isMandatory !== initialValues.isMandatory ||
    (values.unitId ?? "") !== (initialValues.unitId ?? ""),
  [initialValues, values]);

  return (
    <form action={formAction} onSubmit={(event) => { if (pending) event.preventDefault(); }} className={mode === "create" ? "mt-5 grid min-w-0 gap-4" : "grid min-w-0 gap-4 ui-panel p-5 "}>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">Judul
        <input required maxLength={300} name="title" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} className="ui-control px-3 font-normal" />
      </label>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-sm font-medium">Kategori
          <select name="category" value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })} className="ui-control px-3 font-normal">
            {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium">Kunci layanan
          <input name="service_key" pattern="[a-z0-9_-]+" required={mode === "edit" && Boolean(initialValues.serviceKey)} value={values.serviceKey} onChange={(event) => setValues({ ...values, serviceKey: event.target.value })} placeholder="contoh: office_hours" className="ui-control px-3 font-normal" />
        </label>
      </div>
      {mode === "edit" && initialValues.serviceKey && <p className="text-xs leading-5 text-muted-foreground">Kunci layanan yang sudah ada dapat diubah, tetapi belum dapat dikosongkan.</p>}
      {mode === "create" && (
        <label className="grid min-w-0 gap-1.5 text-sm font-medium">ID unit administratif <span className="font-normal text-muted-foreground">Hanya wajib untuk admin sistem</span>
          <input name="administrative_unit_id" value={values.unitId ?? ""} onChange={(event) => setValues({ ...values, unitId: event.target.value })} placeholder="UUID desa" className="ui-control px-3 font-normal" />
        </label>
      )}
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">Isi Markdown
        <textarea required name="content" value={values.content} onChange={(event) => setValues({ ...values, content: event.target.value })} rows={mode === "create" ? 10 : 16} className="ui-control p-3 font-mono font-normal" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input name="is_mandatory" type="checkbox" checked={values.isMandatory} onChange={(event) => setValues({ ...values, isMandatory: event.target.checked })} className="size-4 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" /> Sumber wajib untuk desa
      </label>
      {!pending && state.message && <p role="alert" className="ui-alert-error p-3 text-sm leading-6 text-rose-900">{state.message}</p>}
      {pending && <p role="status" className="text-sm text-muted-foreground">{mode === "create" ? "Menyimpan sumber…" : "Menyimpan perubahan…"}</p>}
      <button type="submit" disabled={pending} className="ui-primary justify-self-start">
        {pending ? "Menyimpan…" : mode === "create" ? "Simpan sumber" : "Simpan perubahan"}
      </button>
      <UnsavedChangesGuard active={dirty && !pending} />
    </form>
  );
}

export function DeactivateKnowledgeForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const confirmed = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={deactivateKnowledgeAction} onSubmit={(event) => { if (!confirmed.current) { event.preventDefault(); setOpen(true); } else { confirmed.current = false; } }} className="relative z-20">
      <input type="hidden" name="id" value={id} />
      <DeactivateButton />
      <ConfirmationDialog open={open} onOpenChange={setOpen} title="Nonaktifkan sumber ASK?" description="Sumber ini tidak lagi dipakai untuk menjawab warga. Isinya tetap tersimpan dan dapat diaudit." confirmLabel="Nonaktifkan sumber" tone="danger" onConfirm={() => { confirmed.current = true; setOpen(false); form.current?.requestSubmit(); }} />
    </form>
  );
}

function DeactivateButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60">{pending ? "Menonaktifkan…" : "Nonaktifkan"}</button>;
}

export function KnowledgeReviewForm({
  id,
  transitions,
}: {
  id: string;
  transitions: Array<"draft" | "demo" | "approved" | "rejected">;
}) {
  const [state, action, pending] = useActionState(
    reviewKnowledgeAction.bind(null, id),
    { message: null },
  );
  const options = transitions.filter(
    (status): status is "approved" | "rejected" =>
      status === "approved" || status === "rejected",
  );
  if (options.length === 0) return null;
  return (
    <form action={action} className="grid gap-4 ui-panel p-5">
      <h2 className="font-semibold text-foreground">Keputusan review</h2>
      <label className="grid gap-1.5 text-sm font-medium">
        Status
        <select name="status" required className="ui-control px-3 font-normal">
          {options.map((status) => (
            <option key={status} value={status}>{status === "approved" ? "Setujui" : "Tolak / cabut persetujuan"}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Alasan
        <textarea name="reason" required minLength={1} maxLength={1000} rows={4} className="ui-control p-3 font-normal" />
      </label>
      {state.message && <p role="alert" className="ui-alert-error p-3 text-sm text-rose-900">{state.message}</p>}
      <button disabled={pending} className="ui-primary justify-self-start">
        {pending ? "Menyimpan…" : "Simpan keputusan"}
      </button>
    </form>
  );
}
