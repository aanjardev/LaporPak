import { apiFetch } from "./admin.ts";

export interface VillageAIPersonality {
  name: string; emoji: string; vibe: string; welcome_message: string;
  custom_greetings: string[]; tone: string;
}

export interface VillageMetadata {
  ai_personality: VillageAIPersonality;
  is_ai_enabled: boolean;
  whatsapp_business_name?: string;
  logo_url?: string;
  primary_color?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  village_code?: string;
  province?: string;
  regency?: string;
  district?: string;
  office_hours?: string;
  regency_type?: "Kabupaten" | "Kota";
  postal_code?: string;
  document_official_name?: string;
  document_official_title?: string;
  has_logo?: boolean;
  logo_file_name?: string;
}

export interface Village {
  id: string; name: string; level: string; parent_id?: string;
  metadata: VillageMetadata; is_active: boolean;
  activation_status: "draft" | "pending_review" | "changes_requested" | "approved";
  activation_requested_at?: string; activation_reviewed_at?: string;
  activation_review_reason?: string; created_at: string; updated_at: string;
}

export interface VillageStats {
  total_reports: number; pending_reports: number; resolved_reports: number;
  total_requests: number; pending_requests: number; knowledge_documents: number;
  whatsapp_connected: boolean;
  report_status_counts: Record<string, number>;
  request_status_counts: Record<string, number>;
}
export interface VillageDetail extends Village { stats: VillageStats }
export interface VillageListResponse { items: Village[]; total: number }
export interface WhatsAppChannelInfo {
  phone_number?: string; is_connected: boolean; connected_at?: string;
  last_message_at?: string; status: string; message?: string;
}
export interface WhatsAppPairingResponse {
  status: string; connected: boolean; qr_data_url?: string; expires_at?: string; message: string;
}

export const getMyVillages = () => apiFetch<VillageListResponse>("/api/v1/villages/me");
export const getVillages = (params?: { is_active?: boolean }) => {
  void params;
  return apiFetch<VillageListResponse>("/api/v1/villages");
};
export const getVillage = (villageId: string) => apiFetch<VillageDetail>(`/api/v1/villages/${villageId}`);
export const updateVillage = (villageId: string, data: { name?: string; metadata?: VillageMetadata }) =>
  apiFetch<Village>(`/api/v1/villages/${villageId}`, { method: "PATCH", body: JSON.stringify(data) });
export const uploadVillageLogo = (villageId: string, file: File) => {
  const body = new FormData();
  body.set("file", file);
  return apiFetch<Village>(`/api/v1/villages/${villageId}/logo`, { method: "POST", body });
};
export const getWhatsAppStatus = (villageId: string, signal?: AbortSignal) =>
  apiFetch<WhatsAppChannelInfo>(`/api/v1/villages/${villageId}/whatsapp/status`, { signal });
export const startWhatsAppPairing = (villageId: string, signal?: AbortSignal) =>
  apiFetch<WhatsAppPairingResponse>(`/api/v1/villages/${villageId}/whatsapp/pairing`, { method: "POST", signal });
export const disconnectWhatsApp = (villageId: string) =>
  apiFetch<void>(`/api/v1/villages/${villageId}/whatsapp`, { method: "DELETE" });
