import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth";
import {
  getServiceRequest,
  ServiceRequestApiError,
  type ServiceRequestStatus,
} from "@/lib/service-requests";

import { updateRequestAction } from "./actions";

const labels: Record<ServiceRequestStatus, string> = {
  pending_review: "Menunggu tinjauan",
  approved: "Disetujui",
  rejected: "Ditolak",
  completed: "Selesai",
};
const actions: Partial<Record<ServiceRequestStatus, ServiceRequestStatus[]>> = {
  pending_review: ["approved", "rejected"],
  approved: ["completed"],
};

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RequestDetail({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  await requireSignedIn(`/reports/requests/${id}`);
  let item;
  try {
    item = await getServiceRequest(id);
  } catch (error) {
    if (error instanceof ServiceRequestApiError && error.status === 404) notFound();
    if (error instanceof ServiceRequestApiError && error.status === 401) redirect("/login?reauth=1");
    if (error instanceof ServiceRequestApiError && error.status === 403) redirect("/access-denied");
    return <p role="alert">Detail pengajuan belum dapat dimuat.</p>;
  }
  const available = actions[item.status] ?? [];
  const action = updateRequestAction.bind(null, id);
  return <div className="mx-auto max-w-4xl space-y-6"><Link href="/reports/requests" className="text-sm font-semibold text-sky-800">← Daftar pengajuan</Link><header><p className="text-sm text-slate-600">{item.ticket_number}</p><h1 className="mt-1 text-3xl font-bold">{item.applicant_name}</h1><p className="mt-2 font-semibold">{labels[item.status]}</p></header>{query.saved === "1" && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900">Keputusan berhasil disimpan.</p>}{query.error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-900">Keputusan belum dapat disimpan.</p>}<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Alamat domisili</dt><dd className="mt-1">{item.domicile_address}</dd></div><div><dt className="text-xs text-slate-500">Lama tinggal</dt><dd className="mt-1">{item.domicile_duration}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-slate-500">Tujuan</dt><dd className="mt-1">{item.purpose}</dd></div></dl></section>{available.length > 0 && <form action={action} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Keputusan petugas</h2><select name="status" required className="min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="">Pilih keputusan</option>{available.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select><textarea name="reason" required maxLength={1000} placeholder="Alasan keputusan" className="min-h-28 w-full rounded-lg border border-slate-300 p-3" /><button className="min-h-11 rounded-lg bg-sky-800 px-5 font-semibold text-white">Simpan keputusan</button></form>}</div>;
}
