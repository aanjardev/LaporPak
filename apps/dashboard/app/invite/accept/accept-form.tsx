"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "@/app/auth-actions";
import { PendingButton, SlowStatus } from "@/components/action-feedback";

export function AcceptInvitationForm({ tokenHash, configured }: { tokenHash: string; configured: boolean }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, { message: "", status: "idle" as const });

  return (
    <form action={action} className="mt-7">
      <input type="hidden" name="token_hash" value={tokenHash} />
      {state.message && <p role="alert" className="mb-4 ui-alert-error px-3 py-2 text-sm text-rose-900">{state.message}</p>}
      {!configured && <p role="alert" className="mb-4 ui-alert-warning px-3 py-2 text-sm text-amber-900">Undangan belum dikonfigurasi. Hubungi pengelola sistem.</p>}
      <PendingButton type="submit" pending={pending} pendingLabel="Memeriksa undangan…" disabled={!configured} className="ui-primary w-full disabled:cursor-not-allowed disabled:bg-slate-400">Terima undangan</PendingButton>
      <div className="mt-2"><SlowStatus active={pending} /></div>
    </form>
  );
}
