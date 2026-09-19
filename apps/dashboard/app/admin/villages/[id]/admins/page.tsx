"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Loader2,
  AlertCircle,
  UserPlus,
  Shield,
  Crown,
  MoreHorizontal,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VillageNav } from "@/components/village-selector";
import {
  getVillage,
  listVillageAdmins,
  type VillageDetail,
} from "@/lib/villages";
import { createInvitation, type AdminInvitation } from "@/lib/admin";
import { cn } from "@/lib/utils";

interface AdminsPageProps {
  params: Promise<{ id: string }>;
}

interface AdminInfo {
  id: string;
  display_name?: string;
  role: string;
  is_active: boolean;
  assigned_at: string;
}

export default function VillageAdminsPage({ params }: AdminsPageProps) {
  const [villageId, setVillageId] = useState<string | null>(null);
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setVillageId(p.id));
  }, [params]);

  useEffect(() => {
    if (!villageId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [villageData, adminList] = await Promise.all([
          getVillage(villageId),
          listVillageAdmins(villageId),
        ]);
        setVillage(villageData);
        setAdmins(adminList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [villageId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!villageId || !inviteEmail.trim()) return;

    try {
      setInviteLoading(true);
      setError(null);
      setSuccess(null);

      await createInvitation({
        email: inviteEmail.trim(),
        role: "village_admin",
        village_id: villageId,
      });

      setSuccess(`Undangan terkirim ke ${inviteEmail}`);
      setInviteEmail("");
      setShowInviteModal(false);

      // Refresh admin list
      const adminList = await listVillageAdmins(villageId);
      setAdmins(adminList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "system_admin") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
          <Crown size={12} />
          System Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
        <Shield size={12} />
        Village Admin
      </span>
    );
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
      <div className="mx-auto max-w-4xl px-4 py-8">
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
              <Users />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Admin Desa</h1>
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
            <p>{success}</p>
          </div>
        )}

        {/* Invite Button */}
        <div className="mb-6 flex justify-end">
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus size={16} />
            Undang Admin Baru
          </Button>
        </div>

        {/* Admin List */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-950">
              Daftar Admin ({admins.length})
            </h2>
          </div>

          {admins.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="mx-auto size-12 text-slate-300" />
              <h3 className="mt-4 font-medium text-slate-950">Belum ada admin</h3>
              <p className="mt-1 text-sm text-slate-500">
                Undang admin baru untuk mengelola desa ini
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-full bg-slate-100">
                      <span className="text-lg font-medium text-slate-600">
                        {(admin.display_name || "A")[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-950">
                        {admin.display_name || "Admin"}
                      </p>
                      <p className="text-sm text-slate-500">
                        Ditambahkan:{" "}
                        {new Date(admin.assigned_at).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getRoleBadge(admin.role)}
                    <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <>
            <div
              className="fixed inset-0 z-10 bg-black/50"
              onClick={() => setShowInviteModal(false)}
            />
            <div className="fixed left-1/2 top-1/2 z-20 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-950">
                Undang Admin Baru
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Kirim undangan ke email untuk menjadi admin {village?.name}
              </p>

              <form onSubmit={handleInvite} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@contoh.com"
                      className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowInviteModal(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={inviteLoading}>
                    {inviteLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Mail size={16} />
                    )}
                    Kirim Undangan
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
