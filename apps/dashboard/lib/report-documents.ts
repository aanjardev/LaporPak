import { apiFetch } from "./admin.ts";

export type ReportDocument = {
  id: string;
  document_type: "receipt" | "verified";
  version: number;
  status: "pending" | "ready" | "failed" | "replaced" | "revoked";
  delivery_status: "pending" | "sent" | "failed" | "unknown";
  file_sha256?: string | null;
  issued_at?: string | null;
  revocation_reason?: string | null;
  created_at: string;
};

export const getReportDocuments = (reportId: string) =>
  apiFetch<{ items: ReportDocument[] }>(`/api/v1/reports/${reportId}/documents`);

export const createReceiptDocument = (reportId: string) =>
  apiFetch<ReportDocument>(`/api/v1/reports/${reportId}/documents/receipt`, { method: "POST" });

export const retryReportDocument = (reportId: string, documentId: string) =>
  apiFetch<ReportDocument>(`/api/v1/reports/${reportId}/documents/${documentId}/retry`, { method: "POST" });

export const reviseReportDocument = (reportId: string, documentType: ReportDocument["document_type"], reason: string) =>
  apiFetch<ReportDocument>(`/api/v1/reports/${reportId}/documents/revisions`, {
    method: "POST", body: JSON.stringify({ document_type: documentType, reason }),
  });

export const revokeReportDocument = (reportId: string, documentId: string, reason: string) =>
  apiFetch<ReportDocument>(`/api/v1/reports/${reportId}/documents/${documentId}/revoke`, {
    method: "POST", body: JSON.stringify({ reason }),
  });
