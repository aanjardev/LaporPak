"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { Building2, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ReportsNav } from "@/components/reports-nav";
import { VillageSelector } from "@/components/village-selector";

export function MobileNavigation({ showKnowledge }: { showKnowledge: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger aria-label="Buka navigasi" className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border text-brand lg:hidden"><Menu size={21} /></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-brand/50" />
        <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-3rem)] flex-col overflow-y-auto bg-brand p-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-sm font-semibold">Navigasi LaporPak</Dialog.Title>
            <Dialog.Close aria-label="Tutup navigasi" className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-white/10 focus-visible:outline-primary"><X size={21} /></Dialog.Close>
          </div>
          <div className="mt-4 rounded-md bg-card p-3"><BrandLogo /></div>
          <VillageSelector className="mt-4 text-foreground" />
          <ReportsNav showKnowledge={showKnowledge} onNavigate={() => setOpen(false)} />
          <div className="mt-4 border-t border-white/15 pt-4">
            <Link href="/admin/villages" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Building2 aria-hidden="true" size={18} /> Manajemen Desa
            </Link>
          </div>
          <p className="mt-auto pt-8 text-xs leading-5 text-white/70">Portal pelayanan dan pengaduan desa</p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
