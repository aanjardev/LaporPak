"use server";

import { updateReportStatus, type UpdateReportStatusRequest } from "@/lib/reports";
import { requireSignedIn } from "@/lib/auth";

export async function saveMockReportDecision(id: string, request: UpdateReportStatusRequest) {
  await requireSignedIn(`/reports/${encodeURIComponent(id)}`);
  try {
    return { ok: true as const, data: await updateReportStatus(id, request) };
  } catch {
    return { ok: false as const };
  }
}
