import assert from "node:assert/strict";
import { after, test } from "node:test";

import {
  getServiceRequestById,
  getServiceRequests,
  isRequestPreviewEnabled,
  simulateServiceRequestDecision,
} from "../lib/service-requests.ts";

const original = {
  NODE_ENV: process.env.NODE_ENV,
  REQUESTS_PREVIEW: process.env.REQUESTS_PREVIEW,
  REQUESTS_MOCK_SCENARIO: process.env.REQUESTS_MOCK_SCENARIO,
  REQUESTS_MOCK_MUTATION_SCENARIO: process.env.REQUESTS_MOCK_MUTATION_SCENARIO,
};
const originalFetch = global.fetch;

after(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = originalFetch;
});

function preview() {
  process.env.NODE_ENV = "development";
  process.env.REQUESTS_PREVIEW = "mock";
  delete process.env.REQUESTS_MOCK_SCENARIO;
  delete process.env.REQUESTS_MOCK_MUTATION_SCENARIO;
}

test("pratinjau hanya aktif dengan opt-in pada development", () => {
  preview();
  assert.equal(isRequestPreviewEnabled(), true);
  process.env.NODE_ENV = "production";
  assert.equal(isRequestPreviewEnabled(), false);
  process.env.NODE_ENV = "development";
  process.env.REQUESTS_PREVIEW = "off";
  assert.equal(isRequestPreviewEnabled(), false);
});

test("daftar paginasi dan detail mengikuti schema backend tanpa memanggil API", async () => {
  preview();
  global.fetch = () => { throw new Error("API should not be called"); };
  const first = await getServiceRequests(1);
  const second = await getServiceRequests(2);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 3);
  assert.equal(first.total, 23);
  const item = await getServiceRequestById(first.items[0].id);
  assert.deepEqual(Object.keys(item).sort(), [
    "id", "ticket_number", "request_type", "applicant_name", "domicile_address",
    "domicile_duration", "purpose", "status", "administrative_unit_id",
    "created_at", "updated_at",
  ].sort());
  assert.equal(await getServiceRequestById("missing"), null);
});

test("skenario kosong dan gagal tidak menghasilkan data palsu", async () => {
  preview();
  process.env.REQUESTS_MOCK_SCENARIO = "empty";
  assert.equal((await getServiceRequests(1)).total, 0);
  assert.equal(await getServiceRequestById("00000000-0000-4000-8000-000000000001"), null);
  process.env.REQUESTS_MOCK_SCENARIO = "error";
  await assert.rejects(getServiceRequests(1), { status: 503 });
});

test("keputusan simulasi hanya menerima alasan dan transisi pending", async () => {
  preview();
  global.fetch = () => { throw new Error("PATCH should not be called"); };
  const pending = (await getServiceRequests(1)).items[0];
  const approved = await simulateServiceRequestDecision(pending.id, { status: "approved", reason: "Data lengkap" });
  assert.equal(approved.status, "approved");
  assert.equal((await getServiceRequestById(pending.id)).status, "pending_review");
  await assert.rejects(simulateServiceRequestDecision(pending.id, { status: "approved", reason: "   " }), { status: 422 });
  await assert.rejects(simulateServiceRequestDecision(pending.id, { status: "completed", reason: "test" }), { status: 422 });
  const completed = (await getServiceRequests(1)).items.find((item) => item.status === "completed");
  await assert.rejects(simulateServiceRequestDecision(completed.id, { status: "rejected", reason: "test" }), { status: 409 });
  process.env.REQUESTS_MOCK_MUTATION_SCENARIO = "conflict";
  await assert.rejects(simulateServiceRequestDecision(pending.id, { status: "rejected", reason: "test" }), { status: 409 });
  process.env.REQUESTS_MOCK_MUTATION_SCENARIO = "error";
  await assert.rejects(simulateServiceRequestDecision(pending.id, { status: "rejected", reason: "test" }), { status: 503 });
});
