import { getReportAttachment } from "@/lib/reports";
import { getAdminAccessToken } from "@/lib/auth";

const SAFE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string; attachmentId: string }> },
) {
  const { reportId, attachmentId } = await params;
  let accessToken: string;
  try {
    accessToken = await getAdminAccessToken();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await getReportAttachment(reportId, attachmentId, accessToken);
  } catch {
    return new Response("Attachment unavailable", { status: 503 });
  }

  if (!upstream.ok) {
    return new Response(upstream.status === 404 ? "Attachment not found" : "Attachment unavailable", {
      status: upstream.status === 401 || upstream.status === 403 || upstream.status === 404
        ? upstream.status
        : 503,
    });
  }

  const contentType = upstream.headers.get("content-type")?.split(";", 1)[0].trim();
  if (!contentType || !SAFE_IMAGE_TYPES.has(contentType)) {
    return new Response("Attachment unavailable", { status: 503 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
