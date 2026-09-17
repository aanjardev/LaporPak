"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "@/app/auth-actions";

export function AcceptInvitationForm({ tokenHash, configured }: { tokenHash: string; configured: boolean }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, { message: "" });

  return (
    <form action={action} className="mt-7">
      <input type="hidden" name="token_hash" value={tokenHash} />
      {state.message && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{state.message}</p>}
      {!configured && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Undangan belum dikonfigurasi. Hubungi pengelola sistem.</p>}
      <button type="submit" disabled={!configured || pending} className="flex min-h-11 w-full items-center justify-center rounded-lg bg-sky-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400">
        {pending ? "Memeriksa undangan…" : "Terima undangan"}
      </button>
    </form>
  );
}
