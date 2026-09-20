import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "village_admin") redirect("/");
  const village = admin.villages[0];
  if (!village) redirect("/onboarding");
  return <div className="mx-auto max-w-5xl"><p className="text-sm font-semibold text-brand">Administrasi desa</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Pengaturan Akun</h1><p className="mt-2 text-sm text-muted-foreground">Kelola akun, profil desa, WhatsApp, dan personalisasi AI dari satu halaman.</p><div className="mt-7"><SettingsForm admin={admin} village={village} /></div></div>;
}
