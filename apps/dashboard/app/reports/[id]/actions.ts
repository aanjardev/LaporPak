"use server";

import { getReportById, ReportApiError, updateReportStatus, type ReportStatus, type UpdateReportStatusRequest } from "@/lib/reports";
import { requireSignedIn } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function saveReportDecision(id: string, request: UpdateReportStatusRequest, mockCurrentStatus?: ReportStatus) {
  await requireSignedIn(`/reports/${encodeURIComponent(id)}`);
  let data;
  try {
    data = await updateReportStatus(id, request, undefined, mockCurrentStatus);
  } catch (error) {
    return { ok: false as const, status: error instanceof ReportApiError ? error.status : null };
  }

  try {
    revalidatePath("/reports");
    revalidatePath(`/reports/${id}`);
    if (process.env.REPORTS_DATA_SOURCE !== "api") {
      return { ok: true as const, data, report: null };
    }
    return { ok: true as const, data, report: await getReportById(id) };
  } catch {
    // PATCH has already succeeded; a failed read must not invite a second write.
    return { ok: true as const, data, report: null };
  }
}
