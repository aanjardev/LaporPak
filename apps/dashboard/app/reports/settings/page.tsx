import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "village_admin") redirect("/");
  const village = admin.villages[0];
  if (!village) redirect("/onboarding");
  return <div className="max-w-5xl"><SettingsForm admin={admin} village={village} /></div>;
}
