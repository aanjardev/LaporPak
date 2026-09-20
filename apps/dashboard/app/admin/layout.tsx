import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CheckSquare, LogOut } from "lucide-react";
import { logoutAction } from "@/app/auth-actions";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentAdmin, requireSignedIn } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSignedIn("/admin");
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/onboarding");
  if (admin.role !== "system_admin") redirect("/reports");
  return <div className="min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-brand px-5 py-6 text-white lg:flex">
      <Link href="/admin" className="rounded-md bg-card p-3"><BrandLogo /></Link>
      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[.12em] text-white/60">Super Admin</p>
      <nav className="mt-4 space-y-2"><Link href="/admin#aktivasi" className="flex min-h-11 items-center gap-3 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><CheckSquare size={18} />Aktivasi Desa</Link><Link href="/admin#monitoring" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-white/85 hover:bg-white/10"><Activity size={18} />Monitoring Desa</Link></nav>
      <div className="mt-auto rounded-lg border border-white/15 p-3"><p className="text-sm font-semibold">{admin.display_name || "Super Admin"}</p><p className="mt-1 truncate text-xs text-white/65">{admin.email}</p></div>
    </aside>
    <div className="lg:pl-64"><header className="flex min-h-20 items-center justify-between border-b border-border bg-card px-4 sm:px-8"><div><p className="text-sm font-semibold text-brand">Portal Super Admin</p><p className="mt-1 text-xs text-muted-foreground">Aktivasi dan monitoring seluruh desa</p></div><form action={logoutAction}><button className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-brand hover:bg-muted"><LogOut size={17} />Keluar</button></form></header><main className="px-4 py-7 sm:px-8 lg:py-8">{children}</main></div>
  </div>;
}
