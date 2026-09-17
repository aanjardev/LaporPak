"use server";

import { updateReportStatus, type UpdateReportStatusRequest } from "@/lib/reports";

export async function saveMockReportDecision(id: string, request: UpdateReportStatusRequest) {
  try {
    return { ok: true as const, data: await updateReportStatus(id, request) };
  } catch {
    return { ok: false as const };
  }
}
