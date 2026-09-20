import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, ClipboardList, Clock3, FileText } from "lucide-react";
import { statusLabels } from "@/components/report-display";
import { reportStatuses } from "@/lib/reports";
import { requestStatuses } from "@/lib/service-request-types";
import { requestStatusLabels } from "@/lib/service-request-types";
import { attentionHref, type VillageDashboard } from "@/lib/village-dashboard";

const number = new Intl.NumberFormat("id-ID");
const date = (value: string) => new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
const attentionLabels = { pending_verification: "Perlu verifikasi", pending_review: "Perlu peninjauan", draft: "Perlu review sumber", failed: "Pemrosesan gagal" };
const moduleLabels = { report: "REPORT", request: "REQUEST", knowledge: "ASK" };

export function VillageDashboardView({ data, isMock }: { data: VillageDashboard; isMock: boolean }) {
  const { kpis } = data;
  const metrics = [
    { label: "Laporan masuk", value: kpis.reports_created, note: `${data.period.days} hari terakhir`, icon: ClipboardList },
    { label: "Pengajuan masuk", value: kpis.requests_created, note: `${data.period.days} hari terakhir`, icon: FileText },
    { label: "Butuh tindakan", value: kpis.needs_attention, note: "Antrean saat ini · semua periode", icon: Clock3 },
    { label: "Sumber ASK siap", value: kpis.ask_ready, note: "Aktif, disetujui, dan siap digunakan", icon: BookOpenCheck },
  ];
  return <>
    <section aria-label="Ringkasan layanan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, note, icon: Icon }) => <div key={label} className="ui-panel p-5">
        <div className="flex items-start justify-between gap-3"><h2 className="text-sm font-medium text-muted-foreground">{label}</h2><Icon aria-hidden="true" size={19} className="shrink-0 text-secondary" /></div>
        <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-brand">{number.format(value)}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p><div className="mt-4 h-0.5 w-8 bg-primary" />
      </div>)}
    </section>
    <div className="grid min-w-0 gap-6 xl:grid-cols-3">
      <section className="ui-panel min-w-0 p-4 sm:p-6 xl:col-span-2" aria-labelledby="trend-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="trend-title" className="font-semibold">Layanan masuk</h2><p className="mt-1 text-xs text-muted-foreground">{date(`${data.period.start_date}T00:00:00+07:00`)} – {date(`${data.period.end_date}T00:00:00+07:00`)} · WIB</p></div><div className="flex gap-4 text-xs"><span className="flex items-center gap-2"><span className="h-3 w-3 bg-secondary" />REPORT</span><span className="flex items-center gap-2"><span className="h-3 w-3 border border-brand/20 bg-primary" />REQUEST</span></div></div>
        <ServiceChart data={data} />
        <p className="text-xs leading-5 text-muted-foreground">{number.format(kpis.reports_created)} laporan dan {number.format(kpis.requests_created)} pengajuan diterima. Hari ini dihitung sampai waktu pembaruan.</p>
        <details className="mt-4 border-t border-border pt-2"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand">Lihat angka harian</summary>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border"><table className="w-full text-left text-xs tabular-nums"><caption className="sr-only">Jumlah REPORT dan REQUEST setiap hari dalam WIB</caption><thead className="sticky top-0 bg-muted"><tr><th scope="col" className="p-3">Tanggal</th><th scope="col" className="p-3 text-right">REPORT</th><th scope="col" className="p-3 text-right">REQUEST</th></tr></thead><tbody>{data.daily.map((d) => <tr key={d.date} className="border-t border-border"><th scope="row" className="p-3 font-normal">{date(`${d.date}T00:00:00+07:00`)}</th><td className="p-3 text-right">{d.reports}</td><td className="p-3 text-right">{d.requests}</td></tr>)}</tbody></table></div>
        </details>
      </section>
      <section className="ui-panel min-w-0 overflow-hidden" aria-labelledby="attention-title">
        <div className="border-b border-border px-5 py-4"><h2 id="attention-title" className="font-semibold">Butuh tindakan <span className="ml-2 text-sm font-normal text-muted-foreground">{number.format(kpis.needs_attention)}</span></h2><p className="mt-1 text-xs text-muted-foreground">Terbaru dari seluruh periode</p></div>
        {isMock && <p className="border-b border-border bg-accent px-5 py-3 text-xs leading-5">Antrean contoh. Detail simulasi tidak tersedia.</p>}
        {data.attention.length ? <ul className="divide-y divide-border">{data.attention.map((item) => {
          const content = <><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{moduleLabels[item.kind]}</span><time className="text-xs text-muted-foreground" dateTime={item.created_at}>{date(item.created_at)}</time></div><p className="mt-1 break-words text-sm font-semibold text-brand">{item.label}</p><p className="mt-1 text-xs text-muted-foreground">{attentionLabels[item.status]}</p></>;
          return <li key={`${item.kind}:${item.id}`}>{isMock ? <div className="px-5 py-4">{content}</div> : <Link className="block px-5 py-4 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring" href={attentionHref(item)} aria-label={`Buka ${item.label}: ${attentionLabels[item.status]}`}>{content}</Link>}</li>;
        })}</ul> : <div className="px-5 py-12 text-sm leading-6 text-muted-foreground">Tidak ada antrean yang membutuhkan tindakan saat ini.</div>}
        {kpis.needs_attention > 8 && <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Menampilkan 8 terbaru. Buka halaman layanan untuk seluruh antrean.</p>}
      </section>
    </div>
    <section aria-labelledby="status-title"><div className="mb-4"><h2 id="status-title" className="text-lg font-semibold">Kondisi layanan saat ini</h2><p className="mt-1 text-xs text-muted-foreground">Seluruh periode · tidak mengikuti filter grafik</p></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <StatusPanel title="Laporan warga" href="/reports" rows={reportStatuses.map((status) => [statusLabels[status], data.report_status_counts[status]])} />
        <StatusPanel title="Pengajuan layanan" href="/reports/requests" rows={requestStatuses.map((status) => [requestStatusLabels[status], data.request_status_counts[status]])} />
        <StatusPanel title="Sumber ASK" href="/reports/knowledge" rows={[["Sumber aktif", data.knowledge.active], ["Siap digunakan", data.knowledge.ready], ["Draf aktif", data.knowledge.draft], ["Pemrosesan gagal", data.knowledge.failed], ["Menunggu / diproses", data.knowledge.processing]]} note="Sumber draf dapat sekaligus gagal diproses. Jumlah kategori tidak dijumlahkan sebagai total." />
      </div>
    </section>
  </>;
}

function StatusPanel({ title, href, rows, note }: { title: string; href: string; rows: [string, number][]; note?: string }) {
  return <div className="ui-panel p-5"><h3 className="font-semibold">{title}</h3><dl className="mt-4 divide-y divide-border">{rows.map(([label, count]) => <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{number.format(count)}</dd></div>)}</dl>{note && <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>}<Link href={href} aria-label={`Lihat semua: ${title}`} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand underline-offset-4 hover:underline">Lihat semua <ArrowUpRight aria-hidden="true" size={16} /></Link></div>;
}

function ServiceChart({ data }: { data: VillageDashboard }) {
  // ponytail: at most 90 daily points; 7-day groups keep bars legible at phone widths.
  const step = data.period.days === 90 ? 7 : data.period.days === 30 ? 3 : 1;
  const buckets = data.daily.filter((_, i) => i % step === 0).map((day, i) => ({
    date: day.date,
    reports: data.daily.slice(i * step, i * step + step).reduce((sum, d) => sum + d.reports, 0),
    requests: data.daily.slice(i * step, i * step + step).reduce((sum, d) => sum + d.requests, 0),
  }));
  const max = Math.max(1, ...buckets.flatMap((d) => [d.reports, d.requests]));
  const top = Math.ceil(max / 4) * 4;
  const groupWidth = 560 / buckets.length;
  return <figure className="my-5">
    <svg role="img" aria-labelledby="service-chart-title service-chart-desc" viewBox="0 0 640 270" className="block h-auto w-full">
      <title id="service-chart-title">REPORT dan REQUEST masuk</title><desc id="service-chart-desc">Grafik batang berkelompok. Batang kiri REPORT, kanan REQUEST. Angka harian tersedia pada tabel di bawah.</desc>
      {[0, 1, 2, 3, 4].map((tick) => <g key={tick}><line x1="42" y1={220 - tick * 48} x2="620" y2={220 - tick * 48} stroke="var(--color-border)" /><text x="32" y={224 - tick * 48} textAnchor="end" fill="var(--color-muted-foreground)" fontSize="12">{top * tick / 4}</text></g>)}
      {buckets.map((d, i) => <g key={d.date}><title>{`${date(`${d.date}T00:00:00+07:00`)}: ${d.reports} REPORT, ${d.requests} REQUEST`}</title><rect x={48 + i * groupWidth} y={220 - d.reports / top * 192} width={groupWidth * 0.32} height={d.reports / top * 192} fill="var(--color-secondary)" /><rect x={48 + i * groupWidth + groupWidth * 0.35} y={220 - d.requests / top * 192} width={groupWidth * 0.32} height={d.requests / top * 192} fill="var(--color-primary)" stroke="var(--color-brand)" strokeWidth="0.4" />{(i % 2 === 0 || i === buckets.length - 1) && <text x={48 + i * groupWidth + groupWidth * 0.32} y="246" textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="12">{d.date.slice(8)}/{d.date.slice(5, 7)}</text>}</g>)}
    </svg>
    <figcaption className="text-xs leading-5 text-muted-foreground">{step === 1 ? "Satu kelompok batang per hari." : `Satu kelompok batang per ${step} hari; kelompok terakhir dapat lebih pendek.`} {data.kpis.reports_created + data.kpis.requests_created === 0 && "Belum ada layanan masuk pada periode ini."}</figcaption>
  </figure>;
}
