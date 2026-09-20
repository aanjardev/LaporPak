"use server";

import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth";
import { safeReturnPath } from "@/lib/safe-return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = { message: string };

function passwordUpdateMessage(code?: string) {
  switch (code) {
    case "weak_password":
      return "Kata sandi belum memenuhi aturan keamanan Supabase. Periksa panjang dan kombinasi karakter yang diwajibkan, lalu coba kata sandi yang lebih kuat.";
    case "same_password":
      return "Kata sandi baru harus berbeda dari kata sandi akun saat ini.";
    case "reauthentication_needed":
      return "Supabase meminta verifikasi ulang sebelum kata sandi dapat diubah. Hubungi pengelola akun.";
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
      return "Sesi undangan sudah berakhir. Minta pengelola mengirim undangan baru.";
    default:
      return "Kata sandi tidak dapat disimpan. Coba lagi atau hubungi pengelola akun.";
  }
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
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

export async function signupAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  if (typeof email !== "string" || typeof password !== "string" || typeof confirmation !== "string") {
    return { message: "Isi seluruh data pendaftaran." };
  }
  if (password !== confirmation) return { message: "Konfirmasi kata sandi tidak cocok." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Pendaftaran belum dikonfigurasi." };
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { message: "Pendaftaran gagal. Periksa email dan kekuatan kata sandi." };
  if (data.session) redirect("/onboarding");
  return { message: "Periksa email Anda untuk verifikasi, lalu masuk." };
}

export async function acceptInvitationAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const tokenHash = formData.get("token_hash");
  if (typeof tokenHash !== "string" || !tokenHash) {
    return { message: "Tautan undangan tidak valid. Minta undangan baru kepada pengelola." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Undangan belum dikonfigurasi. Hubungi pengelola sistem." };

  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    if (error) return { message: "Tautan undangan tidak valid atau kedaluwarsa. Minta undangan baru kepada pengelola." };
  } catch {
    return { message: "Layanan undangan belum tersedia. Coba lagi nanti." };
  }

  redirect("/set-password");
}

export async function setPasswordAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  await requireSignedIn("/reports");
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  if (typeof password !== "string" || typeof confirmation !== "string" || !password || !confirmation) {
    return { message: "Isi dan konfirmasi kata sandi." };
  }
  if (password !== confirmation) return { message: "Konfirmasi kata sandi tidak cocok." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Pengaturan kata sandi belum tersedia. Hubungi pengelola sistem." };

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("Gagal menyimpan kata sandi Supabase", { code: error.code, status: error.status });
      return { message: passwordUpdateMessage(error.code) };
    }
  } catch {
    return { message: "Layanan kata sandi belum tersedia. Coba lagi nanti." };
  }

  redirect("/");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("Gagal keluar. Silakan coba lagi.");
  }
  redirect("/login");
}
