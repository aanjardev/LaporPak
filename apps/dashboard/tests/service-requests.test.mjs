import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getServiceRequest,
  listServiceRequests,
  updateServiceRequest,
} from "../lib/service-requests.ts";

test("REQUEST API uses admin token and contract paths", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  const calls = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(calls.length === 1
      ? { items: [{
          id: "11111111-1111-4111-8111-111111111111",
          ticket_number: "REQ-2026-0001",
          request_type: "residency_letter",
          applicant_name: "Warga Uji",
          status: "pending_review",
          administrative_unit_id: "22222222-2222-4222-8222-222222222222",
          created_at: "2026-09-19T00:00:00Z",
          updated_at: "2026-09-19T00:00:00Z",
        }], page: 2, page_size: 20, total: 1 }
      : calls.length === 2 ? {
            id: "11111111-1111-4111-8111-111111111111",
            ticket_number: "REQ-2026-0001",
            request_type: "residency_letter",
            applicant_name: "Warga Uji",
            domicile_address: "RT 03",
            domicile_duration: "2 tahun",
            purpose: "Uji",
            status: "approved",
            administrative_unit_id: "22222222-2222-4222-8222-222222222222",
            created_at: "2026-09-19T00:00:00Z",
            updated_at: "2026-09-19T00:00:00Z",
            allowed_transitions: ["approved", "rejected"],
            status_history: [{
              old_status: null,
              new_status: "pending_review",
              actor_type: "system",
              actor_display_name: null,
              reason: "Request created",
              created_at: "2026-09-19T00:00:00Z",
            }],
          } : {
            id: "11111111-1111-4111-8111-111111111111",
            ticket_number: "REQ-2026-0001",
            status: "approved",
            updated_at: "2026-09-19T01:00:00Z",
          });
  };
  try {
    const list = await listServiceRequests(2, "admin-token");
    const detail = await getServiceRequest("request-id", "admin-token");
    const updated = await updateServiceRequest("request-id", "approved", "Lengkap", "admin-token");
    assert.equal("purpose" in list.items[0], false);
    assert.deepEqual(detail.allowed_transitions, ["approved", "rejected"]);
    assert.equal(detail.status_history[0].actor_display_name, null);
    assert.equal(JSON.stringify(detail).includes("supabase:"), false);
    assert.deepEqual(Object.keys(updated).sort(), ["id", "status", "ticket_number", "updated_at"]);
  } finally {
    globalThis.fetch = previous;
  }

  assert.match(calls[0].url, /service-requests\?page=2&page_size=20$/);
  assert.match(calls[1].url, /service-requests\/request-id$/);
  assert.match(calls[2].url, /service-requests\/request-id\/status$/);
  assert.equal(calls[2].init.method, "PATCH");
  assert.equal(calls[2].init.headers.Authorization, "Bearer admin-token");
  assert.deepEqual(JSON.parse(calls[2].init.body), {
    status: "approved",
    reason: "Lengkap",
  });
});

test("REQUEST detail UI uses transitions supplied by backend", async () => {
  const source = await readFile(
    new URL("../app/reports/requests/[id]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /item\.allowed_transitions/);
  assert.doesNotMatch(source, /const actions:/);
  assert.match(source, /status_history/);
});
