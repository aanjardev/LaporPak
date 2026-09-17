import { ShieldX } from "lucide-react";
import { logoutAction } from "@/app/auth-actions";
import { requireSignedIn } from "@/lib/auth";

export default async function AccessDeniedPage() {
  await requireSignedIn("/reports");
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <span className="inline-flex size-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><ShieldX aria-hidden="true" size={25} /></span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Akses ditolak</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Akun Anda belum memiliki izin untuk melihat laporan ini. Hubungi pengelola sistem jika akses diperlukan.</p>
        <form action={logoutAction} className="mt-7">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Keluar dari akun</button>
        </form>
      </div>
    </main>
  );
}
