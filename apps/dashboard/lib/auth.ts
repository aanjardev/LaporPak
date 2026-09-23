import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "./supabase/server";
import { safeReturnPath } from "./safe-return-path";
import type { AdminMe } from "./admin";

const getServerClient = cache(createSupabaseServerClient);

const getAuthClaims = cache(async () => {
  const supabase = await getServerClient();
  return supabase ? (await supabase.auth.getClaims()).data?.claims ?? null : null;
});

export async function requireSignedIn(returnPath: string) {
  const claims = await getAuthClaims();
  if (!claims) {
    redirect(`/login?next=${encodeURIComponent(safeReturnPath(returnPath))}`);
  }
  return claims;
}

export const getAdminAccessToken = cache(async () => {
  const supabase = await getServerClient();
  if (!supabase) throw new Error("Supabase Auth is not configured");

  const claims = await getAuthClaims();
  const session = (await supabase.auth.getSession()).data.session;
  if (!claims || !session?.access_token) {
    throw new Error("Admin session is unavailable");
  }
  return session.access_token;
});

export const getCurrentAdmin = cache(async (): Promise<AdminMe | null> => {
  const token = await getAdminAccessToken();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/admin/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error("Profil admin tidak dapat dimuat");
  return response.json();
});
