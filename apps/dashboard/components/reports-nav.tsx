"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, FileText } from "lucide-react";

export function ReportsNav({ showKnowledge, showRequests }: { showKnowledge: boolean; showRequests: boolean }) {
  const pathname = usePathname();
  const knowledgeActive = showKnowledge && pathname.startsWith("/reports/knowledge");
  const requestsActive = showRequests && pathname.startsWith("/reports/requests");
  const reportsActive = !knowledgeActive && !requestsActive;
  const activeClass = "bg-sky-50 font-semibold text-sky-900";
  const idleClass = "text-slate-700 hover:bg-slate-50";

  return (
    <nav aria-label="Navigasi utama" className="mt-5 lg:mt-10">
      <Link href="/reports" aria-current={reportsActive ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${reportsActive ? activeClass : idleClass}`}>
        <ClipboardList aria-hidden="true" size={18} /> Laporan warga
      </Link>
      {showKnowledge && (
        <Link href="/reports/knowledge" aria-current={knowledgeActive ? "page" : undefined} className={`mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${knowledgeActive ? activeClass : idleClass}`}>
          <BookOpen aria-hidden="true" size={18} /> Sumber ASK
        </Link>
      )}
      {showRequests && (
        <Link href="/reports/requests" aria-current={requestsActive ? "page" : undefined} className={`mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${requestsActive ? activeClass : idleClass}`}>
          <FileText aria-hidden="true" size={18} /> Pengajuan layanan
        </Link>
      )}
    </nav>
  );
}
