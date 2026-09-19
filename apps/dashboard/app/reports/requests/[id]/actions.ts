"use server";

import { requireSignedIn } from "@/lib/auth";
import {
  isRequestPreviewEnabled,
  ServiceRequestPreviewError,
  simulateServiceRequestDecision,
  type ServiceRequestDecision,
} from "@/lib/service-requests";

export async function saveRequestDecision(id: string, input: ServiceRequestDecision) {
  await requireSignedIn(`/reports/requests/${encodeURIComponent(id)}`);
  if (!isRequestPreviewEnabled()) return { ok: false as const, status: 404 };
  try {
    const item = await simulateServiceRequestDecision(id, input);
    return { ok: true as const, item };
  } catch (error) {
    return { ok: false as const, status: error instanceof ServiceRequestPreviewError ? error.status : 503 };
  }
}
