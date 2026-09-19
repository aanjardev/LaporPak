import { BrandLogo } from "@/components/brand-logo";
import { logoutAction } from "@/app/auth-actions";
import { requireSignedIn } from "@/lib/auth";

export default async function AccessDeniedPage() {
  await requireSignedIn("/reports");
  return (
    <main className="auth-surface">
      <div className="auth-panel">
        <BrandLogo />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Akses ditolak</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Akun Anda belum memiliki izin untuk mengakses halaman ini. Hubungi pengelola sistem jika akses diperlukan.</p>
        <form action={logoutAction} className="mt-7">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-lg border border-input px-4 text-sm font-semibold text-foreground hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Keluar dari akun</button>
        </form>
      </div>
    </main>
  );
}
