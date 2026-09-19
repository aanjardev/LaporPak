"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VillageNav } from "@/components/village-selector";
import { getVillage, type VillageDetail } from "@/lib/villages";

interface KnowledgePageProps {
  params: Promise<{ id: string }>;
}

export default function VillageKnowledgePage({ params }: KnowledgePageProps) {
  const [villageId, setVillageId] = useState<string | null>(null);
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setVillageId(p.id));
  }, [params]);

  useEffect(() => {
    if (villageId) {
      getVillage(villageId)
        .then(setVillage)
        .finally(() => setLoading(false));
    }
  }, [villageId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href={`/admin/villages/${villageId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        ← Kembali ke detail desa
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Knowledge Base</h1>
        <p className="text-slate-500">{village?.name}</p>
      </div>

      {/* Navigation */}
      <div className="border-b border-slate-200 pb-4">
        <VillageNav villageId={villageId || ""} />
      </div>

      {/* Placeholder */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <BookOpen className="mx-auto size-12 text-slate-300" />
        <h3 className="mt-4 font-medium text-slate-950">Knowledge Base</h3>
        <p className="mt-1 text-sm text-slate-500">
          Kelola dokumen pengetahuan untuk AI chatbot
        </p>
        <Link href="/reports/knowledge">
          <Button variant="outline" className="mt-4">
            Buka Knowledge Management
          </Button>
        </Link>
      </div>
    </div>
  );
}
