const apiUrl = process.env.LAPORPAK_API_URL?.trim();
const apiKey = process.env.LAPORPAK_API_KEY?.trim();
const geminiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";

if (!apiUrl || !apiKey || !geminiKey) {
  throw new Error(
    "LAPORPAK_API_URL, LAPORPAK_API_KEY, and GEMINI_API_KEY are required",
  );
}

function backend(path) {
  return new URL(path, `${apiUrl.replace(/\/+$/, "")}/`);
}

async function backendRequest(path, init = {}) {
  const response = await fetch(backend(path), {
    ...init,
    headers: {
      ...init.headers,
      "X-OpenClaw-API-Key": apiKey,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(60_000),
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`Backend rejected embedding job (${response.status})`);
  return result;
}

async function embed(content) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent?key=${encodeURIComponent(geminiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text: content }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: 768,
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  const result = await response.json();
  const values = result?.embedding?.values;
  if (!response.ok || !Array.isArray(values) || values.length !== 768) {
    throw new Error(`Gemini returned an invalid embedding (${response.status})`);
  }
  return values;
}

let processed = 0;
let failed = 0;
while (true) {
  const job = await backendRequest("/api/v1/tools/knowledge/embedding-jobs");
  if (!job) break;
  try {
    const embeddings = [];
    for (const chunk of job.chunks) {
      embeddings.push({ chunk_id: chunk.chunk_id, embedding: await embed(chunk.content) });
    }
    await backendRequest(
      `/api/v1/tools/knowledge/embedding-jobs/${encodeURIComponent(job.document_id)}/complete`,
      { method: "POST", body: JSON.stringify({ embeddings }) },
    );
    processed += 1;
  } catch (error) {
    await backendRequest(
      `/api/v1/tools/knowledge/embedding-jobs/${encodeURIComponent(job.document_id)}/fail`,
      {
        method: "POST",
        body: JSON.stringify({ message: String(error?.message ?? "Embedding failed").slice(0, 500) }),
      },
    );
    failed += 1;
    console.error(`Embedding job failed for ${job.document_id}`);
  }
}

console.log(`Embedding jobs completed: ${processed}; failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
