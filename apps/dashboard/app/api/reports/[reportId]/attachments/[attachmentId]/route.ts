import { getAdminAccessToken } from "@/lib/auth";
import { getReportAttachment } from "@/lib/reports";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string; attachmentId: string }> },
) {
  const { reportId, attachmentId } = await params;
  if (!uuid.test(reportId) || !uuid.test(attachmentId)) {
    return new Response(null, { status: 404, headers: privateHeaders });
  }

  let accessToken: string;
  try {
    accessToken = await getAdminAccessToken();
  } catch {
    return new Response(null, { status: 401, headers: privateHeaders });
  }

  try {
    const upstream = await getReportAttachment(reportId, attachmentId, accessToken);
    if (!upstream.ok) {
      const status = [401, 403, 404].includes(upstream.status) ? upstream.status : 503;
      await upstream.body?.cancel();
      return new Response(null, { status, headers: privateHeaders });
    }

    const contentType = upstream.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
    if (!contentType || !imageTypes.has(contentType) || !upstream.body) {
      await upstream.body?.cancel();
      return new Response(null, { status: 502, headers: privateHeaders });
    }

    return new Response(upstream.body, {
      headers: { ...privateHeaders, "Content-Type": contentType },
    });
  } catch {
    return new Response(null, { status: 503, headers: privateHeaders });
  }
}
