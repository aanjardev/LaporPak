export default function ReportsLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat laporan" className="mx-auto max-w-6xl animate-pulse space-y-7">
      <div className="space-y-3"><div className="h-4 w-28 rounded bg-slate-200" /><div className="h-10 w-64 rounded bg-slate-200" /><div className="h-5 max-w-lg rounded bg-slate-200" /></div>
      <div className="h-36 rounded-2xl border border-slate-200 bg-white" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="h-16 border-b border-slate-200" />
        {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-20 border-b border-slate-100 p-5"><div className="h-4 w-3/4 rounded bg-slate-200" /></div>)}
      </div>
      <span className="sr-only">Memuat daftar laporan…</span>
    </div>
  );
}
