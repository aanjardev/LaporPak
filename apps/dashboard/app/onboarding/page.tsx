import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentAdmin, requireSignedIn } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  await requireSignedIn("/onboarding");
  const admin = await getCurrentAdmin();
  if (admin) redirect(admin.role === "system_admin" ? "/admin" : "/reports/settings");
  return <main className="min-h-screen bg-background px-4 py-10"><div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
    <BrandLogo /><p className="mt-6 text-sm font-semibold text-brand">Langkah 1 dari 2</p>
    <h1 className="mt-2 text-3xl font-bold">Lengkapi profil Admin Desa</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Data wajib ini dipakai untuk pemeriksaan aktivasi desa.</p>
    <OnboardingForm />
  </div></main>;
}
