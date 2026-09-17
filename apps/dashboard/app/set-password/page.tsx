import { KeyRound } from "lucide-react";
import { requireSignedIn } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export default async function SetPasswordPage() {
  await requireSignedIn("/reports");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <span className="inline-flex size-12 items-center justify-center rounded-xl bg-sky-800 text-white"><KeyRound aria-hidden="true" size={25} /></span>
        <p className="mt-6 text-sm font-semibold text-sky-800">LaporPak / Akun petugas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Atur kata sandi</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Buat kata sandi pribadi untuk masuk kembali ke dashboard petugas.</p>
        <PasswordForm />
      </div>
    </main>
  );
}
