export const requestStatuses = [
  "pending_review",
  "approved",
  "rejected",
  "completed",
] as const;

export type ServiceRequestStatus = (typeof requestStatuses)[number];

export type ServiceRequestSummary = {
  id: string;
  ticket_number: string;
  request_type: "residency_letter";
  applicant_name: string;
  status: ServiceRequestStatus;
  administrative_unit_id: string;
  created_at: string;
  updated_at: string;
};

export type ServiceRequestHistory = {
  old_status: ServiceRequestStatus | null;
  new_status: ServiceRequestStatus;
  actor_type: string;
  actor_display_name: string | null;
  reason: string | null;
  created_at: string;
};

export type ServiceRequestDetail = ServiceRequestSummary & {
  domicile_address: string;
  domicile_duration: string;
  purpose: string;
  allowed_transitions: ServiceRequestStatus[];
  status_history: ServiceRequestHistory[];
};

export type ServiceRequestStatusUpdateResponse = {
  id: string;
  ticket_number: string;
  status: ServiceRequestStatus;
  updated_at: string;
};

export type ServiceRequestList = {
  items: ServiceRequestSummary[];
  page: number;
  page_size: number;
  total: number;
};

export class ServiceRequestApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Service request API failed");
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  accessToken?: string,
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const response = await fetch(
    new URL(path, `${baseUrl.replace(/\/+$/, "")}/`),
    {
      ...init,
      cache: "no-store",
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${accessToken ?? await (await import("./auth.ts")).getAdminAccessToken()}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    },
  );
  if (!response.ok) throw new ServiceRequestApiError(response.status);
  return response.json() as Promise<T>;
}

export function listServiceRequests(page: number, accessToken?: string) {
  return request<ServiceRequestList>(
    `/api/v1/service-requests?page=${page}&page_size=20`, undefined, accessToken,
  );
}

export function getServiceRequest(id: string, accessToken?: string) {
  return request<ServiceRequestDetail>(
    `/api/v1/service-requests/${encodeURIComponent(id)}`, undefined, accessToken,
  );
}

export function updateServiceRequest(
  id: string,
  status: ServiceRequestStatus,
  reason: string,
  accessToken?: string,
) {
  return request<ServiceRequestStatusUpdateResponse>(
    `/api/v1/service-requests/${encodeURIComponent(id)}/status`,
    { method: "PATCH", body: JSON.stringify({ status, reason }) }, accessToken,
  );
}
