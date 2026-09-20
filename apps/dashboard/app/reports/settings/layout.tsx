import { SettingsTabs } from "./settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl">
    <header className="ui-page-header">
      <p className="text-sm font-semibold text-brand">Administrasi desa</p>
      <h1>Pengaturan Akun</h1>
      <p className="mt-2 text-sm text-muted-foreground">Kelola profil, koneksi, dan pengetahuan layanan desa.</p>
    </header>
    <div className="mt-5 max-w-xl"><SettingsTabs showKnowledge={process.env.REPORTS_DATA_SOURCE === "api"} /></div>
    <div className="mt-7">{children}</div>
  </div>;
}
