export default function KnowledgeLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat sumber ASK" className="mx-auto max-w-6xl motion-safe:animate-pulse space-y-6">
      <div className="space-y-3"><div className="h-4 w-24 rounded bg-muted" /><div className="h-10 w-64 max-w-full max-w-full rounded bg-muted" /><div className="h-5 max-w-lg rounded bg-muted" /></div>
      <div className="h-24 ui-panel" />
      <div className="space-y-4 ui-panel p-5"><div className="h-6 w-40 rounded bg-muted" /><div className="h-16 rounded bg-muted" /><div className="h-16 rounded bg-muted" /></div>
      <span className="sr-only">Memuat sumber ASK…</span>
    </div>
  );
}
