"use server";

import { redirect } from "next/navigation";

import {
  requestStatuses,
  ServiceRequestApiError,
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
  } catch (error) {
    if (error instanceof ServiceRequestApiError) {
      if (error.status === 401) redirect("/login?reauth=1");
      if (error.status === 403) redirect("/access-denied");
      if (error.status === 404) redirect("/reports/requests?missing=1");
      if (error.status === 409) {
        redirect(`/reports/requests/${id}?error=conflict`);
      }
    }
    redirect(`/reports/requests/${id}?error=save`);
  }
  redirect(`/reports/requests/${id}?saved=1`);
}
