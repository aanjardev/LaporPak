import type {
  ServiceRequest,
  ServiceRequestList,
  ServiceRequestStatus,
  ServiceRequestStatusUpdateResponse,
} from "./service-request-types";

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
      signal: init?.signal ?? AbortSignal.timeout(init?.method && init.method !== "GET" ? 30_000 : 15_000),
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
  return request<ServiceRequest>(
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
