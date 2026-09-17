import { AlertCircle } from "lucide-react";

export function ReportUnavailable() {
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-rose-200 bg-white px-6 py-16 text-center shadow-sm">
      <AlertCircle aria-hidden="true" className="text-rose-700" size={40} />
      <h1 className="mt-5 text-2xl font-bold">Laporan belum dapat dimuat</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Terjadi kendala saat mengambil data laporan. Silakan coba lagi.</p>
      <a href="" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Coba lagi</a>
    </div>
  );
}
