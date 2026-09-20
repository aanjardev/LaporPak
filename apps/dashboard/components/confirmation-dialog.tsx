"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircle, X } from "lucide-react";
import { useState } from "react";

export function ConfirmationDialog({
  open, onOpenChange, title, description, confirmLabel, pending = false,
  tone = "default", reasonLabel, reasonRequired = false, onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  tone?: "default" | "danger";
  reasonLabel?: string;
  reasonRequired?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  async function confirm() {
    if (reasonRequired && !reason.trim()) { setError("Alasan wajib diisi sebelum melanjutkan."); return; }
    const value = reason.trim();
    setReason(""); setError("");
    await onConfirm(value);
  }
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!pending) { if (!next) { setReason(""); setError(""); } onOpenChange(next); } }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-brand/55" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start gap-4"><div className="min-w-0 flex-1"><Dialog.Title className="text-lg font-bold">{title}</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">{description}</Dialog.Description></div><Dialog.Close aria-label="Tutup dialog" disabled={pending} className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md"><X size={19} /></Dialog.Close></div>
        {reasonLabel && <label className="mt-5 block text-sm font-semibold">{reasonLabel}{reasonRequired && <span className="ml-1 text-rose-600">*</span>}<textarea autoFocus rows={4} value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} disabled={pending} className="ui-control mt-2 p-3 font-normal" /></label>}
        {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Dialog.Close disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded-md border border-input px-4 text-sm font-semibold">Batal</Dialog.Close><button type="button" onClick={() => void confirm()} disabled={pending} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold ${tone === "danger" ? "bg-rose-700 text-white hover:bg-rose-800" : "bg-primary text-primary-foreground hover:bg-primary-hover"}`}>{pending && <LoaderCircle size={17} className="animate-spin" />}{pending ? "Memproses…" : confirmLabel}</button></div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
