import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { safeReturnPath } from "@/lib/safe-return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const next = safeReturnPath(params.next);
  const supabase = await createSupabaseServerClient();
  if (supabase && (await supabase.auth.getClaims()).data?.claims) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <span className="inline-flex size-12 items-center justify-center rounded-xl bg-sky-800 text-white"><ClipboardList aria-hidden="true" size={25} /></span>
        <p className="mt-6 text-sm font-semibold text-sky-800">LaporPak / Dashboard petugas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Masuk sebagai petugas</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Gunakan akun yang disiapkan pengelola untuk melihat laporan warga.</p>
        <LoginForm next={next} configured={Boolean(supabase)} />
      </div>
    </main>
  );
}
