export default function Loading() {
  return <div role="status" aria-label="Memuat ringkasan desa" className="mx-auto max-w-6xl space-y-6"><p className="sr-only">Memuat ringkasan desa…</p><div aria-hidden="true" className="h-20 rounded-lg bg-muted" /><div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((n) => <div key={n} className="h-40 rounded-lg bg-muted" />)}</div><div aria-hidden="true" className="h-80 rounded-lg bg-muted" /></div>;
}
