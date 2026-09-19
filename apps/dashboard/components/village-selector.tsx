"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Settings,
  Bot,
  MessageSquare,
  Users,
  FileText,
} from "lucide-react";
import { getMyVillages, type Village } from "@/lib/villages";
import { cn } from "@/lib/utils";

interface VillageSelectorProps {
  currentVillageId?: string;
  className?: string;
}

export function VillageSelector({ currentVillageId, className }: VillageSelectorProps) {
  const [villages, setVillages] = useState<Village[]>([]);
  const [open, setOpen] = useState(false);

  // Load villages on mount
  useEffect(() => {
    getMyVillages()
      .then((data) => setVillages(data.items));
  }, []);

  const currentVillage = villages.find((v) => v.id === currentVillageId);
  const aiEmoji = currentVillage?.metadata?.ai_personality?.emoji || "📋";

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
      >
        <span className="text-lg">{aiEmoji}</span>
        <span className="max-w-[150px] truncate">{currentVillage?.name || "Pilih Desa"}</span>
        <ChevronDown
          size={16}
          className={cn(
            "text-slate-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-2 min-w-[280px] rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pilih Desa
              </p>
            </div>
            <div className="max-h-64 overflow-auto p-1">
              {villages.map((village) => (
                <Link
                  key={village.id}
                  href={`/admin/villages/${village.id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                    village.id === currentVillageId
                      ? "bg-sky-50 text-sky-700"
                      : "hover:bg-slate-50"
                  )}
                >
                  <span className="text-xl">
                    {village.metadata?.ai_personality?.emoji || "🏘️"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{village.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      AI: {village.metadata?.ai_personality?.name || "LaporPak"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface VillageNavProps {
  villageId?: string;
}

export function VillageNav({ villageId }: VillageNavProps) {
  if (!villageId) return null;

  const navItems = [
    { href: `/admin/villages/${villageId}`, icon: FileText, label: "Laporan" },
    { href: `/admin/villages/${villageId}/requests`, icon: FileText, label: "Permintaan" },
    { href: `/admin/villages/${villageId}/knowledge`, icon: FileText, label: "Knowledge" },
    { href: `/admin/villages/${villageId}/ai`, icon: Bot, label: "AI" },
    { href: `/admin/villages/${villageId}/whatsapp`, icon: MessageSquare, label: "WhatsApp" },
    { href: `/admin/villages/${villageId}/admins`, icon: Users, label: "Admin" },
    { href: `/admin/villages/${villageId}/settings`, icon: Settings, label: "Pengaturan" },
  ];

  return (
    <nav className="flex flex-wrap gap-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <item.icon size={16} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function VillageBadge({ village }: { village: Village }) {
  const aiName = village.metadata?.ai_personality?.name || "LaporPak";
  const aiEmoji = village.metadata?.ai_personality?.emoji || "📋";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">
      <span>{aiEmoji}</span>
      <span>{village.name}</span>
      <span className="text-slate-400">·</span>
      <span className="text-slate-500">{aiName}</span>
    </span>
  );
}
