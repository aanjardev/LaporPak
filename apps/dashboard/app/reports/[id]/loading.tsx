export default function ReportDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat detail laporan" className="mx-auto max-w-5xl animate-pulse space-y-6">
      <div className="h-5 w-48 rounded bg-slate-200" />
      <div className="h-12 w-64 rounded bg-slate-200" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-6"><div className="h-80 rounded-2xl border border-slate-200 bg-white" /><div className="h-52 rounded-2xl border border-slate-200 bg-white" /></div>
        <div className="h-64 rounded-2xl border border-slate-200 bg-white" />
      </div>
      <span className="sr-only">Memuat detail laporan…</span>
    </div>
  );
}
