import { apiFetch } from "./admin";

export type ReferralDispatchStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "queued"
  | "sending"
  | "sent"
  | "delivery_unknown"
  | "failed"
  | "cancelled";

export type ReferralRegistrationStatus =
  | "unverified"
  | "pending"
  | "registered"
  | "rejected";

export type ReferralHandlingStatus =
  | "unassigned"
  | "awaiting_acceptance"
  | "accepted"
  | "in_progress"
  | "declined"
  | "completed";

export type ReferralProgress = {
  id: string;
  report_id: string;
  source_unit_id: string;
  channel_id: string;
  target_name: string;
  channel_name: string;
  active_package_version: number;
  package_hash: string;
  dispatch_status: ReferralDispatchStatus;
  registration_status: ReferralRegistrationStatus;
  handling_status: ReferralHandlingStatus;
  external_reference: string | null;
  evidence_reference: string | null;
  is_simulated: boolean;
  package_snapshot: {
    summary: string;
    chronology: string;
    requested_action: string;
    attachment_count: number;
    share_citizen_identity: boolean;
  } | null;
  next_action: string | null;
  updated_at: string;
};

export type RoutingOption = {
  channel_id: string;
  target_unit_id: string;
  target_name: string;
  channel_name: string;
  mode: string;
  authority_source: Record<string, unknown>;
  is_simulated: boolean;
};

export type RoutingOptionsResponse = {
  report_id: string;
  items: RoutingOption[];
  needs_review: boolean;
};

export type ReferralTask = {
  id: string;
  referral_id: string;
  task_type: string;
  status: string;
  assigned: boolean;
  assigned_to_me: boolean;
  next_action: string;
  due_at: string | null;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
};

export const getReportReferrals = (reportId: string, signal?: AbortSignal) =>
  apiFetch<ReferralProgress[]>(`/api/v1/reports/${encodeURIComponent(reportId)}/referrals`, { signal });

export const getRoutingOptions = (reportId: string, signal?: AbortSignal) =>
  apiFetch<RoutingOptionsResponse>(`/api/v1/reports/${encodeURIComponent(reportId)}/routing-options`, { signal });

export const getReportTasks = (reportId: string, signal?: AbortSignal) =>
  apiFetch<ReferralTask[]>(`/api/v1/reports/${encodeURIComponent(reportId)}/tasks`, { signal });

export const updateReferralTask = (
  taskId: string,
  payload: { action: "claim" | "release" | "complete"; reason?: string },
) => apiFetch<ReferralTask>(`/api/v1/referral-tasks/${encodeURIComponent(taskId)}`, {
  method: "PATCH",
  body: JSON.stringify(payload),
});

export const approveReferral = (
  referralId: string,
  payload: { package_version: number; package_hash: string; reason: string },
) => apiFetch<ReferralProgress>(`/api/v1/referrals/${encodeURIComponent(referralId)}/approve`, {
  method: "POST",
  body: JSON.stringify(payload),
});

export const dispatchReferral = (referralId: string, operation_key: string) =>
  apiFetch<{ referral: ReferralProgress; operation_key: string; job_status: string; replayed: boolean }>(
    `/api/v1/referrals/${encodeURIComponent(referralId)}/dispatch`,
    { method: "POST", body: JSON.stringify({ operation_key }) },
  );

export const reconcileReferral = (referralId: string) =>
  apiFetch<ReferralProgress>(`/api/v1/referrals/${encodeURIComponent(referralId)}/reconcile`, { method: "POST" });
