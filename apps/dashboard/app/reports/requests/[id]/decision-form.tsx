"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  requestStatusLabels,
  type ServiceRequest,
  type ServiceRequestDecision,
  type ServiceRequestDecisionStatus,
} from "@/lib/service-request-types";
import { saveRequestDecision } from "./actions";

function dateLabel(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

const decisionErrors: Record<number, string> = {
  401: "Sesi petugas telah berakhir. Masuk kembali sebelum mencoba lagi.",
  403: "Akun ini tidak memiliki izin untuk memutuskan pengajuan tersebut.",
  404: "Pengajuan tidak ditemukan. Muat ulang antrean sebelum mencoba lagi.",
  409: "Status pengajuan telah berubah atau keputusan bertentangan. Muat ulang detail sebelum mencoba lagi.",
  422: "Pilihan atau alasan tidak valid. Periksa isian dan coba lagi.",
  503: "Layanan pengajuan sedang bermasalah. Alasan tetap tersimpan agar dapat dicoba lagi.",
};

const decisionLabels: Record<ServiceRequestDecisionStatus, string> = {
  approved: "Setujui",
  rejected: "Tolak",
  completed: "Tandai selesai",
};

export function RequestDetailView({ initialRequest }: { initialRequest: ServiceRequest }) {
  const router = useRouter();
  const request = initialRequest;
  const [decision, setDecision] = useState<ServiceRequestDecision["status"]>(
    initialRequest.allowed_transitions[0] ?? "approved",
  );
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const normalized = reason.trim();
    if (!normalized || normalized.length > 1000) {
      setMessage({ kind: "error", text: "Alasan wajib diisi, maksimal 1000 karakter." });
      return;
    }
    submitting.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await saveRequestDecision(request.id, {
        status: decision,
        reason: normalized,
      });
      if (result.ok) {
        setReason("");
        setMessage({
          kind: "success",
          text: `Keputusan berhasil disimpan: ${requestStatusLabels[result.item.status]}.`,
        });
        router.refresh();
      } else {
        setMessage({
          kind: "error",
          text: decisionErrors[result.status] ?? "Keputusan belum tersimpan. Silakan coba lagi.",
        });
      }
    } catch {
      setMessage({ kind: "error", text: "Keputusan belum tersimpan. Silakan coba lagi." });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const fields = [
    ["Nama pemohon", request.applicant_name],
    ["Alamat domisili", request.domicile_address],
    ["Lama domisili", request.domicile_duration],
    ["Tujuan permohonan", request.purpose],
    ["ID unit administratif", request.administrative_unit_id],
  ];
  const decisions = request.allowed_transitions.map((value) => ({
    value,
    label: decisionLabels[value],
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600">Nomor pengajuan</p>
            <h2 className="break-all text-2xl font-bold tracking-tight">{request.ticket_number}</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
            {requestStatusLabels[request.status]}
          </span>
        </div>
        <dl className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="min-w-0 border-t border-slate-100 pt-3">
              <dt className="text-sm font-medium text-slate-600">{label}</dt>
              <dd className="mt-1 break-words text-sm leading-6 text-slate-950">{value}</dd>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-3">
            <dt className="text-sm font-medium text-slate-600">Diajukan</dt>
            <dd className="mt-1 text-sm">{dateLabel(request.created_at)}</dd>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <dt className="text-sm font-medium text-slate-600">Diperbarui</dt>
            <dd className="mt-1 text-sm">{dateLabel(request.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Riwayat keputusan</h2>
        {request.status_history.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">Belum ada riwayat keputusan.</p>
        ) : (
          <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-5">
            {request.status_history.map((entry, index) => (
              <li key={`${entry.created_at}-${index}`}>
                <p className="font-semibold">{requestStatusLabels[entry.new_status]}</p>
                <p className="text-xs text-slate-500">
                  {dateLabel(entry.created_at)} · {entry.actor_display_name ?? (entry.actor_type === "system" ? "Sistem" : "Petugas desa")}
                </p>
                {entry.reason && <p className="mt-1 text-sm text-slate-700">{entry.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {decisions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Keputusan petugas</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Keputusan akan disimpan sebagai status resmi beserta alasan petugas.
          </p>
          <form onSubmit={submit} className="mt-5 space-y-5">
            <fieldset disabled={pending} className="space-y-3">
              <legend className="text-sm font-semibold">Pilih keputusan</legend>
              <div className="flex flex-wrap gap-4">
                {decisions.map((option) => (
                  <label key={option.value} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="decision"
                      value={option.value}
                      checked={decision === option.value}
                      onChange={() => setDecision(option.value)}
                      className="size-4 accent-sky-800"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="decision-reason" className="block text-sm font-semibold">
                Alasan keputusan
              </label>
              <textarea
                id="decision-reason"
                required
                maxLength={1000}
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={pending}
                className="mt-2 w-full min-w-0 rounded-lg border border-slate-300 p-3 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              />
            </div>
            {message?.kind === "error" && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                {message.text}
              </p>
            )}
            {pending && <p role="status" className="text-sm text-slate-600">Menyimpan keputusan…</p>}
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-lg bg-sky-800 px-5 text-sm font-semibold text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Menyimpan…" : "Simpan keputusan"}
            </button>
          </form>
        </section>
      )}
      {message?.kind === "success" && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          {message.text}
        </p>
      )}
    </div>
  );
}
