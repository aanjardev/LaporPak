import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function KnowledgeNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center ui-panel px-6 py-14 text-center">
      <FileQuestion aria-hidden="true" className="text-muted-foreground" size={40} />
      <h1 className="mt-5 text-2xl font-bold">Sumber tidak ditemukan</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Tautan ini tidak tersedia atau akses Anda telah berubah.</p>
      <Link href="/reports/settings/knowledge" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Kembali ke sumber ASK</Link>
    </div>
  );
}
