"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Save,
  Loader2,
  AlertCircle,
  Eye,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VillageNav } from "@/components/village-selector";
import {
  getVillage,
  updateVillage,
  type VillageDetail,
} from "@/lib/villages";

interface AICustomizationPageProps {
  params: Promise<{ id: string }>;
}

export default function AICustomizationPage({ params }: AICustomizationPageProps) {
  const [villageId, setVillageId] = useState<string | null>(null);
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "LaporPak",
    emoji: "📋",
    vibe: "Tegas dan membantu",
    tone: "santai dan familiar seperti tetangga",
    welcomeMessage: "Selamat datang! Saya siap membantu Anda.",
    customGreetings: ["Halo", "Hai", "Assalamualaikum"],
  });

  useEffect(() => {
    params.then((p) => setVillageId(p.id));
  }, [params]);

  useEffect(() => {
    if (!villageId) return;
    const id = villageId;

    async function fetchVillage() {
      try {
        setLoading(true);
        const data = await getVillage(id);
        setVillage(data);

        const ai = data.metadata?.ai_personality || {};
        setFormData({
          name: ai.name || "LaporPak",
          emoji: ai.emoji || "📋",
          vibe: ai.vibe || "Tegas dan membantu",
          tone: ai.tone || "santai dan familiar seperti tetangga",
          welcomeMessage: ai.welcome_message || "Selamat datang! Saya siap membantu Anda.",
          customGreetings: ai.custom_greetings || ["Halo", "Hai", "Assalamualaikum"],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load village");
      } finally {
        setLoading(false);
      }
    }
    fetchVillage();
  }, [villageId]);

  const handleSave = async () => {
    if (!villageId || !village) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await updateVillage(villageId, {
        metadata: {
          ...village.metadata,
          ai_personality: {
            name: formData.name,
            emoji: formData.emoji,
            vibe: formData.vibe,
            tone: formData.tone,
            welcome_message: formData.welcomeMessage,
            custom_greetings: formData.customGreetings,
          },
        },
      });

      setSuccess("Pengaturan AI berhasil disimpan!");
      // Refresh village data
      const updated = await getVillage(villageId);
      setVillage(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save AI settings");
    } finally {
      setSaving(false);
    }
  };

  const addGreeting = () => {
    setFormData((prev) => ({
      ...prev,
      customGreetings: [...prev.customGreetings, ""],
    }));
  };

  const updateGreeting = (index: number, value: string) => {
    setFormData((prev) => {
      const greetings = [...prev.customGreetings];
      greetings[index] = value;
      return { ...prev, customGreetings: greetings };
    });
  };

  const removeGreeting = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      customGreetings: prev.customGreetings.filter((_, i) => i !== index),
    }));
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
            <div className="flex size-12 items-center justify-center rounded-xl bg-sky-100 text-2xl">
              {formData.emoji}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Kustomisasi AI</h1>
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
            <Sparkles className="mb-2 size-5" />
            <p>{success}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
              <Bot size={20} className="text-sky-600" />
              Informasi Dasar
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nama AI
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="Nama AI assistant"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Emoji
                </label>
                <input
                  type="text"
                  value={formData.emoji}
                  onChange={(e) => setFormData((prev) => ({ ...prev, emoji: e.target.value }))}
                  className="h-10 w-20 rounded-lg border border-slate-200 px-3 text-center text-2xl"
                  placeholder="📋"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Vibe
                </label>
                <input
                  type="text"
                  value={formData.vibe}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vibe: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="Tegas dan membantu"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Deskripsi singkat karakter AI
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Tone / Gaya Bicara
                </label>
                <input
                  type="text"
                  value={formData.tone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tone: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="Santai dan familiar seperti tetangga"
                />
              </div>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
              <Eye size={20} className="text-sky-600" />
              Pesan Sambutan
            </h2>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Pesan Sambutan Default
              </label>
              <textarea
                value={formData.welcomeMessage}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, welcomeMessage: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                placeholder="Selamat datang! Saya siap membantu Anda."
              />
              <p className="mt-1 text-xs text-slate-500">
                Pesan yang akan ditampilkan saat warga pertama kali chat
              </p>
            </div>
          </div>

          {/* Custom Greetings */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
              <Sparkles size={20} className="text-sky-600" />
              Ucapan Sambutan Kustom
            </h2>

            <p className="mb-4 text-sm text-slate-500">
              Tambahkan kata-kata sapaan yang bisa digunakan AI saat menyapa warga
            </p>

            <div className="space-y-2">
              {formData.customGreetings.map((greeting, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={greeting}
                    onChange={(e) => updateGreeting(index, e.target.value)}
                    className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder={`Salam ${index + 1}`}
                  />
                  {formData.customGreetings.length > 1 && (
                    <button
                      onClick={() => removeGreeting(index)}
                      className="h-10 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addGreeting}
              className="mt-3 text-sm text-sky-600 hover:text-sky-700"
            >
              + Tambah ucapan
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-sky-900">
              <Eye size={20} />
              Preview
            </h2>

            <div className="rounded-lg border border-sky-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-sky-100 text-xl">
                  {formData.emoji}
                </div>
                <div>
                  <p className="font-medium text-slate-950">{formData.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{formData.welcomeMessage}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Tone: {formData.tone}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Simpan Pengaturan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
