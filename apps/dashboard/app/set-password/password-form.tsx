"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/app/auth-actions";
import { PendingButton, SlowStatus } from "@/components/action-feedback";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setPasswordAction, { message: "" });

  return (
    <form action={action} className="mt-8 space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold text-foreground">Kata sandi baru</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required disabled={pending} className="ui-control px-3 disabled:bg-muted" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirmation" className="block text-sm font-semibold text-foreground">Ulangi kata sandi baru</label>
        <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required disabled={pending} className="ui-control px-3 disabled:bg-muted" />
      </div>
      {state.message && <p role="alert" className="ui-alert-error px-3 py-2 text-sm text-rose-900">{state.message}</p>}
      <PendingButton type="submit" pending={pending} pendingLabel="Menyimpan kata sandi…" className="ui-primary w-full disabled:cursor-not-allowed disabled:bg-slate-400">Simpan kata sandi</PendingButton>
      <SlowStatus active={pending} />
    </form>
  );
}
