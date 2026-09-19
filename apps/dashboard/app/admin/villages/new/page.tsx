"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Bot,
  Loader2,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createVillage, type VillageMetadata } from "@/lib/villages";

export default function NewVillagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    level: "village",
    aiName: "LaporPak",
    aiEmoji: "📋",
    aiVibe: "Tegas dan membantu",
    aiWelcomeMessage: "Selamat datang! Saya siap membantu Anda.",
    customGreetings: ["Halo", "Hai", "Assalamualaikum"],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError("Nama desa harus diisi");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const metadata: VillageMetadata = {
        ai_personality: {
          name: formData.aiName,
          emoji: formData.aiEmoji,
          vibe: formData.aiVibe,
          welcome_message: formData.aiWelcomeMessage,
          custom_greetings: formData.customGreetings.filter((g) => g.trim()),
          tone: "santai dan familiar seperti tetangga",
        },
        is_ai_enabled: true,
      };

      const village = await createVillage({
        name: formData.name,
        level: formData.level,
        metadata,
      });

      router.push(`/admin/villages/${village.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create village");
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Back Link */}
        <Link
          href="/admin/villages"
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Kembali ke daftar desa
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-sky-100 text-2xl">
              <Building2 />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Tambah Desa Baru</h1>
              <p className="text-slate-500">Daftarkan desa baru ke dalam sistem</p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="mb-2 size-5" />
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
              <Building2 size={20} className="text-sky-600" />
              Informasi Dasar
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nama Desa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="Contoh: Desa Sukamaju"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Level Administratif
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData((prev) => ({ ...prev, level: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="village">Desa</option>
                  <option value="district">Kecamatan</option>
                  <option value="city">Kota</option>
                  <option value="province">Provinsi</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI Configuration */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
              <Bot size={20} className="text-sky-600" />
              Konfigurasi AI Assistant
            </h2>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nama AI
                  </label>
                  <input
                    type="text"
                    value={formData.aiName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, aiName: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder="Nama AI"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={formData.aiEmoji}
                    onChange={(e) => setFormData((prev) => ({ ...prev, aiEmoji: e.target.value }))}
                    className="h-10 w-20 rounded-lg border border-slate-200 px-3 text-center text-2xl"
                    placeholder="📋"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Vibe
                </label>
                <input
                  type="text"
                  value={formData.aiVibe}
                  onChange={(e) => setFormData((prev) => ({ ...prev, aiVibe: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="Deskripsi karakter AI"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Pesan Sambutan
                </label>
                <textarea
                  value={formData.aiWelcomeMessage}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, aiWelcomeMessage: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="Pesan selamat datang untuk warga"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Ucapan Sambutan Kustom
                </label>
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
                          type="button"
                          onClick={() => removeGreeting(index)}
                          className="flex size-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addGreeting}
                  className="mt-2 text-sm text-sky-600 hover:text-sky-700"
                >
                  + Tambah ucapan
                </button>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/admin/villages">
              <Button type="button" variant="outline">
                Batal
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Buat Desa
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
