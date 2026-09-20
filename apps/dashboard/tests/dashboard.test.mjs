import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DashboardApiError, attentionHref, dashboardDays, getVillageDashboard, mockDashboard, parseDashboard } from "../lib/village-dashboard.ts";

function setEnv(t, key, value) {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
}

const village = { id: "b0000000-0000-4000-8000-000000000001", name: "Desa Simulasi" };
const now = new Date("2026-09-19T18:00:00Z");

test("fixture 7/30/90 hari memakai batas WIB, nol valid, dan total sesuai seri", () => {
  for (const days of [7, 30, 90]) {
    for (const empty of [false, true]) {
      const data = mockDashboard(village, days, now, empty);
      assert.equal(data.period.end_date, "2026-09-20");
      assert.equal(data.daily.length, days);
      assert.deepEqual(parseDashboard(data, village.id, days), data);
      if (empty) assert.equal(data.kpis.needs_attention, 0);
    }
  }
  assert.equal(dashboardDays("7"), 7);
  assert.equal(dashboardDays("90"), 90);
  for (const input of [undefined, ["7"], "0", "31", "NaN"]) assert.equal(dashboardDays(input), 30);
});

test("respons salah desa, seri bolong, status hilang dan total tidak konsisten ditolak", () => {
  const base = mockDashboard(village, 7, now);
  const mutations = [
    (d) => { d.village.id = "other"; },
    (d) => { delete d.report_status_counts.verified; },
    (d) => { d.daily[1].date = d.daily[0].date; },
    (d) => { d.kpis.reports_created += 1; },
    (d) => { d.kpis.needs_attention = 900; },
    (d) => { d.knowledge.ready = -1; },
    (d) => { d.attention[0].status = "resolved"; },
    (d) => { d.attention[0].kind = "constructor"; },
    (d) => { d.attention[1] = d.attention[0]; },
  ];
  for (const change of mutations) {
    const data = structuredClone(base);
    change(data);
    assert.throws(() => parseDashboard(data, village.id, 7), DashboardApiError);
  }
});

test("tautan antrean memakai route lokal per jenis", () => {
  const items = mockDashboard(village, 7, now).attention;
  assert.equal(attentionHref(items[0]), `/reports/${items[0].id}`);
  assert.equal(attentionHref(items[1]), `/reports/requests/${items[1].id}`);
  assert.equal(attentionHref(items[2]), `/reports/settings/knowledge/${items[2].id}`);
});

test("API meneruskan token dan periode, no-store, tanpa fallback mock", async (t) => {
  setEnv(t, "REPORTS_DATA_SOURCE", "api");
  setEnv(t, "NEXT_PUBLIC_API_URL", "http://localhost:8000");
  let status = 200;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), `http://localhost:8000/api/v1/villages/${village.id}/dashboard?days=30`);
    assert.equal(options.headers.Authorization, "Bearer test-only-token");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(status === 200 ? mockDashboard(village, 30, now) : { error: { code: status === 403 ? "VILLAGE_INACTIVE" : "TEST_ERROR", message: "internal private information" } }, { status });
  });
  assert.equal((await getVillageDashboard(village, 30, "test-only-token")).period.days, 30);
  for (status of [401, 403, 404, 422, 503]) {
    await assert.rejects(getVillageDashboard(village, 30, "test-only-token", "empty"), (e) => e.status === status && !e.message.includes("private"));
  }
  status = 403;
  await assert.rejects(getVillageDashboard(village, 30, "test-only-token"), (e) => e.code === "VILLAGE_INACTIVE");
});

test("panggilan jaringan gagal dan payload rusak tidak dibaca sebagai nol", async (t) => {
  setEnv(t, "REPORTS_DATA_SOURCE", "api");
  setEnv(t, "NEXT_PUBLIC_API_URL", "http://localhost:8000");
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("secret network detail"); });
  await assert.rejects(getVillageDashboard(village, 7, "token"), (e) => e.status === 503 && !e.message.includes("secret"));
  mock.mock.mockImplementation(async () => Response.json({}));
  await assert.rejects(getVillageDashboard(village, 7, "token"), (e) => e.status === 502);
});

test("mock development tidak memanggil API dan dinonaktifkan pada production", async (t) => {
  setEnv(t, "REPORTS_DATA_SOURCE", "mock");
  setEnv(t, "NODE_ENV", "development");
  t.mock.method(globalThis, "fetch", () => { throw new Error("must not fetch"); });
  assert.equal((await getVillageDashboard(village, 30, "token", "empty")).kpis.reports_created, 0);
  await assert.rejects(getVillageDashboard(village, 30, "token", "error"), (e) => e.status === 503);
  setEnv(t, "NODE_ENV", "production");
  await assert.rejects(getVillageDashboard(village, 30, "token"), (e) => e.status === 503);
});

test("beranda memilih dashboard desa dan mempertahankan portal Super Admin", () => {
  const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../app/reports/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(home, /admin.role === "system_admin" \? "\/admin"/);
  assert.match(home, /admin.villages.length \? "\/reports\/dashboard"/);
  assert.match(dashboard, /error\.code === "VILLAGE_INACTIVE"/);
  assert.match(dashboard, /error\.status === 422/);
});
