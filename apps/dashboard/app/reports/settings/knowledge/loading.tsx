export default function KnowledgeSettingsLoading() {
  return <div aria-busy="true" aria-label="Memuat sumber ASK" className="motion-safe:animate-pulse space-y-5"><div className="h-7 w-64 max-w-full rounded bg-muted" /><div className="h-24 ui-panel" /><div className="h-56 ui-panel" /><span className="sr-only">Memuat sumber ASK…</span></div>;
}
