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
  actor_identifier: string | null;
  notes: string | null;
  created_at: string;
};

export type ReportDetail = ReportListItem & {
  citizen: { id: string; display_name: string };
  summary: string | null;
  responsible_unit: null;
  ai_recommendation: Record<string, unknown>;
  attachments: unknown[];
  status_history: ReportStatusHistory[];
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
  status: "verified" | "rejected";
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
    actor_identifier: step === 0 ? null : "admin-desa-demo",
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
      id: `5c242fc6-77a8-4fa7-a12f-${String(index + 1).padStart(12, "0")}`,
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
    responsible_unit: null,
    ai_recommendation: {},
    attachments: [],
    status_history: history,
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

export async function getReports(query: ReportQuery): Promise<ReportListResponse> {
  if (process.env.REPORTS_DATA_SOURCE === "api") {
    throw new Error("Akses API REPORT menunggu otorisasi FastAPI");
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

export async function getReportById(id: string): Promise<ReportDetail | null> {
  if (process.env.REPORTS_DATA_SOURCE === "api") {
    throw new Error("Akses API REPORT menunggu otorisasi FastAPI");
  }

  const scenario = await mockScenario();
  if (scenario === "empty") return null;
  return mockReports.find((report) => report.id === id) ?? null;
}

export async function updateReportStatus(
  id: string,
  request: UpdateReportStatusRequest,
): Promise<UpdateReportStatusResponse> {
  if (process.env.REPORTS_DATA_SOURCE === "api") {
    throw new Error("Perubahan status API menunggu autentikasi admin");
  }

  const report = mockReports.find((item) => item.id === id);
  if (!report || report.status !== "pending_verification") {
    throw new Error("Laporan tidak tersedia untuk verifikasi");
  }
  if (!["verified", "rejected"].includes(request.status) || !request.reason.trim()) {
    throw new Error("Keputusan dan alasan wajib diisi");
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
