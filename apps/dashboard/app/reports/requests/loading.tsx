export default function RequestsLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat pengajuan" className="mx-auto max-w-6xl animate-pulse space-y-6">
      <div className="h-10 w-64 max-w-full rounded bg-slate-200" />
      <div className="h-20 rounded-2xl bg-white" />
      <div className="h-72 rounded-2xl bg-white" />
      <span className="sr-only">Memuat pengajuan layanan…</span>
    </div>
  );
}
