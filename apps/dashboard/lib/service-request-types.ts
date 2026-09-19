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

export type ServiceRequestItem = {
  id: string;
  ticket_number: string;
  request_type: "residency_letter";
  applicant_name: string;
  domicile_address: string;
  domicile_duration: string;
  purpose: string;
  status: ServiceRequestStatus;
  administrative_unit_id: string;
  created_at: string;
  updated_at: string;
};

export type ServiceRequest = ServiceRequestItem;

export type ServiceRequestList = {
  items: ServiceRequestItem[];
  page: number;
  page_size: number;
  total: number;
};
