import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { safeReturnPath } from "./safe-return-path";

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
