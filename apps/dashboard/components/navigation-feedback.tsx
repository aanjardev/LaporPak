"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function isInternalNavigation(event: MouseEvent, link: HTMLAnchorElement) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.hasAttribute("download")) return false;
  const url = new URL(link.href, window.location.href);
  return url.origin === window.location.origin && url.pathname !== window.location.pathname;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      const link = target instanceof Element ? target.closest("a") : null;
      if (link instanceof HTMLAnchorElement && isInternalNavigation(event, link)) {
        const nextPath = new URL(link.href).pathname;
        setPendingPath(nextPath);
        if (process.env.NODE_ENV === "development") performance.mark("laporpak:navigation-start");
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (!pendingPath || pendingPath !== pathname || process.env.NODE_ENV !== "development") return;
    performance.mark("laporpak:navigation-end");
    performance.measure("laporpak:navigation", "laporpak:navigation-start", "laporpak:navigation-end");
    const measure = performance.getEntriesByName("laporpak:navigation").at(-1);
    if (measure) console.debug(`[perf] navigation ${pathname} ${Math.round(measure.duration)}ms`);
    performance.clearMarks("laporpak:navigation-start");
    performance.clearMarks("laporpak:navigation-end");
    performance.clearMeasures("laporpak:navigation");
  }, [pathname, pendingPath]);

  useEffect(() => {
    if (!pendingPath) return;
    const timer = globalThis.setTimeout(() => setPendingPath(null), 15_000);
    return () => globalThis.clearTimeout(timer);
  }, [pendingPath]);

  if (!pendingPath || pendingPath === pathname) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 bg-brand-yellow" role="status" aria-live="polite">
      <span className="sr-only">Halaman sedang dimuat…</span>
      <span aria-hidden="true" className="block h-full origin-left animate-[navigation-progress_1.2s_ease-in-out_infinite] bg-brand" />
    </div>
  );
}
