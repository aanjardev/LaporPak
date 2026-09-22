"use server";

import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth";
import { safeReturnPath } from "@/lib/safe-return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = { message: string; status: "idle" | "error" | "success" };

function authErrorMessage(code?: string) {
  switch (code) {
    case "weak_password":
      return "Kata sandi belum memenuhi persyaratan keamanan. Gunakan minimal 8 karakter dan ikuti petunjuk yang ditampilkan.";
    case "user_already_exists":
    case "email_exists":
      return "Email ini sudah terdaftar. Silakan masuk dengan akun tersebut.";
    case "email_address_invalid":
      return "Format email belum valid.";
    case "email_address_not_authorized":
      return "Alamat email ini belum diizinkan oleh layanan email. Gunakan alamat lain atau hubungi pengelola.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Terlalu banyak percobaan pendaftaran. Tunggu beberapa saat lalu coba lagi.";
    case "signup_disabled":
      return "Pendaftaran mandiri sedang ditutup. Hubungi pengelola untuk mendapatkan undangan.";
    default:
      return "Pendaftaran belum dapat diselesaikan. Coba lagi atau hubungi pengelola jika masalah berlanjut.";
  }
}

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
    return { message: "Isi email dan kata sandi.", status: "error" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Login belum dikonfigurasi. Hubungi pengelola sistem.", status: "error" };

  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { message: "Email atau kata sandi tidak sesuai.", status: "error" };
  } catch {
    return { message: "Layanan login belum tersedia. Coba lagi nanti.", status: "error" };
  }

  redirect(safeReturnPath(formData.get("next")));
}

export async function signupAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  if (typeof email !== "string" || typeof password !== "string" || typeof confirmation !== "string") {
    return { message: "Isi seluruh data pendaftaran.", status: "error" };
  }
  const normalizedEmail = email.trim();
  if (normalizedEmail.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    return { message: "Format email belum valid.", status: "error" };
  }
  if (password.length < 8 || password.length > 72) {
    return { message: "Kata sandi harus terdiri dari 8–72 karakter.", status: "error" };
  }
  if (password !== confirmation) return { message: "Konfirmasi kata sandi tidak cocok.", status: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Pendaftaran belum dikonfigurasi.", status: "error" };
  let result;
  try {
    result = await supabase.auth.signUp({ email: normalizedEmail, password });
  } catch {
    return { message: "Layanan pendaftaran belum tersedia. Coba lagi nanti.", status: "error" };
  }
  const { data, error } = result;
  if (error) {
    console.error("Pendaftaran Supabase gagal", { code: error.code, status: error.status });
    return { message: authErrorMessage(error.code), status: "error" };
  }
  if (data.session) redirect("/onboarding");
  return { message: "Tautan verifikasi telah dikirim. Periksa email Anda, lalu masuk.", status: "success" };
}

export async function acceptInvitationAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const tokenHash = formData.get("token_hash");
  if (typeof tokenHash !== "string" || !tokenHash) {
    return { message: "Tautan undangan tidak valid. Minta undangan baru kepada pengelola.", status: "error" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Undangan belum dikonfigurasi. Hubungi pengelola sistem.", status: "error" };

  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    if (error) return { message: "Tautan undangan tidak valid atau kedaluwarsa. Minta undangan baru kepada pengelola.", status: "error" };
  } catch {
    return { message: "Layanan undangan belum tersedia. Coba lagi nanti.", status: "error" };
  }

  redirect("/set-password");
}

export async function setPasswordAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  await requireSignedIn("/reports");
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  if (typeof password !== "string" || typeof confirmation !== "string" || !password || !confirmation) {
    return { message: "Isi dan konfirmasi kata sandi.", status: "error" };
  }
  if (password.length < 8 || password.length > 72) return { message: "Kata sandi harus terdiri dari 8–72 karakter.", status: "error" };
  if (password !== confirmation) return { message: "Konfirmasi kata sandi tidak cocok.", status: "error" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Pengaturan kata sandi belum tersedia. Hubungi pengelola sistem.", status: "error" };

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("Gagal menyimpan kata sandi Supabase", { code: error.code, status: error.status });
      return { message: passwordUpdateMessage(error.code), status: "error" };
    }
  } catch {
    return { message: "Layanan kata sandi belum tersedia. Coba lagi nanti.", status: "error" };
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
