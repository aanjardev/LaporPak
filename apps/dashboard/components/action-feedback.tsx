"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";

type FeedbackKind = "success" | "error" | "warning" | "info";
type Toast = { id: number; kind: FeedbackKind; title: string; detail?: string };
type ToastInput = Omit<Toast, "id">;

const ToastContext = createContext<(toast: ToastInput) => void>(() => undefined);
const icons = { success: CheckCircle2, error: AlertCircle, warning: TriangleAlert, info: Info };
const classes = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const push = useCallback((toast: ToastInput) => {
    setToasts((current) => [...current, { ...toast, id: ++nextId.current }].slice(-3));
  }, []);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  return <ToastContext.Provider value={push}>
    {children}
    <div aria-label="Pemberitahuan" className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-3 sm:left-auto sm:w-[380px]">
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}
    </div>
  </ToastContext.Provider>;
}

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const remaining = useRef(5_000);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    started.current = Date.now();
    timer.current = setTimeout(() => dismiss(toast.id), remaining.current);
  }, [dismiss, toast.id]);
  const pause = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    remaining.current = Math.max(0, remaining.current - (Date.now() - started.current));
  }, []);
  useEffect(() => { start(); return pause; }, [pause, start]);
  const Icon = icons[toast.kind];
  return <div
    role={toast.kind === "error" ? "alert" : "status"}
    onMouseEnter={pause} onMouseLeave={start} onFocus={pause} onBlur={start}
    className={`pointer-events-auto w-full rounded-lg border p-4 shadow-lg ${classes[toast.kind]}`}
  >
    <div className="flex items-start gap-3"><Icon className="mt-0.5 shrink-0" size={19} aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-sm font-bold">{toast.title}</p>{toast.detail && <p className="mt-1 text-sm leading-5 opacity-85">{toast.detail}</p>}</div><button type="button" onClick={() => dismiss(toast.id)} aria-label="Tutup pemberitahuan" className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md"><X size={18} /></button></div>
  </div>;
}

export const useToast = () => useContext(ToastContext);

export function InlineFeedback({ kind, title, detail, action }: { kind: FeedbackKind; title: string; detail?: string; action?: React.ReactNode }) {
  const Icon = icons[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={`rounded-md border p-4 ${classes[kind]}`}>
    <div className="flex items-start gap-3"><Icon className="mt-0.5 shrink-0" size={19} aria-hidden="true" /><div className="min-w-0"><p className="text-sm font-bold">{title}</p>{detail && <p className="mt-1 text-sm leading-6">{detail}</p>}{action && <div className="mt-3">{action}</div>}</div></div>
  </div>;
}

export function PendingButton({ pending, pendingLabel, children, className = "ui-primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending: boolean; pendingLabel: string }) {
  return <button {...props} disabled={pending || props.disabled} aria-busy={pending} className={className}>
    {pending && <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />}{pending ? pendingLabel : children}
  </button>;
}

export function SlowStatus({ active, children = "Masih diproses…" }: { active: boolean; children?: React.ReactNode }) {
  return active ? <DelayedStatus>{children}</DelayedStatus> : null;
}

function DelayedStatus({ children }: { children: React.ReactNode }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8_000);
    return () => clearTimeout(timer);
  }, []);
  return slow ? <p role="status" className="text-sm text-muted-foreground">{children}</p> : null;
}
