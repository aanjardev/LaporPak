import assert from "node:assert/strict";
import test from "node:test";

import {
  createKnowledgeDocument,
  deactivateKnowledgeDocument,
  getKnowledgeDocument,
  KnowledgeApiError,
  listKnowledgeDocuments,
  updateKnowledgeDocument,
} from "../lib/knowledge.ts";

const originalFetch = globalThis.fetch;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

test("knowledge API mempertahankan status gagal tanpa membocorkan respons internal", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  for (const status of [401, 403, 404, 422, 503]) {
    globalThis.fetch = async () => new Response("internal connection details", { status });
    await assert.rejects(
      getKnowledgeDocument("doc-1", "test-token"),
      (error) => error instanceof KnowledgeApiError
        && error.status === status
        && !error.message.includes("internal connection details"),
    );
  }
});

test("knowledge API meneruskan token, metode, dan payload; DELETE 204 berhasil", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return init.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({ items: [] });
  };

  assert.deepEqual(await listKnowledgeDocuments("test-token"), { items: [] });
  const payload = new FormData();
  payload.set("title", "SOP uji");
  await createKnowledgeDocument(payload, "test-token");
  await updateKnowledgeDocument("doc-1", { title: "SOP revisi" }, "test-token");
  assert.equal(await deactivateKnowledgeDocument("doc-1", "test-token"), undefined);

  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ init }) => init.headers.Authorization === "Bearer test-token"));
  assert.equal(calls[0].url, "http://localhost:8000/api/v1/knowledge/documents");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.body.get("title"), "SOP uji");
  assert.equal(calls[1].init.headers["Content-Type"], undefined);
  assert.equal(calls[2].init.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[2].init.body), { title: "SOP revisi" });
  assert.equal(calls[3].init.method, "DELETE");
});

test("knowledge API mempertahankan data daftar dan detail dari API simulasi", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  const document = {
    id: "doc-1",
    title: "SOP " + "A".repeat(180),
    category: "sop",
    content: "# Panduan\n" + "Isi panjang. ".repeat(100),
    service_key: "office_hours",
  };
  globalThis.fetch = async (url) => Response.json(
    String(url).endsWith("/doc-1") ? document : { items: [document] },
  );
  assert.equal((await listKnowledgeDocuments("test-token")).items[0].title, document.title);
  assert.equal((await getKnowledgeDocument("doc-1", "test-token")).content, document.content);

  globalThis.fetch = async () => Response.json({ items: [] });
  assert.deepEqual((await listKnowledgeDocuments("test-token")).items, []);
});

test("knowledge API meneruskan kegagalan jaringan sebagai kegagalan layanan", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  globalThis.fetch = async () => { throw new TypeError("network unavailable"); };
  await assert.rejects(listKnowledgeDocuments("test-token"), TypeError);
});
