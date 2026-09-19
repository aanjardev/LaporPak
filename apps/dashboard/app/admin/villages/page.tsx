import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { VillageList } from "@/components/village-list";
import { Button } from "@/components/ui/button";

export default async function VillagesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-screen-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-sky-800 text-white">
                <Building2 aria-hidden="true" size={21} />
              </div>
              <h1 className="text-2xl font-bold text-slate-950">Manajemen Desa</h1>
            </div>
            <p className="mt-1 text-slate-500">
              Kelola semua desa dalam sistem multi-desa
            </p>
          </div>
          <Link href="/admin/villages/new">
            <Button>
              <Plus size={16} />
              Tambah Desa Baru
            </Button>
          </Link>
        </div>

        {/* Village List */}
        <VillageList isSystemAdmin={true} />
      </div>
    </div>
  );
}
