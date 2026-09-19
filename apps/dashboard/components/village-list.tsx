"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  MapPin,
  Users,
  MessageSquare,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVillages, getMyVillages, type Village, type VillageDetail } from "@/lib/villages";
import { cn } from "@/lib/utils";

interface VillageCardProps {
  village: Village | VillageDetail;
  isDetail?: boolean;
}

function VillageCard({ village, isDetail }: VillageCardProps) {
  const stats = isDetail && "stats" in village ? village.stats : null;
  const aiPersonality = village.metadata?.ai_personality;

  return (
    <Link
      href={`/admin/villages/${village.id}`}
      className="group block rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
            {aiPersonality?.emoji || "🏘️"}
          </div>
          <div>
            <h3 className="font-semibold text-slate-950 group-hover:text-sky-700">
              {village.name}
            </h3>
            <p className="text-sm text-slate-500 capitalize">{village.level.replace("_", " ")}</p>
          </div>
        </div>
        <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {aiPersonality && (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium">{aiPersonality.name}</span> - {aiPersonality.vibe}
        </p>
      )}

      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-600">
              <FileText size={14} />
              <span className="text-lg font-semibold text-slate-950">{stats.total_reports}</span>
            </div>
            <p className="text-xs text-slate-500">Laporan</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-600">
              <Clock size={14} />
              <span className="text-lg font-semibold text-amber-600">{stats.pending_reports}</span>
            </div>
            <p className="text-xs text-slate-500">Pending</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-600">
              <CheckCircle size={14} />
              <span className="text-lg font-semibold text-emerald-600">{stats.resolved_reports}</span>
            </div>
            <p className="text-xs text-slate-500">Selesai</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {stats?.whatsapp_connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle size={12} /> WhatsApp Terhubung
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            <AlertCircle size={12} /> WhatsApp Belum Terhubung
          </span>
        )}
      </div>
    </Link>
  );
}

interface VillageListProps {
  initialVillages?: Village[];
  isSystemAdmin?: boolean;
}

export function VillageList({ initialVillages, isSystemAdmin = true }: VillageListProps) {
  const [villages, setVillages] = useState<Village[]>(initialVillages || []);
  const [loading, setLoading] = useState(!initialVillages);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVillages() {
      try {
        setLoading(true);
        setError(null);
        const data = isSystemAdmin
          ? await getVillages({ is_active: true })
          : await getMyVillages();
        setVillages(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load villages");
      } finally {
        setLoading(false);
      }
    }
    fetchVillages();
  }, [isSystemAdmin]);

  const filteredVillages = villages.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <AlertCircle className="mb-2 size-5" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari desa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
        {isSystemAdmin && (
          <Link href="/admin/villages/new">
            <Button>
              <Plus size={16} />
              Tambah Desa
            </Button>
          </Link>
        )}
      </div>

      {filteredVillages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Building2 className="mx-auto size-12 text-slate-300" />
          <h3 className="mt-4 font-semibold text-slate-950">Belum ada desa</h3>
          <p className="mt-1 text-sm text-slate-500">
            {isSystemAdmin
              ? "Tambahkan desa pertama untuk memulai"
              : "Tidak ada desa yang dapat diakses"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVillages.map((village) => (
            <VillageCard key={village.id} village={village} />
          ))}
        </div>
      )}
    </div>
  );
}

export { VillageCard };
