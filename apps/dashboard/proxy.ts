import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/", "/login", "/signup", "/onboarding", "/invite/accept", "/set-password", "/reports/:path*", "/admin/:path*", "/access-denied"],
};
