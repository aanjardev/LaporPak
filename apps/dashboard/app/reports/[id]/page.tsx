import { notFound } from "next/navigation";
import { ReportDetailView } from "@/components/report-detail";
import { getReportById } from "@/lib/reports";
import { ReportUnavailable } from "@/components/report-unavailable";
import { requireSignedIn } from "@/lib/auth";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSignedIn(`/reports/${encodeURIComponent(id)}`);
  let report;
  try {
    report = await getReportById(id);
  } catch {
    return <ReportUnavailable />;
  }
  if (!report) notFound();

  return <ReportDetailView key={report.id} initialReport={report} mockActionsEnabled={process.env.REPORTS_DATA_SOURCE !== "api"} />;
}
