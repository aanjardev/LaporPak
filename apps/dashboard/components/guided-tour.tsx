"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { HelpCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { availableSteps, introSteps, pageGuide, pageGuideScope, pageTourStorageKey, tourStorageKey, type TourStep } from "@/lib/guided-tour";

type TourMode = "intro" | "page" | null;
type Spot = { left: number; top: number; right: number; bottom: number };

function visible(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].some((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

export function GuidedTour({ accountId, villageActive, knowledgeAvailable }: { accountId: string; villageActive: boolean; knowledgeAvailable: boolean }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousPath = useRef(pathname);
  const autoIntroSeen = useRef<string | null>(null);
  const autoPagesSeen = useRef(new Set<string>());
  const [mode, setMode] = useState<TourMode>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [closedCount, setClosedCount] = useState(0);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});
  const step = steps[index];

  const start = useCallback((kind: Exclude<TourMode, null>) => {
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const guide = kind === "intro"
      ? { title: "Kenali LaporPak", steps: introSteps(villageActive, mobile) }
      : pageGuide(pathname, villageActive, knowledgeAvailable);
    const shown = availableSteps(guide.steps, visible);
    setActivePageId(kind === "page" && shown.length ? pageGuideScope(pathname, villageActive, knowledgeAvailable)?.id ?? null : null);
    setTitle(guide.title);
    setSteps(shown.length ? shown : [{ title: guide.title, body: "Panduan untuk bagian ini belum tersedia pada tampilan saat ini. Coba muat ulang halaman setelah data siap." }]);
    setIndex(0);
    setMode(kind);
    menu.current?.removeAttribute("open");
  }, [knowledgeAvailable, pathname, villageActive]);

  const close = useCallback(() => {
    if (mode === "intro") {
      autoIntroSeen.current = accountId;
      try { localStorage.setItem(tourStorageKey(accountId), "done"); } catch { /* Storage may be unavailable in private mode. */ }
    } else if (mode === "page" && activePageId) {
      const key = pageTourStorageKey(accountId, activePageId);
      autoPagesSeen.current.add(key);
      try { localStorage.setItem(key, "done"); } catch { /* Keep completion for this session. */ }
    }
    setMode(null);
    setSpot(null);
    setClosedCount((count) => count + 1);
  }, [accountId, activePageId, mode]);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      setMode(null);
      setSpot(null);
    }
  }, [pathname]);

  useEffect(() => {
    const scope = pageGuideScope(pathname, villageActive, knowledgeAvailable);
    let introDone = autoIntroSeen.current === accountId;
    try { introDone ||= localStorage.getItem(tourStorageKey(accountId)) === "done"; } catch { /* Storage may be unavailable. */ }
    let pageDone = !scope;
    if (scope) {
      const key = pageTourStorageKey(accountId, scope.id);
      pageDone = autoPagesSeen.current.has(key);
      try { pageDone ||= localStorage.getItem(key) === "done"; } catch { /* Use session memory. */ }
    }
    const kind = !introDone ? "intro" : !pageDone ? "page" : null;
    if (!kind) return;

    const startedAt = Date.now();
    const check = () => {
      if (Date.now() - startedAt > 30_000) { window.clearInterval(interval); window.clearTimeout(timer); return; }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (kind === "page" && (!scope || !visible(scope.readyTarget))) return;
      window.clearInterval(interval);
      window.clearTimeout(timer);
      if (kind === "intro") autoIntroSeen.current = accountId;
      else if (scope) autoPagesSeen.current.add(pageTourStorageKey(accountId, scope.id));
      start(kind);
    };
    const timer = window.setTimeout(check, 450);
    const interval = window.setInterval(check, 250);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, [accountId, closedCount, knowledgeAvailable, pathname, start, villageActive]);

  useEffect(() => {
    if (!mode || !step) return;
    const focusFrame = requestAnimationFrame(() => stepHeading.current?.focus());
    const target = step.target ? [...document.querySelectorAll<HTMLElement>(step.target)].find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) : null;
    if (target) target.scrollIntoView({ block: "center", behavior: "auto" });
    const update = () => {
      const rect = target?.getBoundingClientRect();
      const width = window.innerWidth;
      const height = window.innerHeight;
      const nextSpot = rect && rect.width && rect.height && rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width ? {
        left: Math.max(0, rect.left - 7), top: Math.max(0, rect.top - 7),
        right: Math.min(width, rect.right + 7), bottom: Math.min(height, rect.bottom + 7),
      } : null;
      setSpot(nextSpot);
      if (width < 640) {
        setPopupStyle({ left: 16, right: 16, top: nextSpot && nextSpot.top > height / 2 ? 16 : undefined, bottom: !nextSpot || nextSpot.top <= height / 2 ? 16 : undefined });
      } else if (!nextSpot) {
        setPopupStyle({ left: "50%", top: "50%", transform: "translate(-50%, -50%)" });
      } else {
        const cardWidth = 400;
        const left = nextSpot.right + cardWidth + 24 < width ? nextSpot.right + 16
          : nextSpot.left - cardWidth - 24 > 0 ? nextSpot.left - cardWidth - 16
          : Math.max(16, Math.min(width - cardWidth - 16, nextSpot.left));
        const top = Math.max(16, Math.min(height - 300, nextSpot.top));
        setPopupStyle({ left, top });
      }
    };
    const frame = requestAnimationFrame(update);
    const observer = target && "ResizeObserver" in window ? new ResizeObserver(update) : null;
    if (target) observer?.observe(target);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(focusFrame); observer?.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [mode, step]);

  useEffect(() => {
    const dismissMenu = (event: PointerEvent) => {
      if (menu.current && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.removeAttribute("open");
    };
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") menu.current?.removeAttribute("open"); };
    document.addEventListener("pointerdown", dismissMenu);
    document.addEventListener("keydown", dismissOnEscape);
    return () => { document.removeEventListener("pointerdown", dismissMenu); document.removeEventListener("keydown", dismissOnEscape); };
  }, []);

  return <>
    <details ref={menu} className="relative shrink-0">
      <summary data-guide="tour-help" className="inline-flex min-h-11 list-none items-center gap-2 rounded-md px-3 text-sm font-semibold text-brand hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"><HelpCircle aria-hidden="true" size={17} /><span className="hidden sm:inline">Bantuan halaman</span><span className="sm:hidden">Bantuan</span></summary>
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
        <button type="button" onClick={() => start("page")} className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium text-brand hover:bg-muted">Panduan halaman ini</button>
        <button type="button" onClick={() => start("intro")} className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium text-brand hover:bg-muted">Ulangi tur awal</button>
      </div>
    </details>
    <Dialog.Root open={mode !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <Dialog.Portal>
        <div aria-hidden="true" className="fixed inset-0 z-[60] pointer-events-auto">
          {spot ? <>
            <div className="absolute inset-x-0 top-0 bg-brand/75" style={{ height: spot.top }} />
            <div className="absolute inset-x-0 bottom-0 bg-brand/75" style={{ top: spot.bottom }} />
            <div className="absolute left-0 bg-brand/75" style={{ top: spot.top, width: spot.left, height: spot.bottom - spot.top }} />
            <div className="absolute right-0 bg-brand/75" style={{ top: spot.top, left: spot.right, height: spot.bottom - spot.top }} />
            <div className="absolute rounded-lg border-[3px] border-primary shadow-[0_0_0_2px_rgba(23,35,63,.5)]" style={{ left: spot.left, top: spot.top, width: spot.right - spot.left, height: spot.bottom - spot.top }} />
          </> : <div className="absolute inset-0 bg-brand/75" />}
        </div>
        <Dialog.Popup style={popupStyle} className="fixed z-[70] w-[calc(100vw-2rem)] max-w-[400px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-border bg-card p-5 text-foreground shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-widest text-brand">{title} · {index + 1}/{steps.length}</p><Dialog.Close aria-label="Tutup panduan" className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted"><X size={19} /></Dialog.Close></div>
          <div className="mt-2 flex items-center gap-4"><Image src="/brand/laporpak-mascot.png" width={86} height={86} alt="" className="size-20 shrink-0 object-contain sm:size-24" /><div><Dialog.Title ref={stepHeading} tabIndex={-1} className="text-lg font-bold leading-snug outline-none">{step?.title}</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">{step?.body}</Dialog.Description></div></div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><button type="button" onClick={close} className="min-h-11 rounded-md px-3 text-sm font-semibold text-brand hover:bg-muted">Lewati</button><div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)} className="min-h-11 rounded-md border border-input px-3 text-sm font-semibold disabled:opacity-50">Kembali</button><button type="button" onClick={() => index === steps.length - 1 ? close() : setIndex((value) => value + 1)} className="ui-primary px-4">{index === steps.length - 1 ? "Selesai" : "Selanjutnya"}</button></div></div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
