"use client";

import { KnowledgeUnavailable } from "@/app/reports/knowledge/knowledge-unavailable";

export default function KnowledgeSettingsError({ reset }: { reset: () => void }) {
  return <KnowledgeUnavailable retry={reset} />;
}
