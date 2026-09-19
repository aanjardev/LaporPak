export const requestStatuses = ["pending_review", "approved", "rejected", "completed"] as const;

export type ServiceRequestStatus = (typeof requestStatuses)[number];

export const requestStatusLabels: Record<ServiceRequestStatus, string> = {
  pending_review: "Menunggu peninjauan",
  approved: "Disetujui",
  rejected: "Ditolak",
  completed: "Selesai",
};

export type ServiceRequest = {
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

export type ServiceRequestList = {
  items: ServiceRequest[];
  page: number;
  page_size: number;
  total: number;
};

export type ServiceRequestDecision = {
  status: "approved" | "rejected";
  reason: string;
};

export class ServiceRequestPreviewError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Service request preview failed");
    this.status = status;
  }
}

const unitId = "11111111-1111-4111-8111-111111111111";
const longAddress = "Jalan Melati Gang Tiga Nomor 18, RT 04/RW 02, Dusun Sukamaju, dekat balai pertemuan warga dan pos pelayanan kesehatan desa.";
const longPurpose = "Permohonan surat keterangan domisili untuk melengkapi berkas administrasi pendidikan dan pembaruan data pada layanan publik. Pemohon akan membawa dokumen pendukung untuk diperiksa petugas sesuai SOP yang berlaku.";

const fixtures: ServiceRequest[] = Array.from({ length: 23 }, (_, index) => {
  const number = index + 1;
  const date = new Date(Date.UTC(2026, 8, 18, 9, 0, 0) - index * 60 * 60 * 1000).toISOString();
  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    ticket_number: `REQ-2026-${String(number).padStart(4, "0")}`,
    request_type: "residency_letter",
    applicant_name: index === 0 ? "Siti Rahmawati" : `Warga Contoh ${number}`,
    domicile_address: index === 0 ? longAddress : `RT 0${(index % 5) + 1}/RW 02, Desa Contoh`,
    domicile_duration: index === 0 ? "Sejak Januari 2021" : "3 tahun",
    purpose: index === 0 ? longPurpose : "Melengkapi administrasi pendidikan.",
    status: index < 3 ? "pending_review" : requestStatuses[(index % 3) + 1],
    administrative_unit_id: unitId,
    created_at: date,
    updated_at: date,
  };
});

export function isRequestPreviewEnabled() {
  return process.env.NODE_ENV === "development" && process.env.REQUESTS_PREVIEW === "mock";
}

function readScenario() {
  return process.env.NODE_ENV === "development" ? process.env.REQUESTS_MOCK_SCENARIO : undefined;
}

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getServiceRequests(page: number): Promise<ServiceRequestList> {
  if (!isRequestPreviewEnabled()) throw new ServiceRequestPreviewError(404);
  const scenario = readScenario();
  if (scenario === "slow") await pause(800);
  if (scenario === "error") throw new ServiceRequestPreviewError(503);
  const items = scenario === "empty" ? [] : fixtures;
  const pageSize = 20;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    page_size: pageSize,
    total: items.length,
  };
}

export async function getServiceRequestById(id: string): Promise<ServiceRequest | null> {
  if (!isRequestPreviewEnabled()) throw new ServiceRequestPreviewError(404);
  const scenario = readScenario();
  if (scenario === "slow") await pause(800);
  if (scenario === "error") throw new ServiceRequestPreviewError(503);
  if (scenario === "empty") return null;
  return fixtures.find((item) => item.id === id) ?? null;
}

export async function simulateServiceRequestDecision(
  id: string,
  input: ServiceRequestDecision,
): Promise<ServiceRequest> {
  if (!isRequestPreviewEnabled()) throw new ServiceRequestPreviewError(404);
  const reason = input.reason.trim();
  if (!["approved", "rejected"].includes(input.status) || reason.length < 1 || reason.length > 1000) {
    throw new ServiceRequestPreviewError(422);
  }
  const item = fixtures.find((candidate) => candidate.id === id);
  if (!item) throw new ServiceRequestPreviewError(404);
  if (item.status !== "pending_review") throw new ServiceRequestPreviewError(409);
  const scenario = process.env.NODE_ENV === "development" ? process.env.REQUESTS_MOCK_MUTATION_SCENARIO : undefined;
  if (scenario === "slow") await pause(800);
  if (scenario === "error") throw new ServiceRequestPreviewError(503);
  if (scenario === "conflict") throw new ServiceRequestPreviewError(409);
  // ponytail: keputusan mock hanya hidup di halaman; database resmi kelak dibaca ulang dari FastAPI.
  return { ...item, status: input.status, updated_at: new Date().toISOString() };
}
