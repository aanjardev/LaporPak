import { reportsDataSource } from "@/lib/reports-data-source";
import { notFound, redirect } from "next/navigation";
import { ReportDetailView } from "@/components/report-detail";
import { getReportById, ReportApiError } from "@/lib/reports";
import { ReportUnavailable } from "@/components/report-unavailable";
import { requireSignedIn } from "@/lib/auth";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSignedIn(`/reports/${encodeURIComponent(id)}`);
  let report;
  try {
    report = await getReportById(id);
  } catch (error) {
    if (error instanceof ReportApiError && error.status === 401) {
      redirect(`/login?reauth=1&next=${encodeURIComponent(`/reports/${encodeURIComponent(id)}`)}`);
    }
    if (error instanceof ReportApiError && error.status === 403) {
      redirect("/access-denied");
    }
    return <ReportUnavailable />;
  }
  if (!report) notFound();

  return <ReportDetailView
    key={report.id}
    initialReport={report}
    actionsEnabled
    isMock={reportsDataSource() === "mock"}
  />;
}
