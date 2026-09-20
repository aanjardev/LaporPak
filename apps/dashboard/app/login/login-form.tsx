"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/auth-actions";
import Link from "next/link";

export function LoginForm({ next, configured }: { next: string; configured: boolean }) {
  const [state, action, pending] = useActionState(loginAction, { message: "" });

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-semibold text-foreground">Email petugas</label>
        <input id="email" name="email" type="email" autoComplete="username" required disabled={!configured || pending} placeholder="nama@desa.go.id" className="ui-control px-3 disabled:bg-muted" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold text-foreground">Kata sandi</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required disabled={!configured || pending} className="ui-control px-3 disabled:bg-muted" />
      </div>
      {state.message && <p role="alert" className="ui-alert-error px-3 py-2 text-sm text-rose-900">{state.message}</p>}
      {!configured && <p role="alert" className="ui-alert-warning px-3 py-2 text-sm text-amber-900">Login belum dikonfigurasi. Hubungi pengelola sistem.</p>}
      <button type="submit" disabled={!configured || pending} className="ui-primary w-full disabled:cursor-not-allowed disabled:bg-slate-400">
        {pending ? "Sedang masuk…" : "Masuk"}
      </button>
      <p className="text-center text-sm text-muted-foreground">Belum memiliki akun? <Link href="/signup" className="font-semibold text-brand underline-offset-4 hover:underline">Daftar Admin Desa</Link></p>
    </form>
  );
}
