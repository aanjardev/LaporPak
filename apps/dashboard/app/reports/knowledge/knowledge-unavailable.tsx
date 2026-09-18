"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

export function KnowledgeUnavailable({ retry }: { retry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-rose-200 bg-white px-6 py-14 text-center shadow-sm">
      <AlertCircle aria-hidden="true" className="text-rose-700" size={40} />
      <h1 className="mt-5 text-2xl font-bold">Sumber ASK belum dapat dimuat</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Terjadi kendala saat mengambil sumber. Silakan coba lagi.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {retry ? (
          <button type="button" onClick={retry} className="min-h-11 rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Coba lagi</button>
        ) : (
          <a href="" className="inline-flex min-h-11 items-center rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Coba lagi</a>
        )}
        <Link href="/reports" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Daftar laporan</Link>
      </div>
    </div>
  );
}
