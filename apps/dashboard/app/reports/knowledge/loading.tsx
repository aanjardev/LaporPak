export default function KnowledgeLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat sumber ASK" className="mx-auto max-w-6xl animate-pulse space-y-6">
      <div className="space-y-3"><div className="h-4 w-24 rounded bg-slate-200" /><div className="h-10 w-64 max-w-full rounded bg-slate-200" /><div className="h-5 max-w-lg rounded bg-slate-200" /></div>
      <div className="h-24 rounded-2xl border border-slate-200 bg-white" />
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="h-6 w-40 rounded bg-slate-200" /><div className="h-16 rounded bg-slate-100" /><div className="h-16 rounded bg-slate-100" /></div>
      <span className="sr-only">Memuat sumber ASK…</span>
    </div>
  );
}
