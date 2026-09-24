import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import plugin from "./index.js";
import {
  channelEnvironment,
  buildAskTool,
  buildCaseContextTool,
  buildConfirmResolutionTool,
  buildCreateReportTool,
  buildPrepareReferralTool,
  buildReferralProgressTool,
  buildReportDocumentTool,
  buildRequestReferralDispatchTool,
  buildRoutingCandidatesTool,
  buildServiceRequestTool,
  buildTrackTool,
} from "./index.js";

test("manifest tool contract matches every registered tool", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("./openclaw.plugin.json", import.meta.url), "utf8"),
  );
  const registered = [];
  plugin.register({
    on() {},
    registerTool(_factory, metadata) {
      registered.push(metadata.name);
    },
  });
  assert.deepEqual([...registered].sort(), [...manifest.contracts.tools].sort());
  assert.deepEqual(
    Object.keys(manifest.toolMetadata).sort(),
    [...manifest.contracts.tools].sort(),
  );
  assert.equal(manifest.contracts.tools.some((name) => name.includes("approve")), false);
});

test("referral output schema keeps approval human-only", async () => {
  const schema = JSON.parse(
    await readFile(
      new URL("../../schemas/referral-proposal.schema.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(schema.properties.requires_human_approval.const, true);
  assert.equal(schema.properties.action.enum.includes("approve"), false);
  assert.equal("actor" in schema.properties, false);
  assert.equal("tenant_id" in schema.properties, false);
  assert.equal("destination_url" in schema.properties, false);
});

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
const operatorEnv = {
  LAPORPAK_API_URL: "http://localhost:8000",
  LAPORPAK_REFERRAL_TOOLS_ENABLED: "true",
  LAPORPAK_OPERATOR_ACCESS_TOKEN: "operator-token",
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

test("ASK creates a 768-dimensional query embedding and labels demo data", async () => {
  const calls = [];
  const tool = buildAskTool(
    { messageChannel: "whatsapp", requesterSenderId: "6281234567890" },
    async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("generativelanguage.googleapis.com")) {
        const request = JSON.parse(options.body);
        assert.equal(request.taskType, "RETRIEVAL_QUERY");
        assert.equal(request.outputDimensionality, 768);
        return Response.json({ embedding: { values: Array(768).fill(0.25) } });
      }
      return Response.json({
        outcome: "answered",
        trust_level: "demo",
        answer_blocks: ["Kantor buka pukul 08.00."],
        sources: [],
      });
    },
    { ...testEnv, GEMINI_API_KEY: "gemini-test" },
  );

  const result = await tool.execute("call-demo", { question: "Jam kantor?" });
  const backendBody = JSON.parse(calls[1].options.body);
  assert.equal(backendBody.query_embedding.length, 768);
  assert.match(result.details.notice, /SIMULASI/);
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

test("document delivery request injects trusted sender and channel", async () => {
  let request;
  const tool = buildReportDocumentTool(
    { messageChannel: "whatsapp", requesterSenderId: "6281234567890" },
    async (url, options) => {
      request = { url: String(url), options };
      return Response.json({
        id: "72af1a52-7016-48c7-aacc-6c35417be819",
        document_type: "receipt",
        version: 1,
        status: "ready",
        delivery_status: "pending",
        created_at: "2026-09-20T05:00:00Z",
      });
    },
    testEnv,
  );

  await tool.execute("call-document", {
    ticket_number: "LP-2026-0001",
    document_type: "receipt",
  });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, "http://localhost:8000/api/v1/report-documents/delivery-requests");
  assert.equal(body.sender_phone_number, "6281234567890");
  assert.equal(request.options.headers["X-Channel-Account-ID"], "whatsapp-demo");
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

  const created = await tool.execute("request-1", input);
  const replayed = await tool.execute("request-1-retry", input);

  const otherChannelTool = buildServiceRequestTool(
    {
      messageChannel: "whatsapp",
      requesterSenderId: "6281234567890",
      sessionId: "c5b17858-4046-4d4f-a718-6ea19c1da781",
    },
    async (url, options) => {
      calls.push({ url: String(url), options });
      return Response.json({
        id: "72af1a52-7016-48c7-aacc-6c35417be819",
        ticket_number: "REQ-2026-0002",
        request_type: "residency_letter",
        applicant_name: "Warga Uji",
        domicile_address: "RT 03",
        domicile_duration: "2 tahun",
        purpose: "Keperluan uji",
        status: "pending_review",
        administrative_unit_id: "00000000-0000-4000-8000-000000000003",
        created_at: "2026-09-19T00:00:00Z",
        updated_at: "2026-09-19T00:00:00Z",
      }, { status: 201 });
    },
    { ...testEnv, LAPORPAK_CHANNEL_ACCOUNT_ID: "whatsapp-other-village" },
  );
  await otherChannelTool.execute("request-other-village", input);

  assert.equal(calls[0].url, "http://localhost:8000/api/v1/service-requests");
  assert.equal(created.details.replayed, false);
  assert.equal(replayed.details.replayed, true);
  assert.equal(JSON.parse(calls[0].options.body).sender_phone_number, "6281234567890");
  assert.equal(
    calls[0].options.headers["Idempotency-Key"],
    calls[1].options.headers["Idempotency-Key"],
  );
  assert.notEqual(
    calls[0].options.headers["Idempotency-Key"],
    calls[2].options.headers["Idempotency-Key"],
  );
  assert.equal(calls[0].options.headers["X-Channel-Account-ID"], "whatsapp-demo");
});

test("trusted media is isolated by session and cannot move to another draft", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laporpak-media-"));
  const photo = join(directory, "photo.jpg");
  await writeFile(photo, Buffer.from("photo"));
  const previous = {
    url: process.env.LAPORPAK_API_URL,
    key: process.env.LAPORPAK_API_KEY,
    channel: process.env.LAPORPAK_CHANNEL_ACCOUNT_ID,
  };
  process.env.LAPORPAK_API_URL = testEnv.LAPORPAK_API_URL;
  process.env.LAPORPAK_API_KEY = testEnv.LAPORPAK_API_KEY;
  process.env.LAPORPAK_CHANNEL_ACCOUNT_ID = testEnv.LAPORPAK_CHANNEL_ACCOUNT_ID;
  let inbound;
  plugin.register({
    on(_event, handler) { inbound = handler; },
    registerTool() {},
  });
  inbound({
    senderId: "628199999999",
    sessionKey: "session-key-a",
    messageId: "media-message",
    media: [{ path: photo, contentType: "image/jpeg" }],
  }, { accountId: "whatsapp-demo", sessionKey: "session-key-a" });
  const fetchImpl = async () => Response.json({
    id: "72af1a52-7016-48c7-aacc-6c35417be819",
    ticket_number: "LP-2026-0001",
    status: "pending_verification",
    created_at: "2026-09-19T00:00:00Z",
  }, { status: 201 });
  try {
    const otherSession = buildCreateReportTool(
      { messageChannel: "whatsapp", requesterSenderId: "628199999999", sessionId: "session-b" },
      fetchImpl,
      testEnv,
    );
    await assert.rejects(otherSession.execute("other", input), /No trusted WhatsApp photo/);

    const tool = buildCreateReportTool(
      { messageChannel: "whatsapp", requesterSenderId: "628199999999", sessionKey: "session-key-a", sessionId: "runtime-session-id" },
      fetchImpl,
      testEnv,
    );
    await tool.execute("first", input);
    await assert.rejects(
      tool.execute("second", { ...input, description: "Draft laporan yang berbeda." }),
      /already used by another report draft/,
    );
  } finally {
    if (previous.url === undefined) delete process.env.LAPORPAK_API_URL;
    else process.env.LAPORPAK_API_URL = previous.url;
    if (previous.key === undefined) delete process.env.LAPORPAK_API_KEY;
    else process.env.LAPORPAK_API_KEY = previous.key;
    if (previous.channel === undefined) delete process.env.LAPORPAK_CHANNEL_ACCOUNT_ID;
    else process.env.LAPORPAK_CHANNEL_ACCOUNT_ID = previous.channel;
    await rm(directory, { recursive: true, force: true });
  }
});

test("REQUEST does not return success when persistence fails", async () => {
  const tool = buildServiceRequestTool(
    {
      messageChannel: "whatsapp",
      requesterSenderId: "6281234567890",
      sessionId: "request-failure-session",
    },
    async () => Response.json(
      { error: { code: "DATABASE_UNAVAILABLE" } },
      { status: 503 },
    ),
    testEnv,
  );

  await assert.rejects(
    tool.execute("request-failure", {
      applicant_name: "Warga Uji",
      domicile_address: "RT 03",
      domicile_duration: "2 tahun",
      purpose: "Keperluan uji",
    }),
    /503 DATABASE_UNAVAILABLE/,
  );
});

const referralIds = {
  report: "20000000-0000-4000-8000-000000000001",
  channel: "50000000-0000-4000-8000-000000000001",
  referral: "30000000-0000-4000-8000-000000000001",
  attachment: "a0000000-0000-4000-8000-000000000001",
};

test("operator referral reads use bearer scope and GET only", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ items: [] });
  };
  const context = { messageChannel: "internal" };

  await buildCaseContextTool(context, fetchImpl, operatorEnv).execute("case", {
    report_id: referralIds.report,
  });
  await buildRoutingCandidatesTool(context, fetchImpl, operatorEnv).execute(
    "routes",
    { report_id: referralIds.report },
  );
  await buildReferralProgressTool(context, fetchImpl, operatorEnv).execute(
    "progress",
    { report_id: referralIds.report },
  );

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      `http://localhost:8000/api/v1/reports/${referralIds.report}`,
      `http://localhost:8000/api/v1/reports/${referralIds.report}/routing-options`,
      `http://localhost:8000/api/v1/reports/${referralIds.report}/referrals`,
    ],
  );
  for (const call of calls) {
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.headers.Authorization, "Bearer operator-token");
    assert.equal("body" in call.options, false);
    assert.equal("X-OpenClaw-API-Key" in call.options.headers, false);
  }
});

test("referral draft omits authority fields and derives a stable request key", async () => {
  const requests = [];
  const tool = buildPrepareReferralTool(
    { messageChannel: "internal" },
    async (url, options) => {
      requests.push({ url: String(url), options, body: JSON.parse(options.body) });
      return Response.json({
        id: referralIds.referral,
        report_id: referralIds.report,
        dispatch_status: "awaiting_approval",
      }, { status: 201 });
    },
    operatorEnv,
  );
  const draft = {
    report_id: referralIds.report,
    channel_id: referralIds.channel,
    summary: "Jalan rusak di RT 03.",
    chronology: "Kerusakan terlihat sejak kemarin.",
    requested_action: "Mohon pemeriksaan.",
    attachment_ids: [referralIds.attachment],
  };

  await tool.execute("draft-1", draft);
  await tool.execute("draft-1-replay", draft);

  assert.equal(
    requests[0].url,
    `http://localhost:8000/api/v1/reports/${referralIds.report}/referrals`,
  );
  assert.equal(requests[0].body.request_key, requests[1].body.request_key);
  assert.equal(requests[0].body.package.share_citizen_identity, false);
  for (const forbidden of [
    "actor",
    "approved",
    "tenant_id",
    "administrative_unit_id",
    "destination_url",
  ]) {
    assert.equal(forbidden in requests[0].body, false);
  }
});

test("dispatch request is stable and still depends on backend approval", async () => {
  const requests = [];
  const tool = buildRequestReferralDispatchTool(
    { messageChannel: "internal" },
    async (url, options) => {
      if (options.method === "GET") {
        return Response.json([{
          id: referralIds.referral,
          active_package_version: 2,
          package_hash: "a".repeat(64),
        }]);
      }
      const body = JSON.parse(options.body);
      requests.push({ url: String(url), body });
      return Response.json({
        referral: { id: referralIds.referral, dispatch_status: "queued" },
        operation_key: body.operation_key,
        job_status: "pending",
        replayed: requests.length > 1,
      }, { status: 202 });
    },
    operatorEnv,
  );

  const input = {
    report_id: referralIds.report,
    referral_id: referralIds.referral,
  };
  await tool.execute("dispatch-1", input);
  await tool.execute("dispatch-1-replay", input);

  assert.equal(requests[0].body.operation_key, requests[1].body.operation_key);
  assert.deepEqual(Object.keys(requests[0].body), ["operation_key"]);
  assert.equal(
    requests[0].url,
    `http://localhost:8000/api/v1/referrals/${referralIds.referral}/dispatch`,
  );

  const rejected = buildRequestReferralDispatchTool(
    { messageChannel: "internal" },
    async (_url, options) => options.method === "GET"
      ? Response.json([{
          id: referralIds.referral,
          active_package_version: 2,
          package_hash: "a".repeat(64),
        }])
      : Response.json(
          { error: { code: "REFERRAL_CONFLICT" } },
          { status: 409 },
        ),
    operatorEnv,
  );
  await assert.rejects(
    rejected.execute("unapproved", input),
    /409 REFERRAL_CONFLICT/,
  );
});

test("dispatch derives a new operation key from a new persisted package version", async () => {
  let version = 1;
  const operationKeys = [];
  const tool = buildRequestReferralDispatchTool(
    { messageChannel: "internal" },
    async (_url, options) => {
      if (options.method === "GET") {
        return Response.json([{
          id: referralIds.referral,
          active_package_version: version,
          package_hash: String(version).repeat(64),
        }]);
      }
      const body = JSON.parse(options.body);
      operationKeys.push(body.operation_key);
      return Response.json({ operation_key: body.operation_key }, { status: 202 });
    },
    operatorEnv,
  );
  const input = {
    report_id: referralIds.report,
    referral_id: referralIds.referral,
  };

  await tool.execute("version-1", input);
  version = 2;
  await tool.execute("version-2", input);

  assert.notEqual(operationKeys[0], operationKeys[1]);
});

test("referral tools are disabled for citizen WhatsApp and opt-in runtimes", async () => {
  const neverFetch = async () => assert.fail("fetch should not run");
  const citizenTool = buildRoutingCandidatesTool(
    { messageChannel: "whatsapp", requesterSenderId: "6281234567890" },
    neverFetch,
    operatorEnv,
  );
  await assert.rejects(
    citizenTool.execute("citizen", { report_id: referralIds.report }),
    /not available in citizen WhatsApp sessions/,
  );

  const disabledTool = buildRoutingCandidatesTool(
    { messageChannel: "internal" },
    neverFetch,
    { ...operatorEnv, LAPORPAK_REFERRAL_TOOLS_ENABLED: "false" },
  );
  await assert.rejects(
    disabledTool.execute("disabled", { report_id: referralIds.report }),
    /disabled for this OpenClaw runtime/,
  );
});


test("trusted runtime account overrides single-account fallback", () => {
  assert.equal(channelEnvironment({ agentAccountId: "village-b" }, testEnv).LAPORPAK_CHANNEL_ACCOUNT_ID, "village-b");
  assert.equal(channelEnvironment({ deliveryContext: { accountId: "village-a" } }, testEnv).LAPORPAK_CHANNEL_ACCOUNT_ID, "village-a");
  assert.throws(() => channelEnvironment({ agentAccountId: "" }, testEnv), /invalid/);
  assert.equal(testEnv.LAPORPAK_CHANNEL_ACCOUNT_ID, "whatsapp-demo");
  const twoVillages = { ...testEnv, LAPORPAK_REQUIRE_RUNTIME_ACCOUNT: "true" };
  assert.throws(() => channelEnvironment({}, twoVillages), /required/);
  assert.equal(channelEnvironment({ agentAccountId: "village-b" }, twoVillages).LAPORPAK_CHANNEL_ACCOUNT_ID, "village-b");
});

test("two-village mode ignores media hooks without a trusted account", async () => {
  const previous = {
    account: process.env.LAPORPAK_CHANNEL_ACCOUNT_ID,
    required: process.env.LAPORPAK_REQUIRE_RUNTIME_ACCOUNT,
  };
  process.env.LAPORPAK_CHANNEL_ACCOUNT_ID = "village-a";
  process.env.LAPORPAK_REQUIRE_RUNTIME_ACCOUNT = "true";
  try {
    let inbound;
    plugin.register({ on(_event, handler) { inbound = handler; }, registerTool() {} });
    inbound({
      senderId: "6281000000001",
      sessionKey: "two-village-untrusted-media",
      media: [{ path: "missing-test-photo.jpg", contentType: "image/jpeg" }],
    }, {});
    const tool = buildCreateReportTool(
      { messageChannel: "whatsapp", requesterSenderId: "6281000000001", sessionKey: "two-village-untrusted-media" },
      async () => { throw new Error("Backend must not be called"); },
      testEnv,
    );
    await assert.rejects(tool.execute("untrusted-media", input), /No trusted WhatsApp photo/);
  } finally {
    if (previous.account === undefined) delete process.env.LAPORPAK_CHANNEL_ACCOUNT_ID;
    else process.env.LAPORPAK_CHANNEL_ACCOUNT_ID = previous.account;
    if (previous.required === undefined) delete process.env.LAPORPAK_REQUIRE_RUNTIME_ACCOUNT;
    else process.env.LAPORPAK_REQUIRE_RUNTIME_ACCOUNT = previous.required;
  }
});

test("disabled citizen tools never return success or retry", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return Response.json({ error: { code: "AI_DISABLED" } }, { status: 503 }); };
  const context = { messageChannel: "whatsapp", requesterSenderId: "6281234567890" };
  const tool = buildTrackTool(context, fetchImpl, testEnv);
  await assert.rejects(tool.execute("disabled", { ticket_number: "LP-2026-0001" }), /AI_DISABLED.*hubungi petugas desa/);
  assert.equal(calls, 1);
  const report = buildCreateReportTool(context, fetchImpl, testEnv, testAttachments);
  await assert.rejects(report.execute("disabled-report", input), /AI_DISABLED/);
  assert.equal(calls, 2);
});
