import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/auth-actions";
import { ReportsNav } from "@/components/reports-nav";
import { BrandLogo } from "@/components/brand-logo";
import { MobileNavigation } from "@/components/mobile-navigation";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const isMock = process.env.REPORTS_DATA_SOURCE !== "api";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#konten-utama" className="sr-only rounded-md bg-card px-4 py-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]">Lewati ke konten</a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto bg-brand px-5 py-6 text-white lg:flex">
        <Link href="/reports" className="block rounded-md bg-card p-3 focus-visible:outline-primary"><BrandLogo /></Link>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">Administrasi desa</p>
        <ReportsNav showKnowledge={!isMock} />
        <div className="mt-auto border-t border-white/15 pt-5 text-xs leading-5 text-white/70">Portal pelayanan dan<br />pengaduan warga desa</div>
      </aside>
      <div className="min-w-0 lg:pl-64">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNavigation showKnowledge={!isMock} />
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
