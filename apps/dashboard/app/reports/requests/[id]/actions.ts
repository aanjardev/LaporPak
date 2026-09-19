"use server";

import { requireSignedIn } from "@/lib/auth";
import {
  ServiceRequestApiError,
  updateServiceRequest,
} from "@/lib/service-requests";
import {
  requestDecisionStatuses,
  type ServiceRequestDecision,
} from "@/lib/service-request-types";

export async function saveRequestDecision(id: string, input: ServiceRequestDecision) {
  await requireSignedIn(`/reports/requests/${encodeURIComponent(id)}`);
  const reason = input.reason.trim();
  if (!requestDecisionStatuses.includes(input.status) || !reason || reason.length > 1000) {
    return { ok: false as const, status: 422 };
  }
  try {
    const item = await updateServiceRequest(id, input.status, reason);
    return { ok: true as const, item };
  } catch (error) {
    return {
      ok: false as const,
      status: error instanceof ServiceRequestApiError ? error.status : 503,
    };
  }
}
