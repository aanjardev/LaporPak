"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Settings } from "lucide-react";
import { knowledgeSettingsPath } from "@/lib/knowledge-route";

export function SettingsTabs({ showKnowledge }: { showKnowledge: boolean }) {
  const pathname = usePathname();
  const knowledgeActive = pathname.startsWith(knowledgeSettingsPath);
  const tabs = [
    { href: "/reports/settings", label: "Pengaturan Akun", icon: Settings, active: !knowledgeActive },
    ...(showKnowledge ? [{ href: knowledgeSettingsPath, label: "Sumber ASK", icon: BookOpen, active: knowledgeActive }] : []),
  ];
  return <nav aria-label="Bagian pengaturan" className={`grid overflow-hidden rounded-lg border border-border bg-card p-1 ${tabs.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
    {tabs.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-md px-3 text-center text-sm font-semibold transition-colors ${active ? "bg-brand text-white" : "text-brand hover:bg-muted"}`}><Icon aria-hidden="true" size={17} /><span className="truncate">{label}</span></Link>)}
  </nav>;
}
