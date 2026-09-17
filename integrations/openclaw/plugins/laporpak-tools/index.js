const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parameters = {
  type: "object",
  additionalProperties: false,
  required: [
    "report_draft_id",
    "category",
    "description",
    "location",
    "original_text",
    "confidence",
  ],
  properties: {
    report_draft_id: {
      type: "string",
      format: "uuid",
      description: "Stable UUID for this report draft. Reuse it for retries.",
    },
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

function reportEndpoint(value) {
  const url = new URL("/api/v1/reports", `${value.replace(/\/+$/, "")}/`);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("LAPORPAK_API_URL must use http or https");
  }
  return url;
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function buildCreateReportTool(
  context,
  fetchImpl = globalThis.fetch,
  env = process.env,
) {
  return {
    name: "laporpak_create_report",
    label: "Create LaporPak report",
    description:
      "Create one confirmed WhatsApp REPORT. Call only after category, description, and location are complete and the citizen confirms submission.",
    parameters,
    async execute(_toolCallId, input) {
      if (context.messageChannel !== "whatsapp") {
        throw new Error("laporpak_create_report requires an authenticated WhatsApp sender");
      }
      if (!context.requesterSenderId) {
        throw new Error("Authenticated WhatsApp sender identity is unavailable");
      }
      if (!UUID_PATTERN.test(input.report_draft_id)) {
        throw new Error("report_draft_id must be a UUID");
      }

      const apiUrl = env.LAPORPAK_API_URL?.trim();
      const apiKey = env.LAPORPAK_API_KEY?.trim();
      if (!apiUrl || !apiKey) {
        throw new Error("LaporPak API environment is not configured");
      }

      const locationComplete =
        (typeof input.location.text === "string" && input.location.text.trim()) ||
        (input.location.latitude !== null && input.location.longitude !== null);
      if (!locationComplete) {
        throw new Error("Report location is incomplete");
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
      };
      if (context.sessionId && UUID_PATTERN.test(context.sessionId)) {
        body.conversation_id = context.sessionId;
      }

      const response = await fetchImpl(reportEndpoint(apiUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": input.report_draft_id,
          "X-OpenClaw-API-Key": apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await responseJson(response);
      if (!response.ok) {
        const code = result?.error?.code ?? "REQUEST_FAILED";
        throw new Error(`LaporPak API rejected the report (${response.status} ${code})`);
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

export default {
  id: "laporpak-tools",
  name: "LaporPak Tools",
  description: "Create confirmed LaporPak reports through the FastAPI boundary.",
  register(api) {
    api.registerTool((context) => buildCreateReportTool(context), {
      name: "laporpak_create_report",
      optional: true,
    });
  },
};
