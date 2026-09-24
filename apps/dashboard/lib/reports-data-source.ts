export function reportsDataSource(): "api" | "mock" {
  const source = process.env.REPORTS_DATA_SOURCE;
  if (source === "api") return source;
  const production = process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview");
  if (source === "mock" && !production) return source;
  throw new Error("Sumber data laporan belum dikonfigurasi dengan benar.");
}
