import { getAdminAccessToken } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string; documentId: string }> }) {
  const { reportId, documentId } = await params;
  if (!uuid.test(reportId) || !uuid.test(documentId)) return new Response(null, { status: 404, headers: privateHeaders });
  try {
    const token = await getAdminAccessToken();
    const response = await fetch(`${API_BASE_URL}/api/v1/reports/${reportId}/documents/${documentId}/download`, { cache: "no-store", signal: AbortSignal.timeout(60_000), headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok || !response.body) return new Response(null, { status: [401, 403, 404].includes(response.status) ? response.status : 503, headers: privateHeaders });
    return new Response(response.body, { headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=laporan.pdf" } });
  } catch { return new Response(null, { status: 503, headers: privateHeaders }); }
}
