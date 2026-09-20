import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth";
import { legacyKnowledgeRedirect } from "@/lib/knowledge-route";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LegacyKnowledgeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  await requireSignedIn(`/reports/knowledge/${id}`);
  redirect(legacyKnowledgeRedirect(id, await searchParams));
}
