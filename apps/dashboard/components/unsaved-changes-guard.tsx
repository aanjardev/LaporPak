"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { internalNavigationTarget } from "@/lib/unsaved-navigation";

export function UnsavedChangesGuard({ active }: { active: boolean }) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const followLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const next = internalNavigationTarget(window.location.href, target.href);
      if (!next) return;
      event.preventDefault();
      setDestination(next);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
    };
  }, [active]);

  return <ConfirmationDialog
    open={destination !== null}
    onOpenChange={(open) => { if (!open) setDestination(null); }}
    title="Tinggalkan perubahan?"
    description="Perubahan yang belum disimpan akan hilang."
    cancelLabel="Tetap mengedit"
    confirmLabel="Tinggalkan tanpa menyimpan"
    tone="danger"
    onConfirm={() => {
      const next = destination;
      setDestination(null);
      if (next) router.push(next);
    }}
  />;
}
