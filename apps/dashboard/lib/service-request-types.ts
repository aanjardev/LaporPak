export const requestStatuses = [
  "pending_review",
  "approved",
  "rejected",
  "completed",
] as const;

export type ServiceRequestStatus = (typeof requestStatuses)[number];

export const requestStatusLabels: Record<ServiceRequestStatus, string> = {
  pending_review: "Menunggu peninjauan",
  approved: "Disetujui",
  rejected: "Ditolak",
  completed: "Selesai",
};

export const requestDecisionStatuses = ["approved", "rejected", "completed"] as const;

export type ServiceRequestDecisionStatus = (typeof requestDecisionStatuses)[number];

export type ServiceRequestDecision = {
  status: ServiceRequestDecisionStatus;
  reason: string;
};

export type ServiceRequestSummary = {
  id: string;
  ticket_number: string;
  request_type: "residency_letter";
  applicant_name: string;
  status: ServiceRequestStatus;
  administrative_unit_id: string;
  created_at: string;
  updated_at: string;
};

export type ServiceRequestHistory = {
  old_status: ServiceRequestStatus | null;
  new_status: ServiceRequestStatus;
  actor_type: string;
  actor_display_name: string | null;
  reason: string | null;
  created_at: string;
};

export type ServiceRequest = ServiceRequestSummary & {
  domicile_address: string;
  domicile_duration: string;
  purpose: string;
  allowed_transitions: ServiceRequestDecisionStatus[];
  status_history: ServiceRequestHistory[];
};

export type ServiceRequestStatusUpdateResponse = {
  id: string;
  ticket_number: string;
  status: ServiceRequestStatus;
  updated_at: string;
};

export type ServiceRequestList = {
  items: ServiceRequestSummary[];
  page: number;
  page_size: number;
  total: number;
};
