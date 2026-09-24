import { reportsDataSource } from "@/lib/reports-data-source";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { getAdminAccessToken, getCurrentAdmin, requireSignedIn } from "@/lib/auth";
import { DashboardApiError, dashboardDays, getVillageDashboard } from "@/lib/village-dashboard";
import { VillageDashboardView } from "@/components/village-dashboard";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.days !== undefined && !(["7", "30", "90"] as const).includes(params.days as "7" | "30" | "90")) {
    redirect("/reports/dashboard?days=30");
  }
  const days = dashboardDays(params.days);
  const path = `/reports/dashboard?days=${days}`;
  await requireSignedIn(path);
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/onboarding");
  if (admin.role === "system_admin") redirect("/admin");
  const village = admin.villages.find((item) => item.is_active && item.activation_status === "approved") ?? admin.villages[0];
  if (!village) redirect("/onboarding");
  if (!village.is_active || village.activation_status !== "approved") return <div className="ui-panel mx-auto max-w-2xl p-6"><h1 className="text-2xl font-bold">Desa belum aktif</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Lengkapi pengaturan dan periksa status aktivasi untuk membuka ringkasan layanan desa.</p><Link href="/reports/settings" className="ui-primary mt-5">Buka pengaturan</Link></div>;
  const isMock = reportsDataSource() === "mock";
  let data;
  try {
    data = await getVillageDashboard(village, days, await getAdminAccessToken(), typeof params.scenario === "string" ? params.scenario : undefined);
  } catch (error) {
    if (error instanceof DashboardApiError) {
      if (error.status === 401) redirect(`/login?reauth=1&next=${encodeURIComponent(path)}`);
      if (error.status === 403 && error.code === "VILLAGE_INACTIVE") return <InactiveVillage />;
      if (error.status === 403) redirect("/access-denied");
      if (error.status === 404) notFound();
      if (error.status === 422 && days !== 30) redirect("/reports/dashboard?days=30");
    }
    throw new Error("Ringkasan desa belum dapat dimuat");
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="ui-page-header flex flex-wrap items-end justify-between gap-4"><div className="min-w-0"><p className="mb-2 break-words text-sm font-semibold text-brand">{village.name}</p><h1>Dashboard Desa</h1></div><form action="/reports/dashboard" className="flex flex-wrap items-end gap-2"><div><label htmlFor="dashboard-period" className="mb-1.5 block text-xs font-medium text-muted-foreground">Periode layanan masuk</label><select id="dashboard-period" name="days" defaultValue={days} className="ui-control px-3">{[7, 30, 90].map((n) => <option key={n} value={n}>{n} hari terakhir</option>)}</select></div><button className="ui-primary" type="submit">Terapkan</button></form></header>
    {isMock && <p role="status" className="ui-alert-warning p-3 text-sm text-amber-950">Data simulasi · angka contoh untuk pratinjau dashboard.</p>}
    <VillageDashboardView data={data} isMock={isMock} />
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><p>Diperbarui <time dateTime={data.generated_at}>{new Date(data.generated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB</time></p><form action="/reports/dashboard"><input type="hidden" name="days" value={days} /><button className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-brand hover:bg-muted" type="submit"><RefreshCw aria-hidden="true" size={16} />Segarkan</button></form></div>
  </div>;
}

function InactiveVillage() {
  return <div className="ui-panel mx-auto max-w-2xl p-6"><h1 className="text-2xl font-bold">Desa belum aktif</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Ringkasan tersedia setelah desa disetujui dan diaktifkan. Periksa status aktivasi pada pengaturan akun.</p><Link href="/reports/settings" className="ui-primary mt-5">Buka pengaturan</Link></div>;
}
