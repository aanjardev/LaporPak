import assert from "node:assert/strict";
import test from "node:test";
import { getReportById, getReports, updateReportStatus } from "../lib/reports.ts";

test("mock daftar dan detail mengikuti alur laporan", async () => {
  const firstPage = await getReports({ page: 1, page_size: 20 });
  const secondPage = await getReports({ page: 2, page_size: 20 });
  assert.equal(firstPage.items.length, 20);
  assert.equal(secondPage.items.length, 7);
  assert.equal(firstPage.total, 27);
  assert.deepEqual(Object.keys(firstPage.items[0]).sort(), [
    "category", "created_at", "description", "id", "location",
    "status", "ticket_number", "urgency",
  ]);

  const filtered = await getReports({
    page: 1,
    page_size: 20,
    status: "rejected",
    urgency: "low",
    category: "administration",
    search: "LP-2026-0006",
  });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0].ticket_number, "LP-2026-0006");

  const urgent = await getReports({ page: 1, page_size: 20, urgency: "critical" });
  assert.equal(urgent.total, 4);
  assert.ok(urgent.items.every((item) => item.urgency === "critical"));
  assert.equal((await getReports({ page: 2, page_size: 20, urgency: "critical" })).items.length, 0);

  const detail = await getReportById(firstPage.items[0].id);
  assert.equal(detail?.ticket_number, firstPage.items[0].ticket_number);
  assert.equal(detail?.status_history[0].new_status, "pending_verification");
  assert.equal(await getReportById("unknown"), null);
});

test("mode API tidak mengambil data nyata sebelum otorisasi FastAPI tersedia", async () => {
  const oldSource = process.env.REPORTS_DATA_SOURCE;
  const oldFetch = globalThis.fetch;
  let fetched = false;
  try {
    process.env.REPORTS_DATA_SOURCE = "api";
    globalThis.fetch = async () => {
      fetched = true;
      throw new Error("API should not be called");
    };
    await assert.rejects(getReports({ page: 2, page_size: 20, urgency: "high" }));
    await assert.rejects(getReportById("72af1a52-7016-48c7-aacc-000000000001"));
    assert.equal(fetched, false);
  } finally {
    if (oldSource === undefined) delete process.env.REPORTS_DATA_SOURCE;
    else process.env.REPORTS_DATA_SOURCE = oldSource;
    globalThis.fetch = oldFetch;
  }
});

test("fixture detail mencakup kondisi data panjang dan kosong", async () => {
  const pending = await getReportById("72af1a52-7016-48c7-aacc-000000000001");
  const resolved = await getReportById("72af1a52-7016-48c7-aacc-000000000005");
  assert.ok(pending.description.length > 350);
  assert.equal(pending.summary, null);
  assert.equal(pending.location.latitude, null);
  assert.equal(pending.location.longitude, null);
  assert.ok(pending.location.text);
  assert.equal(resolved.status_history.length, 5);
  assert.ok(resolved.status_history.every((entry) => entry.notes.length > 100));
});

test("simulasi keputusan mengikuti response PATCH tanpa mengubah fixture", async () => {
  const id = "72af1a52-7016-48c7-aacc-000000000001";
  const response = await updateReportStatus(id, { status: "verified", reason: "Sudah diperiksa petugas." });
  assert.deepEqual(Object.keys(response).sort(), ["id", "status", "ticket_number", "updated_at"]);
  assert.equal(response.status, "verified");
  assert.equal((await getReportById(id)).status, "pending_verification");
  assert.equal((await updateReportStatus(id, { status: "rejected", reason: "Lokasi tidak sesuai." })).status, "rejected");
  await assert.rejects(updateReportStatus(id, { status: "verified", reason: "   " }));
  await assert.rejects(updateReportStatus("unknown", { status: "verified", reason: "Alasan" }));
  await assert.rejects(updateReportStatus("72af1a52-7016-48c7-aacc-000000000002", { status: "rejected", reason: "Alasan" }));
});

test("skenario gagal dan mode API menolak mutasi mock", async () => {
  const id = "72af1a52-7016-48c7-aacc-000000000001";
  const oldNodeEnv = process.env.NODE_ENV;
  const oldScenario = process.env.REPORTS_MOCK_MUTATION_SCENARIO;
  const oldSource = process.env.REPORTS_DATA_SOURCE;
  try {
    process.env.NODE_ENV = "development";
    process.env.REPORTS_MOCK_MUTATION_SCENARIO = "error";
    await assert.rejects(updateReportStatus(id, { status: "verified", reason: "Alasan" }));
    process.env.REPORTS_DATA_SOURCE = "api";
    await assert.rejects(updateReportStatus(id, { status: "verified", reason: "Alasan" }));
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    if (oldScenario === undefined) delete process.env.REPORTS_MOCK_MUTATION_SCENARIO;
    else process.env.REPORTS_MOCK_MUTATION_SCENARIO = oldScenario;
    if (oldSource === undefined) delete process.env.REPORTS_DATA_SOURCE;
    else process.env.REPORTS_DATA_SOURCE = oldSource;
  }
});

test("skenario lambat tetap mengembalikan keputusan tanpa mengubah fixture", async () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldScenario = process.env.REPORTS_MOCK_MUTATION_SCENARIO;
  try {
    process.env.NODE_ENV = "development";
    process.env.REPORTS_MOCK_MUTATION_SCENARIO = "slow";
    const id = "72af1a52-7016-48c7-aacc-000000000001";
    const response = await updateReportStatus(id, { status: "rejected", reason: "Informasi perlu diperbaiki." });
    assert.equal(response.status, "rejected");
    assert.equal((await getReportById(id)).status, "pending_verification");
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    if (oldScenario === undefined) delete process.env.REPORTS_MOCK_MUTATION_SCENARIO;
    else process.env.REPORTS_MOCK_MUTATION_SCENARIO = oldScenario;
  }
});
