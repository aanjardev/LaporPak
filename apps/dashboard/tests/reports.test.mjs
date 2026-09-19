import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { getReportAttachment, getReportById, getReports, ReportApiError, updateReportStatus } from "../lib/reports.ts";
import { reportStatusActions } from "../lib/report-status-actions.ts";

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
  assert.deepEqual(detail?.responsible_unit, {
    id: "b5e83fd3-71e2-4ec3-b432-b7e970b57c6a",
    name: "Unit Infrastruktur Desa",
  });
  assert.deepEqual(detail?.attachments, [
    { id: "9a0d1245-4e4e-40be-bbba-000000000001", file_name: "foto-jalan-rusak.png", mime_type: "image/png", file_size: 1024, created_at: "2026-09-16T08:30:00.000Z" },
    { id: "9a0d1245-4e4e-40be-bbba-000000000002", file_name: "foto-kondisi-sekitar.png", mime_type: "image/png", file_size: 2048, created_at: "2026-09-16T08:30:00.000Z" },
  ]);
  assert.equal(await getReportById("unknown"), null);
});

test("lampiran mock hanya ada pada laporan pemiliknya", async () => {
  const reportId = "72af1a52-7016-48c7-aacc-000000000001";
  const attachmentId = "9a0d1245-4e4e-40be-bbba-000000000001";
  const image = await getReportAttachment(reportId, attachmentId, "test-token");
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("Content-Type"), "image/png");
  const imageBytes = Buffer.from(await image.arrayBuffer());
  assert.equal(imageBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(imageBytes.readUInt32BE(16), 160);
  assert.equal(imageBytes.readUInt32BE(20), 120);
  assert.equal((await getReportAttachment("72af1a52-7016-48c7-aacc-000000000002", attachmentId, "test-token")).status, 404);
  assert.equal((await getReportAttachment(reportId, "9a0d1245-4e4e-40be-bbba-000000000003", "test-token")).status, 404);
});

test("mode API meneruskan token foto dan membuang path Storage dari detail", async () => {
  const previousSource = process.env.REPORTS_DATA_SOURCE;
  const previousUrl = process.env.NEXT_PUBLIC_API_URL;
  const reportId = "72af1a52-7016-48c7-aacc-000000000001";
  const attachmentId = "9a0d1245-4e4e-40be-bbba-000000000001";
  let attachmentStatus = 200;
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, "Bearer test-token");
    if (request.url === `/api/v1/reports/${reportId}`) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ attachments: [{ id: attachmentId, file_name: "foto.png", mime_type: "image/png", file_size: 4096, created_at: "2026-09-19T00:00:00Z", storage_path: "internal/private/path", storage_bucket: "report-attachments" }] }));
      return;
    }
    assert.equal(request.url, `/api/v1/reports/${reportId}/attachments/${attachmentId}`);
    if (attachmentStatus !== 200) {
      response.writeHead(attachmentStatus);
      response.end();
      return;
    }
    response.setHeader("Content-Type", "image/png");
    response.end(Buffer.from([137, 80, 78, 71]));
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.REPORTS_DATA_SOURCE = "api";
    process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${server.address().port}`;
    const detail = await getReportById(reportId, "test-token");
    assert.deepEqual(detail.attachments, [{ id: attachmentId, file_name: "foto.png", mime_type: "image/png", file_size: 4096, created_at: "2026-09-19T00:00:00Z" }]);
    const image = await getReportAttachment(reportId, attachmentId, "test-token");
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("Content-Type"), "image/png");
    for (const status of [401, 403, 404, 503]) {
      attachmentStatus = status;
      assert.equal((await getReportAttachment(reportId, attachmentId, "test-token")).status, status);
    }
  } finally {
    if (previousSource === undefined) delete process.env.REPORTS_DATA_SOURCE;
    else process.env.REPORTS_DATA_SOURCE = previousSource;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previousUrl;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("mode API meneruskan filter dan access token ke FastAPI", async () => {
  const oldSource = process.env.REPORTS_DATA_SOURCE;
  const oldFetch = globalThis.fetch;
  const calls = [];
  try {
    process.env.REPORTS_DATA_SOURCE = "api";
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ items: [{
        id: "72af1a52-7016-48c7-aacc-000000000021",
        ticket_number: "LP-2026-0021",
        category: "infrastructure",
        description: "Jalan desa rusak.",
        location: { text: "RT 03", latitude: null, longitude: null },
        urgency: "high",
        status: "pending_verification",
        created_at: "2026-09-17T00:00:00Z",
      }], page: 2, page_size: 20, total: 21 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const result = await getReports({ page: 2, page_size: 20, urgency: "high" }, "supabase-token");
    assert.match(calls[0].url, /page=2/);
    assert.match(calls[0].url, /urgency=high/);
    assert.equal(calls[0].init.headers.Authorization, "Bearer supabase-token");
    assert.equal(result.page, 2);
    assert.equal(result.total, 21);
    assert.equal(result.items[0].ticket_number, "LP-2026-0021");
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

test("aksi status mengikuti transisi kontrak dan mock dapat melanjutkan status di halaman terbuka", async () => {
  assert.deepEqual(reportStatusActions.pending_verification, ["verified", "rejected"]);
  assert.deepEqual(reportStatusActions.verified, ["in_progress"]);
  assert.deepEqual(reportStatusActions.in_progress, ["forwarded", "resolved"]);
  assert.deepEqual(reportStatusActions.forwarded, ["resolved"]);
  assert.deepEqual(reportStatusActions.resolved, []);
  assert.deepEqual(reportStatusActions.rejected, []);

  const id = "72af1a52-7016-48c7-aacc-000000000001";
  let status = "pending_verification";
  for (const next of ["verified", "in_progress", "forwarded", "resolved"]) {
    const result = await updateReportStatus(id, { status: next, reason: "Catatan tindakan petugas." }, undefined, status);
    assert.equal(result.status, next);
    status = next;
  }
  assert.equal((await getReportById(id)).status, "pending_verification");
  await assert.rejects(updateReportStatus(id, { status: "rejected", reason: "Tidak sah" }, undefined, status));
  await assert.rejects(updateReportStatus(id, { status: "resolved", reason: "Tidak sah" }));
});

test("skenario gagal mock dan mode API mengirim PATCH", async () => {
  const id = "72af1a52-7016-48c7-aacc-000000000001";
  const oldNodeEnv = process.env.NODE_ENV;
  const oldScenario = process.env.REPORTS_MOCK_MUTATION_SCENARIO;
  const oldSource = process.env.REPORTS_DATA_SOURCE;
  try {
    process.env.NODE_ENV = "development";
    process.env.REPORTS_MOCK_MUTATION_SCENARIO = "error";
    await assert.rejects(updateReportStatus(id, { status: "verified", reason: "Alasan" }));
    process.env.REPORTS_DATA_SOURCE = "api";
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      assert.equal(init.method, "PATCH");
      assert.equal(init.headers.Authorization, "Bearer supabase-token");
      assert.deepEqual(JSON.parse(init.body), { status: "verified", reason: "Alasan" });
      return new Response(JSON.stringify({ id, ticket_number: "LP-2026-0001", status: "verified", updated_at: "2026-09-17T00:00:00Z" }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    assert.equal((await updateReportStatus(id, { status: "verified", reason: "Alasan" }, "supabase-token")).status, "verified");
    globalThis.fetch = oldFetch;
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

test("mode API meneruskan respons gagal GET dan PATCH melalui HTTP", async () => {
  const oldSource = process.env.REPORTS_DATA_SOURCE;
  const oldUrl = process.env.NEXT_PUBLIC_API_URL;
  let responseStatus = 401;
  const server = createServer(async (request, response) => {
    assert.equal(request.headers.authorization, "Bearer test-token");
    response.writeHead(responseStatus, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: { code: "TEST_ERROR", message: "Detail internal API" } }));
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    process.env.REPORTS_DATA_SOURCE = "api";
    process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${address.port}`;
    const query = { page: 1, page_size: 20 };
    const id = "72af1a52-7016-48c7-aacc-000000000001";

    for (const status of [401, 403, 500]) {
      responseStatus = status;
      await assert.rejects(getReports(query, "test-token"), (error) => error instanceof ReportApiError && error.status === status);
    }
    responseStatus = 404;
    assert.equal(await getReportById(id, "test-token"), null);

    for (const status of [401, 403, 404, 409, 500]) {
      responseStatus = status;
      await assert.rejects(
        updateReportStatus(id, { status: "verified", reason: "Sudah diperiksa." }, "test-token"),
        (error) => error instanceof ReportApiError && error.status === status,
      );
    }
  } finally {
    if (oldSource === undefined) delete process.env.REPORTS_DATA_SOURCE;
    else process.env.REPORTS_DATA_SOURCE = oldSource;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = oldUrl;
    await new Promise((resolve) => server.close(resolve));
  }
});
