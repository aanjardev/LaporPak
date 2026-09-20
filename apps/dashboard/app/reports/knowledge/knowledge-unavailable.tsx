"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

export function KnowledgeUnavailable({ retry }: { retry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center rounded-lg border border-rose-200 bg-card px-6 py-14 text-center">
      <AlertCircle aria-hidden="true" className="text-rose-700" size={40} />
      <h1 className="mt-5 text-2xl font-bold">Sumber ASK belum dapat dimuat</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Terjadi kendala saat mengambil sumber. Silakan coba lagi.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {retry ? (
          <button type="button" onClick={retry} className="ui-primary">Coba lagi</button>
        ) : (
          <a href="" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Coba lagi</a>
        )}
        <Link href="/reports/settings" className="inline-flex min-h-11 items-center rounded-lg border border-input px-5 text-sm font-semibold text-foreground hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Pengaturan akun</Link>
      </div>
    </div>
  );
}
