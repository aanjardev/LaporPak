import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "./config";

export async function getBrowserAccessToken() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase Auth is not configured");

  const supabase = createBrowserClient(config.url, config.key);
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error("Admin session is unavailable");

  return session.access_token;
}
