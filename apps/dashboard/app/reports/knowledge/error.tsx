"use client";

import { KnowledgeUnavailable } from "./knowledge-unavailable";

export default function KnowledgeError({ reset }: { reset: () => void }) {
  return <KnowledgeUnavailable retry={reset} />;
}
