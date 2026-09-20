"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ClipboardCheck, LayoutDashboard } from "lucide-react";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/activations", label: "Aktivasi Desa", icon: ClipboardCheck },
  { href: "/admin/villages", label: "Monitoring Desa", icon: Building2 },
];

export function AdminNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return <nav aria-label="Navigasi Super Admin" className={mobile ? "flex gap-2 overflow-x-auto px-4 py-3" : "mt-4 space-y-1.5"}>
    {items.map(({ href, label, icon: Icon }) => {
      const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={mobile
        ? `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-brand"}`
        : `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${active ? "bg-primary text-primary-foreground" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
        <Icon size={18} />{label}
      </Link>;
    })}
  </nav>;
}
