export type KnowledgeReviewStatus = "draft" | "demo" | "approved" | "rejected";

export type KnowledgeReviewHistory = {
  old_status: KnowledgeReviewStatus | null;
  new_status: KnowledgeReviewStatus;
  actor_type: string;
  actor_display_name: string | null;
  reason: string;
  created_at: string;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  category: string | null;
  source_type: string;
  administrative_unit_id: string;
  is_mandatory: boolean;
  is_active: boolean;
  processing_status: "pending" | "processing" | "ready" | "failed";
  failure_message: string | null;
  review_status: KnowledgeReviewStatus;
  reviewer_display_name: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  allowed_review_transitions: KnowledgeReviewStatus[];
  created_at: string;
  updated_at: string;
};

export type KnowledgeDocumentDetail = KnowledgeDocument & {
  content: string;
  service_key: string | null;
  review_history: KnowledgeReviewHistory[];
};

export class KnowledgeApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Knowledge API request failed");
    this.name = "KnowledgeApiError";
    this.status = status;
  }
}

function endpoint(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  return new URL(path, `${baseUrl.replace(/\/+$/, "")}/`);
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(init?.body instanceof FormData ? 60_000 : init?.method && init.method !== "GET" ? 30_000 : 15_000),
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new KnowledgeApiError(response.status);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function listKnowledgeDocuments(token: string) {
  return request<{ items: KnowledgeDocument[] }>(
    "/api/v1/knowledge/documents",
    token,
  );
}

export function getKnowledgeDocument(id: string, token: string) {
  return request<KnowledgeDocumentDetail>(
    `/api/v1/knowledge/documents/${encodeURIComponent(id)}`,
    token,
  );
}

export function createKnowledgeDocument(input: FormData, token: string) {
  return request<KnowledgeDocument>("/api/v1/knowledge/documents", token, {
    method: "POST",
    body: input,
  });
}

export function updateKnowledgeDocument(
  id: string,
  input: Record<string, unknown>,
  token: string,
) {
  return request<KnowledgeDocumentDetail>(
    `/api/v1/knowledge/documents/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export function reviewKnowledgeDocument(
  id: string,
  input: { status: "approved" | "rejected"; reason: string },
  token: string,
) {
  return request<KnowledgeDocumentDetail>(
    `/api/v1/knowledge/documents/${encodeURIComponent(id)}/review`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export function deactivateKnowledgeDocument(id: string, token: string) {
  return request<void>(
    `/api/v1/knowledge/documents/${encodeURIComponent(id)}`,
    token,
    { method: "DELETE" },
  );
}
