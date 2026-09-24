import { reportsDataSource } from "./reports-data-source.ts";
import { reportStatusActions } from "./report-status-actions.ts";

export const reportStatuses = [
  "pending_verification",
  "verified",
  "in_progress",
  "forwarded",
  "resolved",
  "rejected",
] as const;

export const reportCategories = [
  "infrastructure",
  "public_facility",
  "cleanliness",
  "security",
  "social",
  "administration",
  "other",
] as const;

export const reportUrgencies = ["low", "medium", "high", "critical"] as const;

export type ReportStatus = (typeof reportStatuses)[number];
export type ReportCategory = (typeof reportCategories)[number];
export type ReportUrgency = (typeof reportUrgencies)[number];

export type ReportLocation = {
  text: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ReportListItem = {
  id: string;
  ticket_number: string;
  category: ReportCategory;
  description: string;
  location: ReportLocation;
  urgency: ReportUrgency;
  status: ReportStatus;
  created_at: string;
};

export type ReportListResponse = {
  items: ReportListItem[];
  page: number;
  page_size: number;
  total: number;
};

export type ReportStatusHistory = {
  old_status: ReportStatus | null;
  new_status: ReportStatus;
  actor_type: string;
  actor_display_name: string | null;
  notes: string | null;
  created_at: string;
};

export type ReportAttachment = {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number;
  created_at: string;
};

export type ReportDetail = ReportListItem & {
  citizen: { display_name: string };
  summary: string | null;
  responsible_unit: { id: string; name: string } | null;
  ai_recommendation: Record<string, unknown>;
  attachments: ReportAttachment[];
  status_history: ReportStatusHistory[];
  allowed_transitions: ReportStatus[];
  verified_at: string | null;
  resolved_at: string | null;
  updated_at: string;
};

export type ReportQuery = {
  page: number;
  page_size: 20;
  status?: ReportStatus;
  urgency?: ReportUrgency;
  category?: ReportCategory;
  search?: string;
};

export type UpdateReportStatusRequest = {
  status: ReportStatus;
  reason: string;
};

export type UpdateReportStatusResponse = {
  id: string;
  ticket_number: string;
  status: ReportStatus;
  updated_at: string;
};

const topics: Array<{
  category: ReportCategory;
  urgency: ReportUrgency;
  description: string;
  summary: string;
  location: string;
}> = [
  {
    category: "infrastructure",
    urgency: "high",
    description: "Jalan berlubang di dekat balai desa mengganggu kendaraan warga.",
    summary: "Kerusakan jalan di sekitar balai desa perlu diperiksa petugas.",
    location: "Jalan Balai Desa, RT 03",
  },
  {
    category: "public_facility",
    urgency: "medium",
    description: "Lampu penerangan di lapangan desa tidak menyala sejak kemarin.",
    summary: "Penerangan lapangan desa dilaporkan tidak berfungsi.",
    location: "Lapangan Desa, RT 01",
  },
  {
    category: "cleanliness",
    urgency: "medium",
    description: "Sampah menumpuk di tepi jalan dan belum diangkut.",
    summary: "Penumpukan sampah di tepi jalan menunggu penanganan.",
    location: "Jalan Melati, RT 05",
  },
  {
    category: "security",
    urgency: "critical",
    description: "Pohon besar hampir tumbang dan menutupi akses jalan warga.",
    summary: "Pohon berisiko tumbang di dekat akses utama warga.",
    location: "Jalan Kenanga, RT 02",
  },
  {
    category: "social",
    urgency: "low",
    description: "Warga lansia membutuhkan bantuan untuk mengakses layanan desa.",
    summary: "Permintaan bantuan akses layanan untuk warga lansia.",
    location: "RT 04, RW 02",
  },
  {
    category: "administration",
    urgency: "low",
    description: "Papan informasi persyaratan administrasi di kantor desa rusak.",
    summary: "Papan informasi layanan administrasi perlu diperbaiki.",
    location: "Kantor Desa, RT 01",
  },
  {
    category: "other",
    urgency: "medium",
    description: "Saluran air di sekitar rumah warga tersumbat setelah hujan.",
    summary: "Saluran air tersumbat dan perlu pemeriksaan lebih lanjut.",
    location: "Gang Mawar, RT 06",
  },
];

const mockStatuses: ReportStatus[] = [
  "pending_verification",
  "verified",
  "in_progress",
  "forwarded",
  "resolved",
  "rejected",
];

function reportStatusActionsForMock(status: ReportStatus) {
  return reportStatusActions[status];
}

function statusPath(status: ReportStatus): ReportStatus[] {
  if (status === "rejected") return ["pending_verification", "rejected"];
  if (status === "forwarded") {
    return ["pending_verification", "verified", "in_progress", "forwarded"];
  }
  if (status === "resolved") {
    return ["pending_verification", "verified", "in_progress", "forwarded", "resolved"];
  }
  return ["pending_verification", "verified", "in_progress"].slice(
    0,
    mockStatuses.indexOf(status) + 1,
  ) as ReportStatus[];
}

const mockReports: ReportDetail[] = Array.from({ length: 27 }, (_, index) => {
  const topic = topics[index % topics.length];
  const status = mockStatuses[index % mockStatuses.length];
  const created = new Date(Date.UTC(2026, 8, 16 - Math.floor(index / 3), 8, 30));
  const path = statusPath(status);
  const history: ReportStatusHistory[] = path.map((next, step) => ({
    old_status: step === 0 ? null : path[step - 1],
    new_status: next,
    actor_type: step === 0 ? "system" : "admin",
    actor_display_name: step === 0 ? null : "Admin Desa",
    notes: index === 4
      ? `Tahap ${step + 1}: petugas meninjau informasi lokasi, berkoordinasi dengan unit terkait, dan mencatat tindak lanjut agar warga dapat memahami perjalanan laporan secara utuh.`
      : step === 0 ? "Laporan dibuat" : "Status diperbarui oleh petugas.",
    created_at: new Date(created.getTime() + step * 3_600_000).toISOString(),
  }));
  const verified = history.find((entry) => entry.new_status === "verified");
  const resolved = history.find((entry) => entry.new_status === "resolved");

  return {
    id: `72af1a52-7016-48c7-aacc-${String(index + 1).padStart(12, "0")}`,
    ticket_number: `LP-2026-${String(index + 1).padStart(4, "0")}`,
    citizen: {
      display_name: "Warga",
    },
    category: topic.category,
    description: index === 0
      ? `${topic.description} Warga menyampaikan bahwa lubang semakin lebar setelah hujan. Sepeda motor harus berpindah jalur untuk menghindarinya, sementara di pagi hari ruas ini dipakai anak sekolah dan pedagang. Warga meminta petugas memeriksa kondisi jalan serta memasang penanda sementara sampai perbaikan dilakukan.\n\nMenurut warga, kerusakan sudah terlihat selama beberapa minggu dan air sering menutup bagian jalan yang berlubang.`
      : topic.description,
    summary: index === 0 ? null : topic.summary,
    location: { text: index === 0 ? `${topic.location}, dekat persimpangan menuju pasar desa dan halte angkutan warga` : topic.location, latitude: null, longitude: null },
    urgency: topic.urgency,
    status,
    responsible_unit: index === 0
      ? { id: "b5e83fd3-71e2-4ec3-b432-b7e970b57c6a", name: "Unit Infrastruktur Desa" }
      : null,
    ai_recommendation: {},
    attachments: index === 0 ? [
      {
        id: "9a0d1245-4e4e-40be-bbba-000000000001",
        file_name: "foto-jalan-rusak.png",
        mime_type: "image/png",
        file_size: 1024,
        created_at: created.toISOString(),
      },
      {
        id: "9a0d1245-4e4e-40be-bbba-000000000002",
        file_name: "foto-kondisi-sekitar.png",
        mime_type: "image/png",
        file_size: 2048,
        created_at: created.toISOString(),
      },
    ] : [],
    status_history: history,
    allowed_transitions: reportStatusActionsForMock(status),
    verified_at: verified?.created_at ?? null,
    resolved_at: resolved?.created_at ?? null,
    created_at: created.toISOString(),
    updated_at: history.at(-1)?.created_at ?? created.toISOString(),
  };
});

async function mockScenario() {
  if (process.env.NODE_ENV !== "development") return "normal";
  const scenario = process.env.REPORTS_MOCK_SCENARIO ?? "normal";
  if (scenario === "slow") {
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  if (scenario === "error") throw new Error("Simulasi kegagalan sumber data laporan");
  return scenario;
}

export class ReportApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const token = accessToken ?? await (await import("./auth")).getAdminAccessToken();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");

  const response = await fetch(new URL(path, `${baseUrl.replace(/\/+$/, "")}/`), {
    ...init,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(init.method && init.method !== "GET" ? 30_000 : 15_000),
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) {
    let message = "Layanan laporan tidak tersedia";
    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
    } catch {
      // Keep the safe fallback when the upstream body is not JSON.
    }
    throw new ReportApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export async function getReports(
  query: ReportQuery,
  accessToken?: string,
): Promise<ReportListResponse> {
  if (reportsDataSource() === "api") {
    const params = new URLSearchParams({
      page: String(query.page),
      page_size: String(query.page_size),
    });
    if (query.status) params.set("status", query.status);
    if (query.urgency) params.set("urgency", query.urgency);
    if (query.category) params.set("category", query.category);
    if (query.search) params.set("search", query.search);
    return apiRequest(`/api/v1/reports?${params}`, {}, accessToken);
  }

  const scenario = await mockScenario();
  if (scenario === "empty") {
    return { items: [], page: query.page, page_size: query.page_size, total: 0 };
  }
  const search = query.search?.trim().toLocaleLowerCase("id-ID");
  const filtered = mockReports.filter((report) => {
    if (query.status && report.status !== query.status) return false;
    if (query.urgency && report.urgency !== query.urgency) return false;
    if (query.category && report.category !== query.category) return false;
    if (!search) return true;
    return [report.ticket_number, report.description, report.location.text ?? ""]
      .some((value) => value.toLocaleLowerCase("id-ID").includes(search));
  });
  const offset = (query.page - 1) * query.page_size;
  const items = filtered.slice(offset, offset + query.page_size).map((report) => ({
    id: report.id,
    ticket_number: report.ticket_number,
    category: report.category,
    description: report.description,
    location: report.location,
    urgency: report.urgency,
    status: report.status,
    created_at: report.created_at,
  }));
  return { items, page: query.page, page_size: query.page_size, total: filtered.length };
}

export async function getReportById(
  id: string,
  accessToken?: string,
): Promise<ReportDetail | null> {
  if (reportsDataSource() === "api") {
    try {
      const report = await apiRequest<ReportDetail>(
        `/api/v1/reports/${encodeURIComponent(id)}`,
        {},
        accessToken,
      );
      // Keep private Storage paths and other backend metadata out of client props.
      return {
        ...report,
        attachments: report.attachments.map((item) => ({
          id: item.id,
          file_name: typeof item.file_name === "string" ? item.file_name : null,
          mime_type: typeof item.mime_type === "string" ? item.mime_type : null,
          file_size: Number.isSafeInteger(item.file_size) ? item.file_size : 0,
          created_at: item.created_at,
        })),
      };
    } catch (error) {
      if (error instanceof ReportApiError && error.status === 404) return null;
      throw error;
    }
  }

  const scenario = await mockScenario();
  if (scenario === "empty") return null;
  return mockReports.find((report) => report.id === id) ?? null;
}

export async function getReportAttachment(
  reportId: string,
  attachmentId: string,
  accessToken: string,
): Promise<Response> {
  if (reportsDataSource() === "api") {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
    return fetch(new URL(
      `/api/v1/reports/${encodeURIComponent(reportId)}/attachments/${encodeURIComponent(attachmentId)}`,
      `${baseUrl.replace(/\/+$/, "")}/`,
    ), {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  const report = mockReports.find((item) => item.id === reportId);
  if (!report?.attachments.some((item) => item.id === attachmentId)) {
    return new Response(null, { status: 404 });
  }
  // ponytail: one small synthetic image exercises the private-image path without storing a public photo fixture.
  return new Response(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAKAAAAB4CAIAAAD6wG44AAADeklEQVR42u3csW4TQRDG8fPo+hCJijxAhJQOpYjkvEKKiIaOAho6igiJBkGBhCjS0UBBi4RS0FFjiQLR0eQBQoW48AYUlpBl4/P6dnd2Z+4/VSI78t38/O2sz3Ymny9/N5TfEloAMAUwBTAFMAUwBTAFMMAUwBTAFMAUwBTAFMAAUwBTAFMAUwBTAFMAUwADHFFXz+/SX7fAc12MfQIvumLsDXhVFOOCNUn43aSNkHvPPtJxqwkOiSlRtgocLoexPeBtzTC2BDxMC2MbwDFOGFe9i07Iw9a6ugSnDR9Rrgs4hwfGtQDnk8C4PHBuA4xLAut0H+MCu+giTWdrrZTgUpEiyhrAZbuMcV7gGvqLscYMbprm1tWF5jH93DsFpszrYApgCmAKYApgKqhanYd58/1mz62P7vxCggRTgxL8/sP9jXd6Oj3RPKaQQ6LyLtFP3s56bn31cEpnWaIpR5ustLXTHZR66D+7P0iwW93ij84STRkHriFAtkIs6Po2VtpkxV+rqq2nO92BiQ0XM5gZzJJoeaEWdH0bt6PSPT/bn//w+PXlSIYxM5gZzAJo+TiFrvk+WqFfvo+ZGcwMJgqWj5wEOzcG2LkxwMxgynKIgy5Vvpx9Wj6B29vd3/HGqueMariEKTzffZ8XSzQzmPhaPjtB1/c5Crq+z7RtxlQJ3+dnBhPfKs5Xxqb77euXURm3YzjPJdR/vx4eHeufu/LVD7czOCSpBaXdAueLb8zaqymtHOLWtG4Manfd7d7YLSKtaTy59+LElu4w1O6667l1VXqxMmHrGNubwYdHx/3G/ZYb/6RUrG0Da+6c50IDmJewc0vrLNQaS3QO3fCFerB0yBoeL53bWDxld51N/4gd/OepcmwbON8kHuC0lXT//a3MY/Ed32GBjgx9VV0Su7oxGVoX6EDa5PHN1ysZT3b7wxqe2kyLc6aO2f5MVqpehy/I5l4Ky5jjW1vl6JtY19WMlM5bEVUDO86u2jMpbQ+F1rscvVmAvca3yAc/qgMuq+vvIxmp+ilkt9qnTpKuChK+F4bWU3xXPWI+01ODbvx7xq0b3RCk87P96ek7c8M4xrh1rPvfml08aBa+w7Iu4lUtzjHG4/puUuCq7mlPLqOKr92N1eBuC7q+XxkLur6N+R8dzkuIr+8QC7q+jQVd38bMYGYw8bUcYkHXt/FfdPJKapRuk5IAAAAASUVORK5CYII=",
    "base64",
  ), { headers: { "Content-Type": "image/png" } });
}

export async function updateReportStatus(
  id: string,
  request: UpdateReportStatusRequest,
  accessToken?: string,
  mockCurrentStatus?: ReportStatus,
): Promise<UpdateReportStatusResponse> {
  if (reportsDataSource() === "api") {
    return apiRequest(
      `/api/v1/reports/${encodeURIComponent(id)}/status`,
      { method: "PATCH", body: JSON.stringify(request) },
      accessToken,
    );
  }

  const report = mockReports.find((item) => item.id === id);
  // ponytail: current status comes from the mock UI only; real writes always use FastAPI.
  if (!report || !reportStatusActions[mockCurrentStatus ?? report.status]?.includes(request.status)) {
    throw new Error("Transisi status laporan tidak tersedia");
  }
  if (!request.reason.trim()) {
    throw new Error("Alasan perubahan status wajib diisi");
  }

  if (process.env.NODE_ENV === "development") {
    if (process.env.REPORTS_MOCK_MUTATION_SCENARIO === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    if (process.env.REPORTS_MOCK_MUTATION_SCENARIO === "error") {
      throw new Error("Simulasi kegagalan penyimpanan status");
    }
  }

  return {
    id: report.id,
    ticket_number: report.ticket_number,
    status: request.status,
    updated_at: new Date().toISOString(),
  };
}
