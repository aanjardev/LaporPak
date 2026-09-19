export default function ReportsLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat laporan" className="mx-auto max-w-6xl motion-safe:animate-pulse space-y-7">
      <div className="space-y-3"><div className="h-4 w-28 rounded bg-muted" /><div className="h-10 w-64 max-w-full rounded bg-muted" /><div className="h-5 max-w-lg rounded bg-muted" /></div>
      <div className="h-36 ui-panel" />
      <div className="overflow-hidden ui-panel">
        <div className="h-16 border-b border-border" />
        {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-20 border-b border-border p-5"><div className="h-4 w-3/4 rounded bg-muted" /></div>)}
      </div>
      <span className="sr-only">Memuat daftar laporan…</span>
    </div>
  );
}
