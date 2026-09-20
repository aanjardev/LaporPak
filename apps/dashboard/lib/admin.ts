const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let tokenRequest: Promise<string> | null = null;
let cachedToken: string | null = null;
const activeGetRequests = new Map<string, Promise<unknown>>();

async function getToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) cachedToken = null;
  if (cachedToken) return cachedToken;
  if (tokenRequest) return tokenRequest;

  tokenRequest = fetch("/api/auth/token", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) throw new Error("Sesi admin tidak tersedia. Silakan masuk kembali.");
    const token = (await response.json()).token as string;
    cachedToken = token;
    return token;
  }).finally(() => { tokenRequest = null; });

  return tokenRequest;
}

async function requestApi<T>(endpoint: string, options: RequestInit): Promise<T> {
  async function request(forceRefresh = false) {
    const token = await getToken(forceRefresh);
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
  }

  let response = await request();
  if (response.status === 401) response = await request(true);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || body?.message || "Permintaan gagal");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" || options.signal) return requestApi<T>(endpoint, options);

  const active = activeGetRequests.get(endpoint) as Promise<T> | undefined;
  if (active) return active;
  const request = requestApi<T>(endpoint, options).finally(() => activeGetRequests.delete(endpoint));
  activeGetRequests.set(endpoint, request);
  return request;
}

export type AdminRole = "system_admin" | "village_admin";

export interface AdminVillage {
  id: string;
  name: string;
  level: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  activation_status: "draft" | "pending_review" | "changes_requested" | "approved";
  activation_requested_at?: string;
  activation_reviewed_at?: string;
  activation_review_reason?: string;
}

export interface AdminMe {
  id: string;
  auth_user_id: string;
  email: string;
  email_verified: boolean;
  display_name?: string;
  contact_phone?: string;
  role: AdminRole;
  role_label: string;
  villages: AdminVillage[];
}

export interface VillageMonitoring extends AdminVillage {
  profile_complete: boolean;
  whatsapp_connected: boolean;
  total_reports: number;
  report_status_counts: Record<string, number>;
  total_requests: number;
  request_status_counts: Record<string, number>;
  knowledge_documents: number;
}

export interface VillageMonitoringResponse { items: VillageMonitoring[]; total: number }

export const getMe = () => apiFetch<AdminMe>("/api/v1/admin/me");
export const updateMe = (data: { display_name?: string; contact_phone?: string }) =>
  apiFetch<AdminMe>("/api/v1/admin/me", { method: "PATCH", body: JSON.stringify(data) });
export const submitActivation = (villageId: string) =>
  apiFetch<AdminVillage>(`/api/v1/admin/villages/${villageId}/activation-submission`, { method: "POST" });
export const getActivationQueue = () =>
  apiFetch<VillageMonitoringResponse>("/api/v1/admin/activation-queue");
export const getMonitoring = () =>
  apiFetch<VillageMonitoringResponse>("/api/v1/admin/monitoring");
export const decideActivation = (villageId: string, status: "approved" | "changes_requested", reason?: string) =>
  apiFetch<AdminVillage>(`/api/v1/admin/villages/${villageId}/activation`, {
    method: "PATCH", body: JSON.stringify({ status, reason: reason || null }),
  });
export const onboardVillage = (data: Record<string, string>) =>
  apiFetch<AdminMe>("/api/v1/admin/onboarding", { method: "POST", body: JSON.stringify(data) });
