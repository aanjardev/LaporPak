const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let tokenRequest: Promise<string> | null = null;
let cachedToken: string | null = null;
const activeGetRequests = new Map<string, Promise<unknown>>();

export type ApiFieldErrors = Record<string, string[]>;

export class ApiRequestError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: ApiFieldErrors;
  readonly outcomeUnknown: boolean;

  constructor(
    message: string,
    status: number | null,
    code: string,
    fieldErrors: ApiFieldErrors = {},
    outcomeUnknown = false,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.outcomeUnknown = outcomeUnknown;
  }
}

export const requestTimeoutFor = (method: string, body?: BodyInit | null) =>
  body instanceof FormData ? 60_000 : method.toUpperCase() === "GET" ? 15_000 : 30_000;

function safeErrorMessage(status: number, isMutation: boolean) {
  if (status === 401) return "Sesi Anda berakhir. Silakan masuk kembali untuk melanjutkan.";
  if (status === 403) return "Anda tidak memiliki izin untuk tindakan ini.";
  if (status === 404) return "Data yang diminta tidak ditemukan atau sudah tidak tersedia.";
  if (status === 409) return "Data telah berubah. Muat status terbaru sebelum melanjutkan.";
  if (status === 422) return "Periksa kembali data yang ditandai, lalu coba lagi.";
  if (status === 429) return "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.";
  if (status >= 500) return isMutation
    ? "Layanan sedang bermasalah. Periksa data terbaru sebelum mencoba tindakan ini lagi."
    : "Data belum dapat dimuat karena layanan sedang bermasalah. Coba lagi sebentar lagi.";
  return "Permintaan belum dapat diselesaikan. Silakan coba lagi.";
}

async function getToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) cachedToken = null;
  if (cachedToken) return cachedToken;
  if (tokenRequest) return tokenRequest;
  tokenRequest = fetch("/api/auth/token", { method: "POST", credentials: "include", cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new ApiRequestError("Sesi Anda berakhir. Silakan masuk kembali untuk melanjutkan.", response.status, "session_expired");
      const token = (await response.json()).token as string;
      cachedToken = token;
      return token;
    })
    .finally(() => { tokenRequest = null; });
  return tokenRequest;
}

async function requestApi<T>(endpoint: string, options: RequestInit, timeoutMs?: number): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";
  const started = typeof performance === "undefined" ? 0 : performance.now();
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort("timeout"), timeoutMs ?? requestTimeoutFor(method, options.body));
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;

  async function request(forceRefresh = false) {
    const token = await Promise.race([
      getToken(forceRefresh),
      new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })),
    ]);
    const headers = Object.fromEntries(new Headers(options.headers).entries());
    headers.Authorization = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    return fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, signal });
  }

  try {
    let response = await request();
    if (response.status === 401) response = await request(true);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const code = String(body?.error?.code || body?.code || `http_${response.status}`);
      const fields = (body?.error?.field_errors || body?.field_errors || {}) as ApiFieldErrors;
      throw new ApiRequestError(safeErrorMessage(response.status, isMutation), response.status, code, fields);
    }
    return response.status === 204 ? (undefined as T) : await response.json();
  } catch (reason) {
    if (reason instanceof ApiRequestError) throw reason;
    if (controller.signal.aborted && controller.signal.reason === "timeout") {
      throw new ApiRequestError(
        isMutation
          ? "Waktu tunggu berakhir. Hasil tindakan belum dapat dipastikan; periksa data terbaru sebelum mencoba lagi."
          : "Data belum dapat dimuat karena waktu tunggu berakhir. Coba periksa lagi.",
        null, "timeout", {}, isMutation,
      );
    }
    if (reason instanceof DOMException && reason.name === "AbortError") {
      throw new ApiRequestError("Permintaan dibatalkan karena halaman atau pilihan telah berubah.", null, "aborted");
    }
    throw new ApiRequestError(
      isMutation
        ? "Koneksi terputus. Hasil tindakan belum dapat dipastikan; periksa data terbaru sebelum mencoba lagi."
        : "Koneksi terputus. Data terakhir tetap ditampilkan; coba periksa lagi.",
      null, "network_error", {}, isMutation,
    );
  } finally {
    globalThis.clearTimeout(timer);
    if (started && process.env.NODE_ENV === "development") {
      const safeEndpoint = endpoint.split("?", 1)[0].replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, "/:id");
      console.debug(`[perf] api ${method} ${safeEndpoint} ${Math.round(performance.now() - started)}ms`);
    }
  }
}

export function apiFetch<T>(endpoint: string, options: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" || options.signal) return requestApi<T>(endpoint, options, timeoutMs);
  const active = activeGetRequests.get(endpoint) as Promise<T> | undefined;
  if (active) return active;
  const request = requestApi<T>(endpoint, options, timeoutMs).finally(() => activeGetRequests.delete(endpoint));
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
export const updateMe = (data: { display_name?: string; contact_phone?: string }) => apiFetch<AdminMe>("/api/v1/admin/me", { method: "PATCH", body: JSON.stringify(data) });
export const submitActivation = (villageId: string) => apiFetch<AdminVillage>(`/api/v1/admin/villages/${villageId}/activation-submission`, { method: "POST" });
export const getActivationQueue = () => apiFetch<VillageMonitoringResponse>("/api/v1/admin/activation-queue");
export const getMonitoring = () => apiFetch<VillageMonitoringResponse>("/api/v1/admin/monitoring");
export const decideActivation = (villageId: string, status: "approved" | "changes_requested", reason?: string) => apiFetch<AdminVillage>(`/api/v1/admin/villages/${villageId}/activation`, { method: "PATCH", body: JSON.stringify({ status, reason: reason || null }) });
export const onboardVillage = (data: Record<string, string>) => apiFetch<AdminMe>("/api/v1/admin/onboarding", { method: "POST", body: JSON.stringify(data) });
