import { reportStatuses, type ReportStatus } from "./reports.ts";
import { requestStatuses, type ServiceRequestStatus } from "./service-request-types.ts";

export type DashboardDays = 7 | 30 | 90;
export type AttentionItem = {
  kind: "report" | "request" | "knowledge";
  id: string;
  label: string;
  status: "pending_verification" | "pending_review" | "draft" | "failed";
  created_at: string;
};
export type VillageDashboard = {
  village: { id: string; name: string };
  period: { days: DashboardDays; start_date: string; end_date: string; timezone: "Asia/Jakarta" };
  generated_at: string;
  kpis: { reports_created: number; requests_created: number; needs_attention: number; ask_ready: number };
  attention_counts: { reports: number; requests: number; knowledge: number };
  report_status_counts: Record<ReportStatus, number>;
  request_status_counts: Record<ServiceRequestStatus, number>;
  knowledge: { active: number; ready: number; draft: number; failed: number; processing: number };
  daily: { date: string; reports: number; requests: number }[];
  attention: AttentionItem[];
};

export class DashboardApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null = null) {
    super("Dashboard data unavailable");
    this.name = "DashboardApiError";
    this.status = status;
    this.code = code;
  }
}

export function dashboardDays(value: unknown): DashboardDays {
  return value === "7" ? 7 : value === "90" ? 90 : 30;
}

export function attentionHref(item: AttentionItem) {
  const prefix = { report: "/reports", request: "/reports/requests", knowledge: "/reports/knowledge" };
  return `${prefix[item.kind]}/${encodeURIComponent(item.id)}`;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DashboardApiError(502);
  return value as Record<string, unknown>;
}
function counts(value: unknown, keys: readonly string[]) {
  const object = record(value);
  for (const key of keys) {
    if (!Number.isSafeInteger(object[key]) || (object[key] as number) < 0) throw new DashboardApiError(502);
  }
}

// Validate the new contract at the API boundary; never render missing data as zero.
export function parseDashboard(value: unknown, villageId: string, days: DashboardDays): VillageDashboard {
  const data = record(value);
  const village = record(data.village);
  const period = record(data.period);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (village.id !== villageId || typeof village.name !== "string" ||
      period.days !== days || period.timezone !== "Asia/Jakarta" ||
      typeof period.start_date !== "string" || !datePattern.test(period.start_date) ||
      typeof period.end_date !== "string" || !datePattern.test(period.end_date) ||
      typeof data.generated_at !== "string" || !Number.isFinite(Date.parse(data.generated_at))) throw new DashboardApiError(502);
  counts(data.kpis, ["reports_created", "requests_created", "needs_attention", "ask_ready"]);
  counts(data.attention_counts, ["reports", "requests", "knowledge"]);
  counts(data.report_status_counts, reportStatuses);
  counts(data.request_status_counts, requestStatuses);
  counts(data.knowledge, ["active", "ready", "draft", "failed", "processing"]);
  if (!Array.isArray(data.daily) || data.daily.length !== days || !Array.isArray(data.attention) || data.attention.length > 8) throw new DashboardApiError(502);
  const start = Date.parse(`${period.start_date}T00:00:00Z`);
  if (!Number.isFinite(start)) throw new DashboardApiError(502);
  data.daily.forEach((item, index) => {
    const point = record(item);
    counts(point, ["reports", "requests"]);
    if (point.date !== new Date(start + index * 86400000).toISOString().slice(0, 10)) throw new DashboardApiError(502);
  });
  if (record(data.daily.at(-1)).date !== period.end_date) throw new DashboardApiError(502);
  const statuses: Record<string, string[]> = { report: ["pending_verification"], request: ["pending_review"], knowledge: ["draft", "failed"] };
  const ids = new Set<string>();
  data.attention.forEach((entry) => {
    const item = record(entry);
    if (typeof item.kind !== "string" || !Object.hasOwn(statuses, item.kind) ||
        typeof item.status !== "string" || !statuses[item.kind].includes(item.status) ||
        typeof item.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item.id) ||
        typeof item.label !== "string" || !item.label.trim() ||
        typeof item.created_at !== "string" || !Number.isFinite(Date.parse(item.created_at))) throw new DashboardApiError(502);
    const key = `${item.kind}:${item.id}`;
    if (ids.has(key)) throw new DashboardApiError(502);
    ids.add(key);
  });
  const result = value as VillageDashboard;
  if (result.kpis.reports_created !== result.daily.reduce((sum, d) => sum + d.reports, 0) ||
      result.kpis.requests_created !== result.daily.reduce((sum, d) => sum + d.requests, 0) ||
      result.kpis.needs_attention !== Object.values(result.attention_counts).reduce((sum, n) => sum + n, 0) ||
      result.kpis.ask_ready !== result.knowledge.ready ||
      result.attention.length !== Math.min(8, result.kpis.needs_attention)) throw new DashboardApiError(502);
  return result;
}

export function mockDashboard(village: { id: string; name: string }, days: DashboardDays, now = new Date(), empty = false): VillageDashboard {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const end = Date.parse(`${today}T00:00:00Z`);
  const daily = Array.from({ length: days }, (_, index) => ({
    date: new Date(end - (days - index - 1) * 86400000).toISOString().slice(0, 10),
    reports: empty ? 0 : (days - index) % 5,
    requests: empty ? 0 : (days - index) % 3,
  }));
  const n = (value: number) => empty ? 0 : value;
  return {
    village,
    period: { days, start_date: daily[0].date, end_date: today, timezone: "Asia/Jakarta" },
    generated_at: now.toISOString(),
    kpis: { reports_created: daily.reduce((s, d) => s + d.reports, 0), requests_created: daily.reduce((s, d) => s + d.requests, 0), needs_attention: n(4), ask_ready: n(6) },
    attention_counts: { reports: n(2), requests: n(1), knowledge: n(1) },
    report_status_counts: { pending_verification: n(2), verified: n(30), in_progress: n(24), forwarded: n(12), resolved: n(150), rejected: n(10) },
    request_status_counts: { pending_review: n(1), approved: n(12), rejected: n(6), completed: n(90) },
    knowledge: { active: n(9), ready: n(6), draft: n(1), failed: n(1), processing: n(2) },
    daily,
    attention: empty ? [] : [
      { kind: "report", status: "pending_verification", label: "LP-DEMO-0001" },
      { kind: "request", status: "pending_review", label: "REQ-DEMO-0001" },
      { kind: "knowledge", status: "failed", label: "Sumber ASK" },
      { kind: "report", status: "pending_verification", label: "LP-DEMO-0002" },
    ].map((item, i) => ({ ...item, id: `a0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, created_at: new Date(now.getTime() - i * 3600000).toISOString() })) as AttentionItem[],
  };
}

export async function getVillageDashboard(village: { id: string; name: string }, days: DashboardDays, token: string, scenario?: string): Promise<VillageDashboard> {
  if (process.env.REPORTS_DATA_SOURCE !== "api") {
    if (process.env.NODE_ENV === "production") throw new DashboardApiError(503);
    if (scenario === "error") throw new DashboardApiError(503);
    if (scenario === "slow") await new Promise((resolve) => setTimeout(resolve, 1500));
    return mockDashboard(village, days, new Date(), scenario === "empty");
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!baseUrl) throw new DashboardApiError(503);
  try {
    const url = new URL(`/api/v1/villages/${encodeURIComponent(village.id)}/dashboard`, baseUrl);
    url.searchParams.set("days", String(days));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      let code: string | null = null;
      try {
        const body = await response.json();
        code = typeof body?.error?.code === "string" ? body.error.code : null;
      } catch {
        // Keep the safe fallback for a non-JSON upstream response.
      }
      throw new DashboardApiError(response.status, code);
    }
    return parseDashboard(await response.json(), village.id, days);
  } catch (error) {
    if (error instanceof DashboardApiError) throw error;
    throw new DashboardApiError(503);
  }
}
