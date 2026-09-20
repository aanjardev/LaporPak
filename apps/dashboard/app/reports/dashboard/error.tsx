"use client";
import Link from "next/link";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <div role="alert" className="ui-panel mx-auto max-w-xl p-6 sm:p-10"><h1 className="text-2xl font-bold">Ringkasan belum dapat dimuat</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Terjadi kendala saat mengambil data dashboard desa. Silakan coba lagi.</p><div className="mt-6 flex flex-wrap items-center gap-3"><button className="ui-primary" onClick={reset}>Coba lagi</button><Link className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-brand underline" href="/reports">Buka laporan warga</Link></div></div>;
}
