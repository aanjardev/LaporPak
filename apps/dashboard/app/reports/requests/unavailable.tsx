import Link from "next/link";
import { AlertCircle } from "lucide-react";

export function RequestUnavailable({ href = "/reports/requests" }: { href?: string }) {
  return (
    <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-10">
      <AlertCircle aria-hidden="true" className="mx-auto text-rose-700" size={38} />
      <h1 className="mt-4 text-2xl font-bold">Pengajuan belum dapat dimuat</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Terjadi kendala saat membuka data simulasi. Silakan coba lagi.</p>
      <Link href={href} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Coba lagi</Link>
    </div>
  );
}
