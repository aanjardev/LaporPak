import Link from "next/link";

export default function RequestNotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold">Pengajuan tidak ditemukan</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Periksa kembali tautan pengajuan simulasi.</p>
      <Link href="/reports/requests" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Kembali ke antrean</Link>
    </div>
  );
}
