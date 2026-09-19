"use server";

import { redirect } from "next/navigation";

import {
  requestStatuses,
  updateServiceRequest,
  type ServiceRequestStatus,
} from "@/lib/service-requests";

export async function updateRequestAction(id: string, formData: FormData) {
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!requestStatuses.includes(status as ServiceRequestStatus) || !reason) {
    redirect(`/reports/requests/${id}?error=invalid`);
  }
  try {
    await updateServiceRequest(id, status as ServiceRequestStatus, reason);
  } catch {
    redirect(`/reports/requests/${id}?error=save`);
  }
  redirect(`/reports/requests/${id}?saved=1`);
}
