"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, Settings, LayoutDashboard } from "lucide-react";

export function ReportsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const dashboardActive = pathname === "/reports/dashboard";
  const requestsActive = pathname.startsWith("/reports/requests");
  const settingsActive = pathname.startsWith("/reports/settings");
  const activeClass = "bg-primary font-semibold text-primary-foreground";
  const idleClass = "text-white/85 hover:bg-white/10 hover:text-white";

  return (
    <nav aria-label="Navigasi utama" className="mt-5 lg:mt-10">
      <Link data-guide="nav-dashboard" onClick={onNavigate} href="/reports/dashboard" aria-current={dashboardActive ? "page" : undefined} className={`mb-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${dashboardActive ? activeClass : idleClass}`}>
        <LayoutDashboard aria-hidden="true" size={18} /> Dashboard
      </Link>
      <Link data-guide="nav-reports" onClick={onNavigate} href="/reports" aria-current={!dashboardActive && !requestsActive && !settingsActive ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${!dashboardActive && !requestsActive && !settingsActive ? activeClass : idleClass}`}>
        <ClipboardList aria-hidden="true" size={18} /> Laporan warga
      </Link>
      <Link data-guide="nav-requests" onClick={onNavigate} href="/reports/requests" aria-current={requestsActive ? "page" : undefined} className={`mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${requestsActive ? activeClass : idleClass}`}>
        <FileText aria-hidden="true" size={18} /> Pengajuan layanan
      </Link>
      <Link data-guide="nav-settings" onClick={onNavigate} href="/reports/settings" aria-current={settingsActive ? "page" : undefined} className={`mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${settingsActive ? activeClass : idleClass}`}>
        <Settings aria-hidden="true" size={18} /> Pengaturan Akun
      </Link>
    </nav>
  );
}
