"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction } from "@/app/auth-actions";
import { PendingButton, SlowStatus } from "@/components/action-feedback";

export function SignupForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signupAction, { message: "" });
  return <form action={action} className="mt-8 space-y-5">
    <label className="block text-sm font-semibold">Email terverifikasi<input name="email" type="email" autoComplete="email" required disabled={!configured || pending} className="ui-control mt-1.5 px-3" /></label>
    <label className="block text-sm font-semibold">Kata sandi<input name="password" type="password" autoComplete="new-password" minLength={8} required disabled={!configured || pending} className="ui-control mt-1.5 px-3" /></label>
    <label className="block text-sm font-semibold">Konfirmasi kata sandi<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required disabled={!configured || pending} className="ui-control mt-1.5 px-3" /></label>
    {state.message && <p role="status" className="ui-alert-warning px-3 py-2 text-sm">{state.message}</p>}
    <PendingButton pending={pending} pendingLabel="Mendaftarkan…" disabled={!configured} className="ui-primary w-full">Daftar Admin Desa</PendingButton>
    <SlowStatus active={pending}>Pendaftaran masih diproses…</SlowStatus>
    <p className="text-center text-sm text-muted-foreground">Sudah memiliki akun? <Link href="/login" className="font-semibold text-brand hover:underline">Masuk</Link></p>
  </form>;
}
