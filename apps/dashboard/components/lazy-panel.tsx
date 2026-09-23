"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function LazyPanel({ children, label }: { children: ReactNode; label: string }) {
  const [visible, setVisible] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      const timer = globalThis.setTimeout(() => setVisible(true), 0);
      return () => globalThis.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "320px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={host} className="defer-render">{visible ? children : <div aria-busy="true" aria-label={label} className="ui-panel min-h-40 motion-safe:animate-pulse p-5"><span className="sr-only">{label}…</span><div className="h-5 w-40 rounded bg-muted" /><div className="mt-4 h-16 rounded bg-muted" /></div>}</div>;
}
