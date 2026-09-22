"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signupAction } from "@/app/auth-actions";
import { PendingButton, SlowStatus } from "@/components/action-feedback";
import { PasswordField } from "@/components/password-field";
import { ValidatedInput } from "@/components/validated-input";

export function SignupForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signupAction, { message: "", status: "idle" as const });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  return <form action={action} className="mt-8 space-y-5">
    <p className="text-xs text-muted-foreground"><span className="text-rose-600">*</span> Wajib diisi</p>
    <ValidatedInput label="Email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={!configured || pending} optionalLabel={false} />
    <PasswordField label="Kata sandi" name="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" disabled={!configured || pending} />
    <PasswordField label="Konfirmasi kata sandi" name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" disabled={!configured || pending} validate={(value) => value && value !== password ? "Konfirmasi kata sandi belum sama." : ""} />
    <p className="text-xs text-muted-foreground">Gunakan minimal 8 karakter. Persyaratan tambahan mengikuti kebijakan keamanan sistem.</p>
    {state.message && <p role={state.status === "error" ? "alert" : "status"} className={`${state.status === "error" ? "ui-alert-error text-rose-900" : "ui-alert-success text-emerald-900"} px-3 py-2 text-sm`}>{state.message}</p>}
    <PendingButton pending={pending} pendingLabel="Mendaftarkan…" disabled={!configured} className="ui-primary w-full">Daftar Admin Desa</PendingButton>
    <SlowStatus active={pending}>Pendaftaran masih diproses…</SlowStatus>
    <p className="text-center text-sm text-muted-foreground">Sudah memiliki akun? <Link href="/login" className="font-semibold text-brand hover:underline">Masuk</Link></p>
  </form>;
}
