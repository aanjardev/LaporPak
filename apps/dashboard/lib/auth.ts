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
