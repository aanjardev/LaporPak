import { AuthBackground } from "@/components/auth-background";
import { BrandLogo } from "@/components/brand-logo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient();
  if (supabase && (await supabase.auth.getClaims()).data?.claims) redirect("/");
  return <main className="auth-surface"><AuthBackground /><div className="auth-panel">
    <BrandLogo />
    <p className="mt-6 text-sm font-semibold text-brand">Pendaftaran mandiri</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight">Daftar Admin Desa</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Verifikasi email, lengkapi profil desa, lalu ajukan aktivasi kepada Super Admin.</p>
    <SignupForm configured={Boolean(supabase)} />
  </div></main>;
}
