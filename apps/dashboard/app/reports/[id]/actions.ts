"use server";

import { updateReportStatus, type UpdateReportStatusRequest } from "@/lib/reports";
import { requireSignedIn } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function saveReportDecision(id: string, request: UpdateReportStatusRequest) {
  await requireSignedIn(`/reports/${encodeURIComponent(id)}`);
  try {
    const data = await updateReportStatus(id, request);
    revalidatePath("/reports");
    revalidatePath(`/reports/${id}`);
    return { ok: true as const, data };
  } catch {
    return { ok: false as const };
  }
}
