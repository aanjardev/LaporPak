import Link from "next/link";
import { BookOpen, ClipboardList } from "lucide-react";
import { logoutAction } from "@/app/auth-actions";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a href="#konten-utama" className="sr-only rounded-md bg-white px-4 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">
        Lewati ke konten
      </a>
      <div className="mx-auto flex min-h-screen max-w-screen-2xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white px-5 py-4 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
          <Link href="/reports" className="inline-flex items-center gap-3 rounded-md text-lg font-bold tracking-tight text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sky-800 text-white"><ClipboardList aria-hidden="true" size={21} /></span>
            LaporPak
          </Link>
          <p className="mt-1 text-xs text-slate-500 lg:ml-[52px]">Dashboard administrasi desa</p>
          {process.env.REPORTS_DATA_SOURCE !== "api" && (
            <p className="mt-4 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 ring-inset">Data simulasi</p>
          )}
          <nav aria-label="Navigasi utama" className="mt-5 lg:mt-10">
            <Link href="/reports" aria-current="page" className="flex min-h-11 items-center gap-3 rounded-lg bg-sky-50 px-3 text-sm font-semibold text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
              <ClipboardList aria-hidden="true" size={18} /> Laporan warga
            </Link>
            {process.env.REPORTS_DATA_SOURCE === "api" && (
              <Link href="/reports/knowledge" className="mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
                <BookOpen aria-hidden="true" size={18} /> Sumber ASK
              </Link>
            )}
          </nav>
          <form action={logoutAction} className="mt-5 lg:mt-8">
            <button type="submit" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Keluar</button>
          </form>
        </aside>
        <main id="konten-utama" className="min-w-0 flex-1 px-4 py-7 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
