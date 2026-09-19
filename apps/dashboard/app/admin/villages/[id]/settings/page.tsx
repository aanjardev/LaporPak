"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  MapPin,
  Phone,
  Mail,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VillageNav } from "@/components/village-selector";
import {
  getVillage,
  updateVillage,
  type VillageDetail,
} from "@/lib/villages";

interface SettingsPageProps {
  params: Promise<{ id: string }>;
}

export default function VillageSettingsPage({ params }: SettingsPageProps) {
  const [villageId, setVillageId] = useState<string | null>(null);
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
    primaryColor: "#0ea5e9",
    logoUrl: "",
  });

  useEffect(() => {
    params.then((p) => setVillageId(p.id));
  }, [params]);

  useEffect(() => {
    if (!villageId) return;

    async function fetchVillage() {
      try {
        setLoading(true);
        const data = await getVillage(villageId);
        setVillage(data);

        setFormData({
          name: data.name,
          contactPhone: data.metadata?.contact_phone || "",
          contactEmail: data.metadata?.contact_email || "",
          address: data.metadata?.address || "",
          primaryColor: data.metadata?.primary_color || "#0ea5e9",
          logoUrl: data.metadata?.logo_url || "",
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
    if (!villageId) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await updateVillage(villageId, {
        name: formData.name,
        metadata: {
          ...village?.metadata,
          contact_phone: formData.contactPhone || undefined,
          contact_email: formData.contactEmail || undefined,
          address: formData.address || undefined,
          primary_color: formData.primaryColor || undefined,
          logo_url: formData.logoUrl || undefined,
        },
      });

      setSuccess("Pengaturan berhasil disimpan!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
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
            <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              <Building2 />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Pengaturan Desa</h1>
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

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
              <Building2 size={20} className="text-sky-600" />
              Informasi Dasar
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nama Desa
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Alamat
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="Alamat lengkap desa"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
              <Phone size={20} className="text-sky-600" />
              Informasi Kontak
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nomor Telepon
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder="+62 xxx xxxx xxxx"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder="desa@email.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
              <MapPin size={20} className="text-sky-600" />
              Branding
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Warna Utama
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                    className="h-10 w-16 cursor-pointer rounded-lg border border-slate-200"
                  />
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                    className="h-10 w-32 rounded-lg border border-slate-200 px-3 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="https://example.com/logo.png"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Link ke gambar logo desa
                </p>
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
