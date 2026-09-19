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
      context.sessionId ?? null,
    ),
  ) ?? [];
  const freshMedia = media.filter(
    (item) =>
      Date.now() - item.receivedAt <= MEDIA_TTL_MS &&
      (!item.sessionId || !context.sessionId || item.sessionId === context.sessionId),
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
    const code = result?.error?.code ?? "REQUEST_FAILED";
    throw new Error(`LaporPak API rejected the request (${response.status} ${code})`);
  }
  return { response, result };
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
        throw new Error("No trusted WhatsApp photo is available; ask the citizen to send it again");
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
        const code = result?.error?.code ?? "REQUEST_FAILED";
        throw new Error(`LaporPak API rejected the report (${response.status} ${code})`);
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

export function buildServiceRequestTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  return {
    name: "laporpak_create_service_request",
    label: "Create residency letter request",
    description:
      "Submit one citizen-confirmed residency-letter REQUEST. The authenticated WhatsApp sender and village are supplied by the trusted plugin runtime; human administrators make the official decision.",
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
        const code = result?.error?.code ?? "REQUEST_FAILED";
        throw new Error(
          `LaporPak API rejected the service request (${response.status} ${code})`,
        );
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

export default {
  id: "laporpak-tools",
  name: "LaporPak Tools",
  description: "ASK, REPORT, TRACK, and citizen support tools through the FastAPI boundary.",
  register(api) {
    api.on("message_received", (event) => {
      pruneMediaCache();
      const channelAccountId = process.env.LAPORPAK_CHANNEL_ACCOUNT_ID?.trim();
      const key = channelAccountId
        ? mediaCacheKey(
            channelAccountId,
            event.senderId ?? event.from,
            event.sessionId ?? null,
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
          sessionId: event.sessionId ?? null,
          consumedBy: null,
        }));
      if (key && media.length > 0) {
        recentMediaBySender.set(key, media);
      }
    });
    api.registerTool((context) => buildCreateReportTool(context), {
      name: "laporpak_create_report",
      optional: true,
    });
    api.registerTool((context) => buildAskTool(context), {
      name: "laporpak_ask",
      optional: true,
    });
    api.registerTool((context) => buildTrackTool(context), {
      name: "laporpak_track_report",
      optional: true,
    });
    api.registerTool((context) => buildServiceRequestTool(context), {
      name: "laporpak_create_service_request",
      optional: true,
    });
    api.registerTool((context) => buildDetectEmergencyTool(context), {
      name: "laporpak_detect_emergency",
      optional: true,
    });
    api.registerTool((context) => buildSimilarReportsTool(context), {
      name: "laporpak_check_similar",
      optional: true,
    });
    api.registerTool((context) => buildConfirmResolutionTool(context), {
      name: "laporpak_confirm_resolution",
      optional: true,
    });
  },
};
