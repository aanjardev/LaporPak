import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { safeReturnPath } from "./safe-return-path";
import type { AdminMe } from "./admin";

export async function requireSignedIn(returnPath: string) {
  const supabase = await createSupabaseServerClient();
  const claims = supabase ? (await supabase.auth.getClaims()).data?.claims : null;
  if (!claims) {
    redirect(`/login?next=${encodeURIComponent(safeReturnPath(returnPath))}`);
  }
  return claims;
}

export async function getAdminAccessToken() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase Auth is not configured");

  const claims = (await supabase.auth.getClaims()).data?.claims;
  const session = (await supabase.auth.getSession()).data.session;
  if (!claims || !session?.access_token) {
    throw new Error("Admin session is unavailable");
  }
  return session.access_token;
}

export async function getCurrentAdmin(): Promise<AdminMe | null> {
  const token = await getAdminAccessToken();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/admin/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error("Profil admin tidak dapat dimuat");
  return response.json();
}
