"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, FileText } from "lucide-react";

export function ReportsNav({ showKnowledge, onNavigate }: { showKnowledge: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const knowledgeActive = showKnowledge && pathname.startsWith("/reports/knowledge");
  const requestsActive = pathname.startsWith("/reports/requests");
  const activeClass = "bg-primary font-semibold text-primary-foreground";
  const idleClass = "text-white/85 hover:bg-white/10 hover:text-white";

  return (
    <nav aria-label="Navigasi utama" className="mt-5 lg:mt-10">
      <Link onClick={onNavigate} href="/reports" aria-current={!knowledgeActive && !requestsActive ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${!knowledgeActive && !requestsActive ? activeClass : idleClass}`}>
        <ClipboardList aria-hidden="true" size={18} /> Laporan warga
      </Link>
      <Link onClick={onNavigate} href="/reports/requests" aria-current={requestsActive ? "page" : undefined} className={`mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${requestsActive ? activeClass : idleClass}`}>
        <FileText aria-hidden="true" size={18} /> Pengajuan layanan
      </Link>
      {showKnowledge && (
        <Link onClick={onNavigate} href="/reports/knowledge" aria-current={knowledgeActive ? "page" : undefined} className={`mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${knowledgeActive ? activeClass : idleClass}`}>
          <BookOpen aria-hidden="true" size={18} /> Sumber ASK
        </Link>
      )}
    </nav>
  );
}
