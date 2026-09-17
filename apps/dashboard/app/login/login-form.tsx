"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/auth-actions";

export function LoginForm({ next, configured }: { next: string; configured: boolean }) {
  const [state, action, pending] = useActionState(loginAction, { message: "" });

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-semibold text-slate-800">Email petugas</label>
        <input id="email" name="email" type="email" autoComplete="username" required disabled={!configured || pending} placeholder="nama@desa.go.id" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none placeholder:text-slate-500 focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-200 disabled:bg-slate-100" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold text-slate-800">Kata sandi</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required disabled={!configured || pending} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-200 disabled:bg-slate-100" />
      </div>
      {state.message && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{state.message}</p>}
      {!configured && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Login belum dikonfigurasi. Hubungi pengelola sistem.</p>}
      <button type="submit" disabled={!configured || pending} className="flex min-h-11 w-full items-center justify-center rounded-lg bg-sky-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400">
        {pending ? "Sedang masuk…" : "Masuk"}
      </button>
    </form>
  );
}
