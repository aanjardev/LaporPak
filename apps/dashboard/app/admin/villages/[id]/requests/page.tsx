"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VillageSelector } from "@/components/village-selector";

interface ReportsListPageProps {
  params: Promise<{ id: string }>;
}

export default function VillageReportsPage({ params }: ReportsListPageProps) {
  const [villageId, setVillageId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setVillageId(p.id));
  }, [params]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Laporan</h1>
          <p className="text-slate-500">Daftar laporan dari warga</p>
        </div>
        <VillageSelector currentVillageId={villageId || undefined} />
      </div>

      {/* TODO: Implement reports list with village filter */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <FileText className="mx-auto size-12 text-slate-300" />
        <h3 className="mt-4 font-medium text-slate-950">Fitur dalam pengembangan</h3>
        <p className="mt-1 text-sm text-slate-500">
          Halaman ini akan menampilkan laporan dari desa yang dipilih
        </p>
        <Link href={`/admin/villages/${villageId}`}>
          <Button variant="outline" className="mt-4">
            Kembali ke detail desa
          </Button>
        </Link>
      </div>
    </div>
  );
}
