import Link from "next/link";
import { AlertCircle } from "lucide-react";

export function RequestUnavailable({ href = "/reports/requests" }: { href?: string }) {
  return (
    <div role="alert" className="mx-auto max-w-xl rounded-lg border border-rose-200 bg-card p-6 text-center sm:p-10">
      <AlertCircle aria-hidden="true" className="mx-auto text-rose-700" size={38} />
      <h1 className="mt-4 text-2xl font-bold">Pengajuan belum dapat dimuat</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Terjadi kendala saat mengambil data pengajuan. Silakan coba lagi.</p>
      <Link href={href} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Coba lagi</Link>
    </div>
  );
}
