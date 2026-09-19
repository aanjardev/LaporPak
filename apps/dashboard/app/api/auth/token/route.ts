import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) {
      return NextResponse.json(
        { error: "No session" },
        { status: 401 }
      );
    }

    return NextResponse.json({ token: session.access_token });
  } catch {
    return NextResponse.json(
      { error: "Failed to get token" },
      { status: 500 }
    );
  }
}
