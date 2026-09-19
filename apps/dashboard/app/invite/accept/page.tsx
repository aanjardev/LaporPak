import { AuthBackground } from "@/components/auth-background";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { AcceptInvitationForm } from "./accept-form";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token_hash?: string | string[] }> }) {
  const { token_hash: tokenHash } = await searchParams;
  const validLink = typeof tokenHash === "string" && Boolean(tokenHash);

  return (
    <main className="auth-surface">
      <AuthBackground />
      <div className="auth-panel">
        <BrandLogo />
        <p className="mt-6 text-sm font-semibold text-brand">LaporPak / Akun petugas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Terima undangan</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Lanjutkan untuk mengaktifkan akun dan mengatur kata sandi pribadi Anda.</p>
        {validLink ? (
          <AcceptInvitationForm tokenHash={tokenHash} configured={Boolean(getSupabaseConfig())} />
        ) : (
          <p role="alert" className="mt-7 ui-alert-error px-3 py-2 text-sm text-rose-900">Tautan undangan tidak lengkap. Minta undangan baru kepada pengelola.</p>
        )}
        <Link href="/login" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Kembali ke login</Link>
      </div>
    </main>
  );
}
