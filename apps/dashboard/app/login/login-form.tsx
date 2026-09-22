"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/auth-actions";
import Link from "next/link";
import { PendingButton, SlowStatus } from "@/components/action-feedback";
import { PasswordField } from "@/components/password-field";
import { ValidatedInput } from "@/components/validated-input";

export function LoginForm({ next, configured }: { next: string; configured: boolean }) {
  const [state, action, pending] = useActionState(loginAction, { message: "", status: "idle" as const });
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />
      <p className="text-xs text-muted-foreground"><span className="text-rose-600">*</span> Wajib diisi</p>
      <ValidatedInput label="Email petugas" name="email" type="email" autoComplete="username" maxLength={254} required disabled={!configured || pending} placeholder="nama@desa.go.id" optionalLabel={false} />
      <PasswordField label="Kata sandi" name="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={!configured || pending} />
      {state.message && <p role="alert" className="ui-alert-error px-3 py-2 text-sm text-rose-900">{state.message}</p>}
      {!configured && <p role="alert" className="ui-alert-warning px-3 py-2 text-sm text-amber-900">Login belum dikonfigurasi. Hubungi pengelola sistem.</p>}
      <PendingButton type="submit" pending={pending} pendingLabel="Sedang masuk…" disabled={!configured} className="ui-primary w-full disabled:cursor-not-allowed disabled:bg-slate-400">Masuk</PendingButton>
      <SlowStatus active={pending}>Masih memeriksa akun…</SlowStatus>
      <p className="text-center text-sm text-muted-foreground">Belum memiliki akun? <Link href="/signup" className="font-semibold text-brand underline-offset-4 hover:underline">Daftar Admin Desa</Link></p>
    </form>
  );
}
