"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "@/app/auth-actions";

export function AcceptInvitationForm({ tokenHash, configured }: { tokenHash: string; configured: boolean }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, { message: "" });

  return (
    <form action={action} className="mt-7">
      <input type="hidden" name="token_hash" value={tokenHash} />
      {state.message && <p role="alert" className="mb-4 ui-alert-error px-3 py-2 text-sm text-rose-900">{state.message}</p>}
      {!configured && <p role="alert" className="mb-4 ui-alert-warning px-3 py-2 text-sm text-amber-900">Undangan belum dikonfigurasi. Hubungi pengelola sistem.</p>}
      <button type="submit" disabled={!configured || pending} className="ui-primary w-full disabled:cursor-not-allowed disabled:bg-slate-400">
        {pending ? "Memeriksa undangan…" : "Terima undangan"}
      </button>
    </form>
  );
}
