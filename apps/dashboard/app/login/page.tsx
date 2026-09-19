import { AuthBackground } from "@/components/auth-background";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { safeReturnPath } from "@/lib/safe-return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; reauth?: string | string[] }> }) {
  const params = await searchParams;
  const next = safeReturnPath(params.next);
  const supabase = await createSupabaseServerClient();
  if (params.reauth !== "1" && supabase && (await supabase.auth.getClaims()).data?.claims) redirect(next);

  return (
    <main className="auth-surface">
      <AuthBackground />
      <div className="auth-panel">
        <BrandLogo />
        <p className="mt-6 text-sm font-semibold text-brand">LaporPak / Dashboard petugas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Masuk sebagai petugas</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Gunakan akun yang disiapkan pengelola untuk melihat laporan warga.</p>
        {params.reauth === "1" && <p role="alert" className="mt-5 ui-alert-warning px-3 py-2 text-sm text-amber-950">Sesi tidak diterima layanan laporan. Masuk kembali untuk melanjutkan.</p>}
        <LoginForm next={next} configured={Boolean(supabase)} />
      </div>
    </main>
  );
}
