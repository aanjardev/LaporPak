"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  CheckCircle,
  Loader2,
  AlertCircle,
  QrCode,
  Phone,
  Unlink,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VillageNav } from "@/components/village-selector";
import {
  getVillage,
  getWhatsAppStatus,
  initWhatsAppConnection,
  linkWhatsAppPhone,
  disconnectWhatsApp,
  type VillageDetail,
  type WhatsAppChannelInfo,
} from "@/lib/villages";

interface WhatsAppPageProps {
  params: Promise<{ id: string }>;
}

export default function WhatsAppPage({ params }: WhatsAppPageProps) {
  const [villageId, setVillageId] = useState<string | null>(null);
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    params.then((p) => setVillageId(p.id));
  }, [params]);

  useEffect(() => {
    if (!villageId) return;
    const id = villageId;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [villageData, waStatus] = await Promise.all([
          getVillage(id),
          getWhatsAppStatus(id),
        ]);
        setVillage(villageData);
        setWhatsappStatus(waStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [villageId]);

  const handleInitWhatsApp = async () => {
    if (!villageId) return;
    try {
      setActionLoading("init");
      setError(null);
      setSuccess(null);

      const result = await initWhatsAppConnection(villageId);
      setSuccess(result.message);

      // Refresh status
      const status = await getWhatsAppStatus(villageId);
      setWhatsappStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize WhatsApp");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLinkPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!villageId || !phoneInput.trim()) return;

    try {
      setActionLoading("link");
      setError(null);
      setSuccess(null);

      const result = await linkWhatsAppPhone(villageId, phoneInput.trim());
      setSuccess(result.message);
      setPhoneInput("");

      // Refresh status
      const status = await getWhatsAppStatus(villageId);
      setWhatsappStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link phone");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    if (!villageId) return;
    if (!confirm("Apakah Anda yakin ingin memutuskan koneksi WhatsApp?")) return;

    try {
      setActionLoading("disconnect");
      setError(null);
      setSuccess(null);

      await disconnectWhatsApp(villageId);
      setSuccess("WhatsApp berhasil diputuskan");

      // Refresh status
      const status = await getWhatsAppStatus(villageId);
      setWhatsappStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect WhatsApp");
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Back Link */}
        <Link
          href={`/admin/villages/${villageId}`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Kembali ke detail desa
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-2xl">
              <MessageSquare />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">WhatsApp Integration</h1>
              <p className="text-slate-500">{village?.name}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mb-6 border-b border-slate-200 pb-4">
          <VillageNav villageId={villageId || ""} />
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="mb-2 size-5" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            <CheckCircle className="mb-2 size-5" />
            <p>{success}</p>
          </div>
        )}

        {/* WhatsApp Status */}
        {whatsappStatus?.is_connected ? (
          <div className="space-y-6">
            {/* Connected State */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle size={24} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-emerald-900">
                    WhatsApp Business Terhubung
                  </h2>
                  <p className="mt-1 text-emerald-700">
                    Nomor: <strong>{whatsappStatus.phone_number}</strong>
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4">
                    <div>
                      <p className="text-sm text-emerald-600">Terhubung sejak</p>
                      <p className="font-medium">
                        {whatsappStatus.connected_at
                          ? new Date(whatsappStatus.connected_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-emerald-600">Pesan terakhir</p>
                      <p className="font-medium">
                        {whatsappStatus.last_message_at
                          ? new Date(whatsappStatus.last_message_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "Belum ada pesan"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleDisconnect}
                  disabled={actionLoading === "disconnect"}
                >
                  {actionLoading === "disconnect" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Unlink size={16} />
                  )}
                  Putuskan Koneksi
                </Button>
              </div>
            </div>

            {/* Link New Phone */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
                <Phone size={20} className="text-sky-600" />
                Ganti Nomor WhatsApp
              </h2>

              <form onSubmit={handleLinkPhone} className="flex gap-3">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+62 xxx xxxx xxxx"
                  className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
                <Button
                  type="submit"
                  disabled={actionLoading === "link" || !phoneInput.trim()}
                >
                  {actionLoading === "link" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Phone size={16} />
                  )}
                  Hubungkan
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Not Connected State */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-slate-100">
                  <MessageSquare size={24} className="text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    WhatsApp Business Belum Terhubung
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Hubungkan nomor WhatsApp Business untuk mengaktifkan chatbot AI
                    yang bisa melayani warga 24/7.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  onClick={handleInitWhatsApp}
                  disabled={actionLoading === "init"}
                >
                  {actionLoading === "init" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <QrCode size={16} />
                  )}
                  Mulai Setup WhatsApp
                </Button>
              </div>
            </div>

            {/* Setup Instructions */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
                <QrCode size={20} className="text-sky-600" />
                Langkah Setup
              </h2>

              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                    1
                  </span>
                  <div>
                    <p className="font-medium">Persiapkan WhatsApp Business API</p>
                    <p className="text-sm text-slate-500">
                      Pastikan Anda memiliki akun WhatsApp Business API yang aktif
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                    2
                  </span>
                  <div>
                    <p className="font-medium">Dapatkan credentials</p>
                    <p className="text-sm text-slate-500">
                      Siapkan Phone Number ID dan Access Token dari Meta Business
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                    3
                  </span>
                  <div>
                    <p className="font-medium">Konfigurasi webhook</p>
                    <p className="text-sm text-slate-500">
                      Setel webhook URL untuk menerima pesan dari WhatsApp
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs">
                        /api/v1/webhooks/whatsapp/{villageId}
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `${window.location.origin}/api/v1/webhooks/whatsapp/${villageId}`
                          )
                        }
                        className="rounded p-1 text-slate-500 hover:bg-slate-100"
                        title="Copy URL"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                    4
                  </span>
                  <div>
                    <p className="font-medium">Hubungkan nomor</p>
                    <p className="text-sm text-slate-500">
                      Gunakan form di atas untuk menghubungkan nomor WhatsApp
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
