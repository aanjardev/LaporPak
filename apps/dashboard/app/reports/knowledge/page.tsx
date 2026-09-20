import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth";
import { legacyKnowledgeRedirect } from "@/lib/knowledge-route";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LegacyKnowledgePage({ searchParams }: { searchParams: SearchParams }) {
  await requireSignedIn("/reports/knowledge");
  redirect(legacyKnowledgeRedirect(null, await searchParams));
}
