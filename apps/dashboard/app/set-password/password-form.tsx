"use client";

import { useActionState, useState } from "react";
import { setPasswordAction } from "@/app/auth-actions";
import { PendingButton, SlowStatus } from "@/components/action-feedback";
import { PasswordField } from "@/components/password-field";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setPasswordAction, { message: "", status: "idle" as const });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <form action={action} className="mt-8 space-y-5">
      <p className="text-xs text-muted-foreground"><span className="text-rose-600">*</span> Wajib diisi</p>
      <PasswordField label="Kata sandi baru" name="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" disabled={pending} />
      <PasswordField label="Ulangi kata sandi baru" name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" disabled={pending} validate={(value) => value && value !== password ? "Konfirmasi kata sandi belum sama." : ""} />
      {state.message && <p role="alert" className="ui-alert-error px-3 py-2 text-sm text-rose-900">{state.message}</p>}
      <PendingButton type="submit" pending={pending} pendingLabel="Menyimpan kata sandi…" className="ui-primary w-full disabled:cursor-not-allowed disabled:bg-slate-400">Simpan kata sandi</PendingButton>
      <SlowStatus active={pending} />
    </form>
  );
}
