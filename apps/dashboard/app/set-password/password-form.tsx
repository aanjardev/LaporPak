"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/app/auth-actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setPasswordAction, { message: "" });

  return (
    <form action={action} className="mt-8 space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold text-slate-800">Kata sandi baru</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required disabled={pending} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-200 disabled:bg-slate-100" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirmation" className="block text-sm font-semibold text-slate-800">Ulangi kata sandi baru</label>
        <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required disabled={pending} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-200 disabled:bg-slate-100" />
      </div>
      {state.message && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{state.message}</p>}
      <button type="submit" disabled={pending} className="flex min-h-11 w-full items-center justify-center rounded-lg bg-sky-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400">
        {pending ? "Menyimpan kata sandi…" : "Simpan kata sandi"}
      </button>
    </form>
  );
}
