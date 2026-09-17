import assert from "node:assert/strict";
import test from "node:test";

import { buildCreateReportTool } from "./index.js";

const input = {
  report_draft_id: "f054d94f-b37d-4dfc-a62b-c48eec95e104",
  category: "infrastructure",
  description: "Jalan di RT 03 rusak parah.",
  location: { text: "RT 03 dekat masjid", latitude: null, longitude: null },
  urgency: "high",
  original_text: "Pak, jalan di RT 03 dekat masjid rusak parah.",
  confidence: 0.94,
  summary: "Kerusakan jalan di RT 03.",
};

test("uses trusted channel identity and sends idempotency headers", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url: String(url), options };
    return new Response(
      JSON.stringify({
        id: "72af1a52-7016-48c7-aacc-6c35417be819",
        ticket_number: "LP-2026-0001",
        status: "pending_verification",
        created_at: "2026-09-17T05:00:00Z",
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  };
  const tool = buildCreateReportTool(
    {
      messageChannel: "whatsapp",
      requesterSenderId: "6281234567890",
      sessionId: "c5b17858-4046-4d4f-a718-6ea19c1da781",
    },
    fetchImpl,
    { LAPORPAK_API_URL: "http://localhost:8000", LAPORPAK_API_KEY: "secret" },
  );

  const result = await tool.execute("call-1", input);
  const body = JSON.parse(request.options.body);

  assert.equal(request.url, "http://localhost:8000/api/v1/reports");
  assert.equal(request.options.headers["Idempotency-Key"], input.report_draft_id);
  assert.equal(request.options.headers["X-OpenClaw-API-Key"], "secret");
  assert.equal(body.sender_phone_number, "6281234567890");
  assert.equal(body.conversation_id, "c5b17858-4046-4d4f-a718-6ea19c1da781");
  assert.equal(result.details.ticket_number, "LP-2026-0001");
  assert.equal(result.details.replayed, false);
});

test("rejects calls without authenticated WhatsApp context", async () => {
  const tool = buildCreateReportTool(
    { messageChannel: "webchat", requesterSenderId: "6281234567890" },
    async () => assert.fail("fetch should not run"),
    { LAPORPAK_API_URL: "http://localhost:8000", LAPORPAK_API_KEY: "secret" },
  );

  await assert.rejects(
    tool.execute("call-2", input),
    /requires an authenticated WhatsApp sender/,
  );
});
