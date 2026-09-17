import Link from "next/link";
import { MailCheck } from "lucide-react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { AcceptInvitationForm } from "./accept-form";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token_hash?: string | string[] }> }) {
  const { token_hash: tokenHash } = await searchParams;
  const validLink = typeof tokenHash === "string" && Boolean(tokenHash);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <span className="inline-flex size-12 items-center justify-center rounded-xl bg-sky-800 text-white"><MailCheck aria-hidden="true" size={25} /></span>
        <p className="mt-6 text-sm font-semibold text-sky-800">LaporPak / Akun petugas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Terima undangan</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Lanjutkan untuk mengaktifkan akun dan mengatur kata sandi pribadi Anda.</p>
        {validLink ? (
          <AcceptInvitationForm tokenHash={tokenHash} configured={Boolean(getSupabaseConfig())} />
        ) : (
          <p role="alert" className="mt-7 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">Tautan undangan tidak lengkap. Minta undangan baru kepada pengelola.</p>
        )}
        <Link href="/login" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-sky-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Kembali ke login</Link>
      </div>
    </main>
  );
}
