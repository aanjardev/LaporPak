` import type { ReportCategory, ReportLocation, ReportStatus, ReportUrgency } from "@/lib/reports";

export const statusLabels: Record<ReportStatus, string> = {
  pending_verification: "Menunggu verifikasi",
  verified: "Terverifikasi",
  in_progress: "Dalam proses",
  forwarded: "Diteruskan",
  resolved: "Selesai",
  rejected: "Ditolak",
};

export const categoryLabels: Record<ReportCategory, string> = {
  infrastructure: "Infrastruktur",
  public_facility: "Fasilitas umum",
  cleanliness: "Kebersihan",
  security: "Keamanan",
  social: "Sosial",
  administration: "Administrasi",
  other: "Lainnya",
};

export const urgencyLabels: Record<ReportUrgency, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};

const statusStyles: Record<ReportStatus, string> = {
  pending_verification: "bg-amber-50 text-amber-900 ring-amber-200",
  verified: "bg-sky-50 text-sky-900 ring-sky-200",
  in_progress: "bg-indigo-50 text-indigo-900 ring-indigo-200",
  forwarded: "bg-violet-50 text-violet-900 ring-violet-200",
  resolved: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-900 ring-rose-200",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );` 
}

export function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function formatLocation(location: ReportLocation) {
  if (location.text?.trim()) return location.text;
  if (location.latitude !== null && location.longitude !== null) {
    return `${location.latitude}, ${location.longitude}`;
  }
  return "Lokasi belum tersedia";
}
