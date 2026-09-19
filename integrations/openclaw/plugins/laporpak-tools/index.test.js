import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAskTool,
  buildConfirmResolutionTool,
  buildCreateReportTool,
  buildServiceRequestTool,
  buildTrackTool,
} from "./index.js";

const input = {
  category: "infrastructure",
  description: "Jalan di RT 03 rusak parah.",
  location: { text: "RT 03 dekat masjid", latitude: null, longitude: null },
  urgency: "high",
  original_text: "Pak, jalan di RT 03 dekat masjid rusak parah.",
  confidence: 0.94,
  summary: "Kerusakan jalan di RT 03.",
};
const testEnv = {
  LAPORPAK_API_URL: "http://localhost:8000",
  LAPORPAK_API_KEY: "secret",
  LAPORPAK_CHANNEL_ACCOUNT_ID: "whatsapp-demo",
};
const testAttachments = async () => [
  {
    data_base64: Buffer.from("photo").toString("base64"),
    mime_type: "image/jpeg",
    filename: "foto_jalan.jpg",
    size: 5,
    sourceId: "wa-message-1",
  },
];

test("uses trusted identity, media, unit, and a derived idempotency key", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url: String(url), options };
    return Response.json(
      {
        id: "72af1a52-7016-48c7-aacc-6c35417be819",
        ticket_number: "LP-2026-0001",
        status: "pending_verification",
        created_at: "2026-09-17T05:00:00Z",
      },
      { status: 201 },
    );
  };
  const tool = buildCreateReportTool(
    {
      messageChannel: "whatsapp",
      requesterSenderId: "6281234567890",
      sessionId: "c5b17858-4046-4d4f-a718-6ea19c1da781",
    },
    fetchImpl,
    testEnv,
    testAttachments,
  );

  const result = await tool.execute("call-1", input);
  const body = JSON.parse(request.options.body);
  const firstIdempotencyKey = request.options.headers["Idempotency-Key"];

  assert.equal(request.url, "http://localhost:8000/api/v1/reports");
  assert.match(firstIdempotencyKey, /^[0-9a-f-]{36}$/);
  assert.equal(request.options.headers["X-OpenClaw-API-Key"], "secret");
  assert.equal(
    request.options.headers["X-Channel-Account-ID"],
    testEnv.LAPORPAK_CHANNEL_ACCOUNT_ID,
  );
  assert.equal(body.sender_phone_number, "6281234567890");
  assert.equal(body.conversation_id, "c5b17858-4046-4d4f-a718-6ea19c1da781");
  assert.equal(body.attachments[0].data_base64, Buffer.from("photo").toString("base64"));
  assert.equal("sourceId" in body.attachments[0], false);
  assert.equal(result.details.ticket_number, "LP-2026-0001");

  await tool.execute("call-1-retry", {
    ...input,
    location: { longitude: null, text: "RT 03 dekat masjid", latitude: null },
  });
  assert.equal(request.options.headers["Idempotency-Key"], firstIdempotencyKey);
});

test("rejects calls without authenticated WhatsApp context", async () => {
  const tool = buildCreateReportTool(
    { messageChannel: "webchat", requesterSenderId: "6281234567890" },
    async () => assert.fail("fetch should not run"),
    testEnv,
    testAttachments,
  );

  await assert.rejects(
    tool.execute("call-2", input),
    /requires an authenticated WhatsApp sender/,
  );
});

test("rejects calls without trusted inbound media", async () => {
  const tool = buildCreateReportTool(
    { messageChannel: "whatsapp", requesterSenderId: "6281234567890" },
    async () => assert.fail("fetch should not run"),
    testEnv,
    async () => [],
  );

  await assert.rejects(
    tool.execute("call-3", input),
    /No trusted WhatsApp photo is available/,
  );
});

test("ASK returns approved knowledge payload", async () => {
  let body;
  const tool = buildAskTool(
    { messageChannel: "whatsapp", requesterSenderId: "6281234567890" },
    async (_url, options) => {
      body = JSON.parse(options.body);
      return Response.json({
        outcome: "answered",
        answer_blocks: ["SIMULASI: Kantor buka Senin-Jumat."],
        sources: [],
      });
    },
    testEnv,
  );

  const result = await tool.execute("call-4", { question: "Kapan kantor buka?" });
  assert.equal(body.question, "Kapan kantor buka?");
  assert.equal(result.details.outcome, "answered");
});

test("TRACK injects trusted sender identity", async () => {
  let body;
  const tool = buildTrackTool(
    { messageChannel: "whatsapp", requesterSenderId: "6281234567890" },
    async (_url, options) => {
      body = JSON.parse(options.body);
      return Response.json({ items: [], checked_at: "2026-09-17T05:00:00Z" });
    },
    testEnv,
  );

  await tool.execute("call-5", { ticket_number: "LP-2026-0001" });
  assert.equal(body.sender_phone_number, "6281234567890");
  assert.equal(body.ticket_number, "LP-2026-0001");
});

test("resolution confirmation injects trusted sender identity", async () => {
  let body;
  const tool = buildConfirmResolutionTool(
    { messageChannel: "whatsapp", requesterSenderId: "6281234567890" },
    async (_url, options) => {
      body = JSON.parse(options.body);
      return Response.json({
        ticket_number: "LP-2026-0001",
        status: "confirmed",
      });
    },
    testEnv,
  );

  await tool.execute("call-6", {
    ticket_number: "LP-2026-0001",
    confirmed: true,
    feedback: "Sudah selesai",
  });

  assert.equal(body.sender_phone_number, "6281234567890");
  assert.equal(body.confirmed, true);
});

test("REQUEST injects trusted identity and uses a stable idempotency key", async () => {
  const calls = [];
  const tool = buildServiceRequestTool(
    {
      messageChannel: "whatsapp",
      requesterSenderId: "6281234567890",
      sessionId: "c5b17858-4046-4d4f-a718-6ea19c1da781",
    },
    async (url, options) => {
      calls.push({ url: String(url), options });
      return Response.json({
        id: "72af1a52-7016-48c7-aacc-6c35417be819",
        ticket_number: "REQ-2026-0001",
        request_type: "residency_letter",
        applicant_name: "Warga Uji",
        domicile_address: "RT 03",
        domicile_duration: "2 tahun",
        purpose: "Keperluan uji",
        status: "pending_review",
        administrative_unit_id: "00000000-0000-4000-8000-000000000002",
        created_at: "2026-09-19T00:00:00Z",
        updated_at: "2026-09-19T00:00:00Z",
      }, { status: calls.length === 1 ? 201 : 200 });
    },
    testEnv,
  );
  const input = {
    applicant_name: "Warga Uji",
    domicile_address: "RT 03",
    domicile_duration: "2 tahun",
    purpose: "Keperluan uji",
  };

  await tool.execute("request-1", input);
  await tool.execute("request-1-retry", input);

  assert.equal(calls[0].url, "http://localhost:8000/api/v1/service-requests");
  assert.equal(JSON.parse(calls[0].options.body).sender_phone_number, "6281234567890");
  assert.equal(
    calls[0].options.headers["Idempotency-Key"],
    calls[1].options.headers["Idempotency-Key"],
  );
  assert.equal(calls[0].options.headers["X-Channel-Account-ID"], "whatsapp-demo");
});
