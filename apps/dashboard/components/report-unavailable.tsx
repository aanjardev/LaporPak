import { AlertCircle } from "lucide-react";

export function ReportUnavailable() {
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center rounded-lg border border-rose-200 bg-card px-6 py-16 text-center">
      <AlertCircle aria-hidden="true" className="text-rose-700" size={40} />
      <h1 className="mt-5 text-2xl font-bold">Laporan belum dapat dimuat</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Terjadi kendala saat mengambil data laporan. Silakan coba lagi.</p>
      <a href="" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Coba lagi</a>
    </div>
  );
}
