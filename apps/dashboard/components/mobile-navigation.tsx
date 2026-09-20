"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ReportsNav } from "@/components/reports-nav";

export function MobileNavigation({ showKnowledge, accountName, villageName }: { showKnowledge: boolean; accountName: string; villageName: string }) {
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
          <div className="mt-4 rounded-lg border border-white/15 px-3 py-3"><p className="text-sm font-semibold">{accountName}</p><p className="mt-1 text-xs text-white/65">{villageName}</p></div>
          <ReportsNav showKnowledge={showKnowledge} onNavigate={() => setOpen(false)} />
          <p className="mt-auto pt-8 text-xs leading-5 text-white/70">Portal pelayanan dan pengaduan desa</p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
