import type { ReportStatus } from "./reports";

// Pilihan UI mengikuti kontrak; FastAPI tetap memutuskan transisi yang sah.
export const reportStatusActions: Record<ReportStatus, ReportStatus[]> = {
  pending_verification: ["verified", "rejected"],
  verified: ["in_progress"],
  in_progress: ["forwarded", "resolved"],
  forwarded: ["resolved"],
  resolved: [],
  rejected: [],
};
