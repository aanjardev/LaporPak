"use server";

import { redirect } from "next/navigation";
import { safeReturnPath } from "@/lib/safe-return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { message: string };

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return { message: "Isi email dan kata sandi." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Login belum dikonfigurasi. Hubungi pengelola sistem." };

  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { message: "Gagal masuk. Periksa email dan kata sandi." };
  } catch {
    return { message: "Layanan login belum tersedia. Coba lagi nanti." };
  }

  redirect(safeReturnPath(formData.get("next")));
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("Gagal keluar. Silakan coba lagi.");
  }
  redirect("/login");
}
