import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MEDIA_TTL_MS = 30 * 60 * 1000;
const MAX_MEDIA_SENDERS = 1000;
const recentMediaBySender = new Map();

const parameters = {
  type: "object",
  additionalProperties: false,
  required: [
    "category",
    "description",
    "location",
    "original_text",
    "confidence",
  ],
  properties: {
    category: {
      type: "string",
      enum: [
        "infrastructure",
        "public_facility",
        "cleanliness",
        "security",
        "social",
        "administration",
        "other",
      ],
    },
    description: { type: "string", minLength: 1 },
    location: {
      type: "object",
      additionalProperties: false,
      required: ["text", "latitude", "longitude"],
      properties: {
        text: { type: ["string", "null"] },
        latitude: { type: ["number", "null"], minimum: -90, maximum: 90 },
        longitude: { type: ["number", "null"], minimum: -180, maximum: 180 },
      },
    },
    urgency: {
      type: ["string", "null"],
      enum: ["low", "medium", "high", "critical", null],
    },
    original_text: { type: "string", minLength: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: ["string", "null"] },
  },
};

function senderKey(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function uuidFromFingerprint(value) {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function mediaCacheKey(channelAccountId, sender, sessionId) {
  return `${channelAccountId}:${senderKey(sender)}:${sessionId ?? "no-session"}`;
}

function pruneMediaCache(now = Date.now()) {
  for (const [key, media] of recentMediaBySender) {
    const fresh = media.filter((item) => now - item.receivedAt <= MEDIA_TTL_MS);
    if (fresh.length) recentMediaBySender.set(key, fresh);
    else recentMediaBySender.delete(key);
  }
  while (recentMediaBySender.size > MAX_MEDIA_SENDERS) {
    recentMediaBySender.delete(recentMediaBySender.keys().next().value);
  }
}

async function trustedAttachments(context, env = process.env) {
  const { channelAccountId } = backendConfig(env);
  pruneMediaCache();
  const media = recentMediaBySender.get(
    mediaCacheKey(
      channelAccountId,
      context.requesterSenderId,
      context.sessionKey ?? context.sessionId ?? null,
    ),
  ) ?? [];
  const freshMedia = media.filter(
    (item) =>
      Date.now() - item.receivedAt <= MEDIA_TTL_MS &&
      (!item.sessionId || item.sessionId === (context.sessionKey ?? context.sessionId ?? null)),
  );
  const attachments = [];
  for (const [index, item] of freshMedia.slice(0, 3).entries()) {
    const data = await readFile(item.path);
    if (data.length > MAX_ATTACHMENT_BYTES) {
      throw new Error("Photo attachment exceeds 5 MB");
    }
    attachments.push({
      data_base64: data.toString("base64"),
      mime_type: item.mimeType,
      filename: `whatsapp-image-${index + 1}.${basename(item.path).split(".").pop() ?? "bin"}`,
      size: data.length,
      sourceId: item.messageId ?? item.path,
      _cacheItem: item,
    });
  }
  return attachments;
}

function apiEndpoint(value, path) {
  const url = new URL(path, `${value.replace(/\/+$/, "")}/`);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("LAPORPAK_API_URL must use http or https");
  }
  return url;
}

function requireWhatsappContext(context, toolName) {
  if (context.messageChannel !== "whatsapp" || !context.requesterSenderId) {
    throw new Error(`${toolName} requires an authenticated WhatsApp sender`);
  }
}

function backendConfig(env) {
  const apiUrl = env.LAPORPAK_API_URL?.trim();
  const apiKey = env.LAPORPAK_API_KEY?.trim();
  const channelAccountId = env.LAPORPAK_CHANNEL_ACCOUNT_ID?.trim();
  if (!apiUrl || !apiKey || !channelAccountId) {
    throw new Error("LaporPak API environment is not configured");
  }
  return { apiUrl, apiKey, channelAccountId };
}

export function channelEnvironment(context, env = process.env) {
  const account = context.agentAccountId ?? context.deliveryContext?.accountId;
  if (account !== undefined && (typeof account !== "string" || !account.trim())) {
    throw new Error("Trusted channel account is invalid");
  }
  return account === undefined ? env : { ...env, LAPORPAK_CHANNEL_ACCOUNT_ID: account.trim() };
}

function backendFailure(status, result) {
  if (status === 503 && result?.error?.code === "AI_DISABLED") {
    return new Error("AI_DISABLED: Layanan otomatis sedang nonaktif. Silakan hubungi petugas desa. Jangan mengklaim tindakan berhasil atau mengulang otomatis sebelum layanan diaktifkan.");
  }
  // Do not expose upstream detail or arbitrary response text to the model.
  const code = /^[A-Z][A-Z0-9_]{0,63}$/.test(result?.error?.code ?? "") ? result.error.code : "REQUEST_FAILED";
  return new Error(`LaporPak API rejected the request (${status} ${code})`);
}

async function callBackend(fetchImpl, env, path, body) {
  const { apiUrl, apiKey, channelAccountId } = backendConfig(env);
  const response = await fetchImpl(apiEndpoint(apiUrl, path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OpenClaw-API-Key": apiKey,
      "X-Channel-Account-ID": channelAccountId,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const result = await responseJson(response);
  if (!response.ok) {
    throw backendFailure(response.status, result);
  }
  return { response, result };
}

function requireOperatorContext(context, env, toolName) {
  if (env.LAPORPAK_REFERRAL_TOOLS_ENABLED !== "true") {
    throw new Error(`${toolName} is disabled for this OpenClaw runtime`);
  }
  if (context.messageChannel === "whatsapp") {
    throw new Error(`${toolName} is not available in citizen WhatsApp sessions`);
  }
}

function operatorConfig(env) {
  const apiUrl = env.LAPORPAK_API_URL?.trim();
  const accessToken = env.LAPORPAK_OPERATOR_ACCESS_TOKEN?.trim();
  if (!apiUrl || !accessToken) {
    throw new Error("LaporPak operator environment is not configured");
  }
  return { apiUrl, accessToken };
}

async function callOperatorBackend(
  fetchImpl,
  env,
  path,
  { method = "GET", body } = {},
) {
  const { apiUrl, accessToken } = operatorConfig(env);
  const response = await fetchImpl(apiEndpoint(apiUrl, path), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60_000),
  });
  const result = await responseJson(response);
  if (!response.ok) {
    throw backendFailure(response.status, result);
  }
  return result;
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function geminiEmbedding(
  text,
  taskType,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: 768,
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  const result = await responseJson(response);
  if (!response.ok || !Array.isArray(result?.embedding?.values)) {
    throw new Error(`Gemini embedding failed (${response.status})`);
  }
  if (result.embedding.values.length !== 768) {
    throw new Error("Gemini embedding must contain exactly 768 values");
  }
  return result.embedding.values;
}

export function buildCreateReportTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
  attachmentProvider = trustedAttachments,
) {
  return {
    name: "laporpak_create_report",
    label: "Create LaporPak report",
    description:
      "Create one confirmed WhatsApp REPORT. Call only after category, description, location, and a photo received from WhatsApp are complete and the citizen confirms submission. Media and idempotency are supplied by the trusted plugin runtime.",
    parameters,
    async execute(_toolCallId, input) {
      requireWhatsappContext(context, "laporpak_create_report");
      const { apiUrl, apiKey, channelAccountId } = backendConfig(env);

      const locationComplete =
        (typeof input.location.text === "string" && input.location.text.trim()) ||
        (input.location.latitude !== null && input.location.longitude !== null);
      if (!locationComplete) {
        throw new Error("Report location is incomplete");
      }

      const attachments = await attachmentProvider(context, env);
      if (attachments.length === 0) {
        throw new Error("REPORT_NOT_CREATED: No trusted WhatsApp photo is available. Do not claim a ticket; ask the citizen to send the photo again");
      }
      const reportDraftId = uuidFromFingerprint(stableJson({
        channelAccountId,
        sender: senderKey(context.requesterSenderId),
        sessionId: context.sessionId ?? null,
        report: input,
        media: attachments.map((attachment) => attachment.sourceId),
      }));
      if (attachments.some(
        (attachment) =>
          attachment._cacheItem?.consumedBy &&
          attachment._cacheItem.consumedBy !== reportDraftId,
      )) {
        throw new Error("Trusted photo was already used by another report draft");
      }

      const body = {
        sender_phone_number: context.requesterSenderId,
        category: input.category,
        description: input.description,
        location: input.location,
        urgency: input.urgency ?? null,
        original_text: input.original_text,
        source: "whatsapp",
        ai_analysis: {
          confidence: input.confidence,
          summary: input.summary ?? null,
        },
        attachments: attachments.map(({
          sourceId: _sourceId,
          _cacheItem: _internal,
          ...attachment
        }) => attachment),
      };
      if (context.sessionId && UUID_PATTERN.test(context.sessionId)) {
        body.conversation_id = context.sessionId;
      }

      const response = await fetchImpl(apiEndpoint(apiUrl, "/api/v1/reports"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": reportDraftId,
          "X-OpenClaw-API-Key": apiKey,
          "X-Channel-Account-ID": channelAccountId,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      const result = await responseJson(response);
      if (!response.ok) {
        throw backendFailure(response.status, result);
      }

      for (const attachment of attachments) {
        if (attachment._cacheItem) attachment._cacheItem.consumedBy = reportDraftId;
      }

      const details = {
        id: result.id,
        ticket_number: result.ticket_number,
        status: result.status,
        created_at: result.created_at,
        replayed: response.status === 200,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(details) }],
        details,
      };
    },
  };
}

export function buildAskTool(context, fetchImpl = globalThis.fetch, env = process.env) {
  return {
    name: "laporpak_ask",
    label: "Ask approved village knowledge",
    description:
      "Retrieve approved village-service answer blocks and their sources. Use these blocks as the only factual basis for an ASK response.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["question"],
      properties: {
        question: { type: "string", minLength: 1 },
        service_key: { type: ["string", "null"], pattern: "^[a-z0-9_-]+$" },
      },
    },
    async execute(_toolCallId, input) {
      requireWhatsappContext(context, "laporpak_ask");
      const queryEmbedding = await geminiEmbedding(
        input.question,
        "RETRIEVAL_QUERY",
        fetchImpl,
        env,
      );
      const { result } = await callBackend(fetchImpl, env, "/api/v1/ask", {
        question: input.question,
        service_key: input.service_key ?? null,
        query_embedding: queryEmbedding,
      });
      if (result.trust_level === "demo") {
        result.notice = "DATA SIMULASI — bukan informasi operasional resmi.";
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}

export function buildTrackTool(context, fetchImpl = globalThis.fetch, env = process.env) {
  return {
    name: "laporpak_track_report",
    label: "Track citizen reports",
    description:
      "Read the authenticated WhatsApp sender's official report status. Includes SLA deadline and urgency info.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        ticket_number: {
          type: ["string", "null"],
          pattern: "^(LP|REQ)-[0-9]{4}-[0-9]{4,}$",
        },
      },
    },
    async execute(_toolCallId, input) {
      requireWhatsappContext(context, "laporpak_track_report");
      const { result } = await callBackend(fetchImpl, env, "/api/v1/track", {
        sender_phone_number: context.requesterSenderId,
        ticket_number: input.ticket_number ?? null,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}

export function buildReportDocumentTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  return {
    name: "laporpak_get_report_document",
    label: "Send citizen report document",
    description:
      "Request delivery of the authenticated WhatsApp sender's own receipt or verified REPORT PDF. The backend checks citizen ownership and village scope before sending the private document.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["ticket_number", "document_type"],
      properties: {
        ticket_number: { type: "string", pattern: "^LP-[0-9]{4}-[0-9]{4,}$" },
        document_type: { type: "string", enum: ["receipt", "verified"] },
      },
    },
    async execute(_toolCallId, input) {
      requireWhatsappContext(context, "laporpak_get_report_document");
      const { result } = await callBackend(
        fetchImpl,
        env,
        "/api/v1/report-documents/delivery-requests",
        {
          sender_phone_number: context.requesterSenderId,
          ticket_number: input.ticket_number,
          document_type: input.document_type,
        },
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}

export function buildServiceRequestTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  return {
    name: "laporpak_create_service_request",
    label: "Create residency letter request",
    description:
      "Submit one residency-letter REQUEST only after the citizen explicitly confirms a summary in a separate later message. Never call in the same turn that first supplies or corrects request data. The authenticated WhatsApp sender and village are supplied by the trusted plugin runtime; human administrators make the official decision.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "applicant_name",
        "domicile_address",
        "domicile_duration",
        "purpose",
      ],
      properties: {
        applicant_name: { type: "string", minLength: 1, maxLength: 200 },
        domicile_address: { type: "string", minLength: 1, maxLength: 1000 },
        domicile_duration: { type: "string", minLength: 1, maxLength: 200 },
        purpose: { type: "string", minLength: 1, maxLength: 1000 },
      },
    },
    async execute(_toolCallId, input) {
      requireWhatsappContext(context, "laporpak_create_service_request");
      const { apiUrl, apiKey, channelAccountId } = backendConfig(env);
      const body = {
        sender_phone_number: context.requesterSenderId,
        request_type: "residency_letter",
        applicant_name: input.applicant_name,
        domicile_address: input.domicile_address,
        domicile_duration: input.domicile_duration,
        purpose: input.purpose,
      };
      const draftId = uuidFromFingerprint(stableJson({
        channelAccountId,
        sender: senderKey(context.requesterSenderId),
        sessionId: context.sessionId ?? null,
        request: body,
      }));
      const response = await fetchImpl(
        apiEndpoint(apiUrl, "/api/v1/service-requests"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": draftId,
            "X-OpenClaw-API-Key": apiKey,
            "X-Channel-Account-ID": channelAccountId,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        },
      );
      const result = await responseJson(response);
      if (!response.ok) {
        throw backendFailure(response.status, result);
      }
      const details = { ...result, replayed: response.status === 200 };
      return {
        content: [{ type: "text", text: JSON.stringify(details) }],
        details,
      };
    },
  };
}

export function buildDetectEmergencyTool(context, fetchImpl = globalThis.fetch, env = process.env) {
  return {
    name: "laporpak_detect_emergency",
    label: "Detect emergency keywords",
    description:
      "Check if citizen message contains emergency keywords. Use this at the start of any conversation.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string", minLength: 1 },
      },
    },
    async execute(_toolCallId, input) {
      requireWhatsappContext(context, "laporpak_detect_emergency");
      const { result } = await callBackend(fetchImpl, env, "/api/v1/detect-emergency", {
        text: input.text,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}

export function buildSimilarReportsTool(context, fetchImpl = globalThis.fetch, env = process.env) {
  return {
    name: "laporpak_check_similar",
    label: "Check similar reports",
    description:
      "Check for existing similar reports before creating a new one. Reduces duplicates and informs citizens.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["category"],
      properties: {
        category: {
          type: "string",
          enum: [
            "infrastructure",
            "public_facility",
            "cleanliness",
            "security",
            "social",
            "administration",
            "other",
          ],
        },
        location_text: { type: ["string", "null"] },
        latitude: { type: ["number", "null"] },
        longitude: { type: ["number", "null"] },
      },
    },
    async execute(_toolCallId, input) {
      requireWhatsappContext(context, "laporpak_check_similar");
      const { result } = await callBackend(fetchImpl, env, "/api/v1/check-similar", {
        category: input.category,
        location_text: input.location_text ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}

export function buildConfirmResolutionTool(context, fetchImpl = globalThis.fetch, env = process.env) {
  return {
    name: "laporpak_confirm_resolution",
    label: "Confirm report resolution",
    description:
      "Record citizen's confirmation that a resolved report is actually fixed. Use when status is resolved.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["ticket_number", "confirmed"],
      properties: {
        ticket_number: {
          type: "string",
          pattern: "^LP-[0-9]{4}-[0-9]{4,}$",
        },
        confirmed: { type: "boolean" },
        feedback: { type: ["string", "null"] },
      },
    },
    async execute(_toolCallId, input) {
      requireWhatsappContext(context, "laporpak_confirm_resolution");
      const { result } = await callBackend(
        fetchImpl,
        env,
        `/api/v1/confirm-resolution/${input.ticket_number}`,
        {
          confirmed: input.confirmed,
          feedback: input.feedback ?? null,
          sender_phone_number: context.requesterSenderId,
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}

const reportIdParameters = {
  type: "object",
  additionalProperties: false,
  required: ["report_id"],
  properties: {
    report_id: { type: "string", pattern: UUID_PATTERN.source },
  },
};

function operatorToolResult(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    details: result,
  };
}

export function buildCaseContextTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  return {
    name: "laporpak_get_case_context",
    label: "Get scoped report context",
    description:
      "Read one report in the authenticated village operator scope. Use facts from this result; never infer missing case data.",
    parameters: reportIdParameters,
    async execute(_toolCallId, input) {
      requireOperatorContext(context, env, "laporpak_get_case_context");
      const result = await callOperatorBackend(
        fetchImpl,
        env,
        `/api/v1/reports/${encodeURIComponent(input.report_id)}`,
      );
      return operatorToolResult(result);
    },
  };
}

export function buildRoutingCandidatesTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  return {
    name: "laporpak_get_routing_candidates",
    label: "Get referral routing candidates",
    description:
      "Read backend-approved referral candidates for one report. An empty list requires operator review; never invent a destination.",
    parameters: reportIdParameters,
    async execute(_toolCallId, input) {
      requireOperatorContext(context, env, "laporpak_get_routing_candidates");
      const result = await callOperatorBackend(
        fetchImpl,
        env,
        `/api/v1/reports/${encodeURIComponent(input.report_id)}/routing-options`,
      );
      return operatorToolResult(result);
    },
  };
}

export function buildPrepareReferralTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  return {
    name: "laporpak_prepare_referral",
    label: "Prepare referral draft",
    description:
      "Create or revise a referral draft for an in-progress report using a candidate returned by the backend. This never approves or dispatches the package.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "report_id",
        "channel_id",
        "summary",
        "chronology",
        "requested_action",
      ],
      properties: {
        report_id: { type: "string", pattern: UUID_PATTERN.source },
        channel_id: { type: "string", pattern: UUID_PATTERN.source },
        summary: { type: "string", minLength: 1, maxLength: 2000 },
        chronology: { type: "string", minLength: 1, maxLength: 5000 },
        requested_action: { type: "string", minLength: 1, maxLength: 2000 },
        attachment_ids: {
          type: "array",
          maxItems: 10,
          uniqueItems: true,
          items: { type: "string", pattern: UUID_PATTERN.source },
        },
      },
    },
    async execute(_toolCallId, input) {
      requireOperatorContext(context, env, "laporpak_prepare_referral");
      const packageInput = {
        summary: input.summary,
        chronology: input.chronology,
        requested_action: input.requested_action,
        attachment_ids: input.attachment_ids ?? [],
        share_citizen_identity: false,
      };
      const requestKey = uuidFromFingerprint(
        stableJson({
          action: "prepare_referral",
          report_id: input.report_id,
          channel_id: input.channel_id,
          package: packageInput,
        }),
      );
      const result = await callOperatorBackend(
        fetchImpl,
        env,
        `/api/v1/reports/${encodeURIComponent(input.report_id)}/referrals`,
        {
          method: "POST",
          body: {
            channel_id: input.channel_id,
            request_key: requestKey,
            package: packageInput,
          },
        },
      );
      return operatorToolResult(result);
    },
  };
}

export function buildRequestReferralDispatchTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  return {
    name: "laporpak_request_referral_dispatch",
    label: "Request approved referral dispatch",
    description:
      "Ask the backend to queue one referral. The backend rejects packages without valid human approval; this tool cannot approve them.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["report_id", "referral_id"],
      properties: {
        report_id: { type: "string", pattern: UUID_PATTERN.source },
        referral_id: { type: "string", pattern: UUID_PATTERN.source },
      },
    },
    async execute(_toolCallId, input) {
      requireOperatorContext(context, env, "laporpak_request_referral_dispatch");
      const referrals = await callOperatorBackend(
        fetchImpl,
        env,
        `/api/v1/reports/${encodeURIComponent(input.report_id)}/referrals`,
      );
      const active = Array.isArray(referrals)
        ? referrals.find((item) => item.id === input.referral_id)
        : null;
      if (!active) {
        throw new Error("Referral is not available in the scoped report");
      }
      const operationKey = uuidFromFingerprint(
        stableJson({
          action: "dispatch_referral",
          referral_id: input.referral_id,
          package_version: active.active_package_version,
          package_hash: active.package_hash,
        }),
      );
      const result = await callOperatorBackend(
        fetchImpl,
        env,
        `/api/v1/referrals/${encodeURIComponent(input.referral_id)}/dispatch`,
        { method: "POST", body: { operation_key: operationKey } },
      );
      return operatorToolResult(result);
    },
  };
}

export function buildReferralProgressTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  return {
    name: "laporpak_get_referral_progress",
    label: "Get referral progress",
    description:
      "Read persisted referral progress and evidence for one report in the authenticated operator scope.",
    parameters: reportIdParameters,
    async execute(_toolCallId, input) {
      requireOperatorContext(context, env, "laporpak_get_referral_progress");
      const result = await callOperatorBackend(
        fetchImpl,
        env,
        `/api/v1/reports/${encodeURIComponent(input.report_id)}/referrals`,
      );
      return operatorToolResult(result);
    },
  };
}

export default {
  id: "laporpak-tools",
  name: "LaporPak Tools",
  description: "Citizen tools plus opt-in operator referral tools through the FastAPI boundary.",
  register(api) {
    api.on("message_received", (event, hookContext = {}) => {
      pruneMediaCache();
      const channelAccountId = hookContext.accountId?.trim() || process.env.LAPORPAK_CHANNEL_ACCOUNT_ID?.trim();
      const session = hookContext.sessionKey ?? event.sessionKey ?? event.sessionId ?? null;
      const key = channelAccountId
        ? mediaCacheKey(
            channelAccountId,
            event.senderId ?? event.from,
            session,
          )
        : "";
      const media = (event.media ?? [])
        .filter(
          (item) =>
            item.path && ALLOWED_ATTACHMENT_MIME_TYPES.has(item.contentType),
        )
        .map((item) => ({
          path: item.path,
          mimeType: item.contentType,
          messageId: item.messageId ?? event.messageId,
          receivedAt: Date.now(),
          sessionId: session,
          consumedBy: null,
        }));
      if (key && media.length > 0) {
        recentMediaBySender.set(key, media);
      }
    });
    api.registerTool((context) => buildCreateReportTool(context, globalThis.fetch, channelEnvironment(context)), {
      name: "laporpak_create_report",
      optional: true,
    });
    api.registerTool((context) => buildAskTool(context, globalThis.fetch, channelEnvironment(context)), {
      name: "laporpak_ask",
      optional: true,
    });
    api.registerTool((context) => buildTrackTool(context, globalThis.fetch, channelEnvironment(context)), {
      name: "laporpak_track_report",
      optional: true,
    });
    api.registerTool((context) => buildReportDocumentTool(context, globalThis.fetch, channelEnvironment(context)), {
      name: "laporpak_get_report_document",
      optional: true,
    });
    api.registerTool((context) => buildServiceRequestTool(context, globalThis.fetch, channelEnvironment(context)), {
      name: "laporpak_create_service_request",
      optional: true,
    });
    api.registerTool((context) => buildDetectEmergencyTool(context, globalThis.fetch, channelEnvironment(context)), {
      name: "laporpak_detect_emergency",
      optional: true,
    });
    api.registerTool((context) => buildSimilarReportsTool(context, globalThis.fetch, channelEnvironment(context)), {
      name: "laporpak_check_similar",
      optional: true,
    });
    api.registerTool((context) => buildConfirmResolutionTool(context, globalThis.fetch, channelEnvironment(context)), {
      name: "laporpak_confirm_resolution",
      optional: true,
    });
    api.registerTool((context) => buildCaseContextTool(context), {
      name: "laporpak_get_case_context",
      optional: true,
    });
    api.registerTool((context) => buildRoutingCandidatesTool(context), {
      name: "laporpak_get_routing_candidates",
      optional: true,
    });
    api.registerTool((context) => buildPrepareReferralTool(context), {
      name: "laporpak_prepare_referral",
      optional: true,
    });
    api.registerTool((context) => buildRequestReferralDispatchTool(context), {
      name: "laporpak_request_referral_dispatch",
      optional: true,
    });
    api.registerTool((context) => buildReferralProgressTool(context), {
      name: "laporpak_get_referral_progress",
      optional: true,
    });
  },
};
