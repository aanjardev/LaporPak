import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/auth-actions";
import { BrandLogo } from "@/components/brand-logo";
import { MobileNavigation } from "@/components/mobile-navigation";
import { ReportsNav } from "@/components/reports-nav";
import { getCurrentAdmin, requireSignedIn } from "@/lib/auth";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireSignedIn("/reports");
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/onboarding");
  if (admin.role === "system_admin") redirect("/admin");
  const village = admin.villages[0];
  if (!village) redirect("/onboarding");
  const isMock = process.env.REPORTS_DATA_SOURCE !== "api";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#konten-utama" className="sr-only rounded-md bg-card px-4 py-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]">Lewati ke konten</a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto bg-brand px-5 py-6 text-white lg:flex">
        <Link href="/reports" className="block rounded-md bg-card p-3 focus-visible:outline-primary"><BrandLogo /></Link>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">Administrasi desa</p>
        <div className="mt-4 rounded-lg border border-white/15 px-3 py-3"><p className="truncate text-sm font-semibold">{village.name}</p><p className="mt-1 text-xs text-white/65">{village.activation_status === "approved" ? "Desa aktif" : "Menunggu aktivasi"}</p></div>
        <ReportsNav showKnowledge={!isMock} />
        <Link href="/reports/settings" className="mt-auto rounded-lg border border-white/15 p-3 hover:bg-white/10"><div className="flex items-center gap-2 text-sm font-semibold"><Settings size={16} />{admin.display_name || "Admin Desa"}</div><p className="mt-1 truncate text-xs text-white/65">{admin.email}</p></Link>
      </aside>
      <div className="min-w-0 lg:pl-64">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNavigation showKnowledge={!isMock} accountName={admin.display_name || "Admin Desa"} villageName={village.name} />
            <div className="min-w-0"><p className="text-sm font-semibold text-brand">Portal petugas</p><p className="mt-1 hidden text-xs text-muted-foreground sm:block">Pelayanan dan pengaduan desa</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-5">
            {isMock && <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">Data simulasi</span>}
            <form action={logoutAction}><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-brand hover:bg-muted"><LogOut aria-hidden="true" size={17} /><span>Keluar</span></button></form>
          </div>
        </header>
        <main id="konten-utama" tabIndex={-1} className="min-w-0 px-4 py-7 outline-none sm:px-8 lg:py-8">{children}</main>
        <footer className="mx-4 border-t border-border py-5 text-xs text-muted-foreground sm:mx-8">LaporPak | Pelayanan desa yang terhubung</footer>
      </div>
    </div>
  );
}
