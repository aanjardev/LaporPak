"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Settings,
  Users,
  AlertCircle,
  RefreshCw,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VillageNav, VillageBadge } from "@/components/village-selector";
import {
  getVillage,
  getWhatsAppStatus,
  initWhatsAppConnection,
  generateOpenClawWorkspace,
  type VillageDetail,
  type WhatsAppChannelInfo,
} from "@/lib/villages";
import { cn } from "@/lib/utils";

interface VillageDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function VillageDetailPage({ params }: VillageDetailPageProps) {
  const [villageId, setVillageId] = useState<string | null>(null);
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setVillageId(p.id));
  }, [params]);

  useEffect(() => {
    if (!villageId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [villageData, waStatus] = await Promise.all([
          getVillage(villageId),
          getWhatsAppStatus(villageId),
        ]);
        setVillage(villageData);
        setWhatsappStatus(waStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load village");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [villageId]);

  const handleInitWhatsApp = async () => {
    if (!villageId) return;
    try {
      setActionLoading("whatsapp");
      const result = await initWhatsAppConnection(villageId);
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to initialize WhatsApp");
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateWorkspace = async () => {
    if (!villageId) return;
    try {
      setActionLoading("workspace");
      const result = await generateOpenClawWorkspace(villageId);
      alert(result.message);
      // Refresh data
      const updatedVillage = await getVillage(villageId);
      setVillage(updatedVillage);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate workspace");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !village) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-8">
        <Link
          href="/admin/villages"
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Kembali ke daftar desa
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mb-2 size-5" />
          <p>{error || "Village not found"}</p>
        </div>
      </div>
    );
  }

  const aiPersonality = village.metadata?.ai_personality;
  const stats = village.stats;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-screen-2xl px-4 py-8">
        {/* Back Link */}
        <Link
          href="/admin/villages"
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Kembali ke daftar desa
        </Link>

        {/* Village Header */}
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                {aiPersonality?.emoji || "🏘️"}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">{village.name}</h1>
                <p className="mt-1 text-slate-500 capitalize">
                  {village.level.replace("_", " ")}
                </p>
                <div className="mt-2">
                  <VillageBadge village={village} />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/villages/${village.id}/settings`}>
                <Button variant="outline">
                  <Settings size={16} />
                  Pengaturan
                </Button>
              </Link>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <VillageNav villageId={village.id} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* AI Personality Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Bot size={20} className="text-sky-600" />
              <h2 className="font-semibold text-slate-950">AI Assistant</h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Nama AI</p>
                <p className="font-medium">{aiPersonality?.name || "LaporPak"}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Vibe</p>
                <p className="font-medium">{aiPersonality?.vibe || "Tegas dan membantu"}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Tone</p>
                <p className="font-medium">{aiPersonality?.tone || "santai dan familiar"}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Welcome Message</p>
                <p className="rounded-lg bg-slate-50 p-3 text-sm">
                  {aiPersonality?.welcome_message || "Selamat datang!"}
                </p>
              </div>

              <div className="pt-4">
                <Link href={`/admin/villages/${village.id}/ai`}>
                  <Button variant="outline" className="w-full">
                    <Bot size={16} />
                    Kustomisasi AI
                  </Button>
                </Link>
              </div>

              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGenerateWorkspace}
                  disabled={actionLoading === "workspace"}
                >
                  {actionLoading === "workspace" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Generate OpenClaw Workspace
                </Button>
              </div>
            </div>
          </div>

          {/* WhatsApp Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare size={20} className="text-emerald-600" />
              <h2 className="font-semibold text-slate-950">WhatsApp Integration</h2>
            </div>

            {whatsappStatus?.is_connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-700">WhatsApp Terhubung</p>
                    <p className="text-sm text-emerald-600">
                      {whatsappStatus.phone_number}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Terhubung sejak</p>
                    <p className="font-medium">
                      {whatsappStatus.connected_at
                        ? new Date(whatsappStatus.connected_at).toLocaleDateString("id-ID")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Pesan terakhir</p>
                    <p className="font-medium">
                      {whatsappStatus.last_message_at
                        ? new Date(whatsappStatus.last_message_at).toLocaleDateString("id-ID")
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3">
                  <AlertCircle size={20} className="text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-700">WhatsApp Belum Terhubung</p>
                    <p className="text-sm text-amber-600">
                      Hubungkan nomor WhatsApp Business untuk mengaktifkan chatbot
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleInitWhatsApp}
                  disabled={actionLoading === "whatsapp"}
                >
                  {actionLoading === "whatsapp" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <QrCode size={16} />
                  )}
                  Hubungkan WhatsApp
                </Button>
              </div>
            )}
          </div>

          {/* Statistics Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <FileText size={20} className="text-slate-600" />
              <h2 className="font-semibold text-slate-950">Statistik</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-lg border border-slate-100 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <FileText size={16} />
                  <span className="text-sm">Total Laporan</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-slate-950">{stats.total_reports}</p>
              </div>

              <div className="rounded-lg border border-slate-100 p-4">
                <div className="flex items-center gap-2 text-amber-500">
                  <Clock size={16} />
                  <span className="text-sm">Pending</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-amber-600">{stats.pending_reports}</p>
              </div>

              <div className="rounded-lg border border-slate-100 p-4">
                <div className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle size={16} />
                  <span className="text-sm">Selesai</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-emerald-600">{stats.resolved_reports}</p>
              </div>

              <div className="rounded-lg border border-slate-100 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <FileText size={16} />
                  <span className="text-sm">Knowledge</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-slate-950">
                  {stats.knowledge_documents}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
