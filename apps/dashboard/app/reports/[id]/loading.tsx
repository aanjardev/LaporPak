export default function ReportDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat detail laporan" className="mx-auto max-w-5xl motion-safe:animate-pulse space-y-6">
      <div className="h-5 w-48 rounded bg-muted" />
      <div className="h-12 w-64 max-w-full rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-6"><div className="h-80 ui-panel" /><div className="h-52 ui-panel" /></div>
        <div className="h-64 ui-panel" />
      </div>
      <span className="sr-only">Memuat detail laporan…</span>
    </div>
  );
}
