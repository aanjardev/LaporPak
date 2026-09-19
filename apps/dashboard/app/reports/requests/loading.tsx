export default function RequestsLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat pengajuan" className="mx-auto max-w-6xl motion-safe:animate-pulse space-y-6">
      <div className="h-10 w-64 max-w-full max-w-full rounded bg-muted" />
      <div className="h-20 rounded-lg bg-card" />
      <div className="h-72 rounded-lg bg-card" />
      <span className="sr-only">Memuat pengajuan layanan…</span>
    </div>
  );
}
