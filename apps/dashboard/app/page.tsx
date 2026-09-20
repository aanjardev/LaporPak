import { redirect } from "next/navigation";
import { getCurrentAdmin, requireSignedIn } from "@/lib/auth";

export default async function Home() {
  await requireSignedIn("/");
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/onboarding");
  redirect(admin.role === "system_admin" ? "/admin" : admin.villages.length ? "/reports/dashboard" : "/onboarding");
}
