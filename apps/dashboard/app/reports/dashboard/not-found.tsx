import Link from "next/link";
export default function DashboardNotFound() {
  return <div className="ui-panel mx-auto max-w-xl p-6"><h1 className="text-2xl font-bold">Ringkasan tidak ditemukan</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Ringkasan desa tidak tersedia untuk akun ini.</p><Link href="/reports" className="ui-primary mt-5">Buka laporan warga</Link></div>;
}
