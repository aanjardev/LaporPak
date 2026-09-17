import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function ReportNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <FileQuestion aria-hidden="true" className="text-slate-500" size={40} />
      <h1 className="mt-5 text-2xl font-bold">Laporan tidak ditemukan</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Nomor atau tautan laporan ini tidak tersedia.</p>
      <Link href="/reports" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Kembali ke daftar laporan</Link>
    </div>
  );
}
