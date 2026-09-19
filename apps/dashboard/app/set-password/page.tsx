import { BrandLogo } from "@/components/brand-logo";
import { requireSignedIn } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export default async function SetPasswordPage() {
  await requireSignedIn("/reports");

  return (
    <main className="auth-surface">
      <div className="auth-panel">
        <BrandLogo />
        <p className="mt-6 text-sm font-semibold text-brand">LaporPak / Akun petugas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Atur kata sandi</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Buat kata sandi pribadi untuk masuk kembali ke dashboard petugas.</p>
        <PasswordForm />
      </div>
    </main>
  );
}
