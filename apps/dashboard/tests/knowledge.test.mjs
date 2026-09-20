import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  createKnowledgeDocument,
  deactivateKnowledgeDocument,
  getKnowledgeDocument,
  KnowledgeApiError,
  listKnowledgeDocuments,
  reviewKnowledgeDocument,
  updateKnowledgeDocument,
} from "../lib/knowledge.ts";
import { knowledgeDetailPath, knowledgeSettingsPath, legacyKnowledgeRedirect } from "../lib/knowledge-route.ts";
import { internalNavigationTarget } from "../lib/unsaved-navigation.ts";

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
  await reviewKnowledgeDocument("doc-1", { status: "approved", reason: "Reviewed" }, "test-token");
  assert.equal(await deactivateKnowledgeDocument("doc-1", "test-token"), undefined);

  assert.equal(calls.length, 5);
  assert.ok(calls.every(({ init }) => init.headers.Authorization === "Bearer test-token"));
  assert.equal(calls[0].url, "http://localhost:8000/api/v1/knowledge/documents");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.body.get("title"), "SOP uji");
  assert.equal(calls[1].init.headers["Content-Type"], undefined);
  assert.equal(calls[2].init.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[2].init.body), { title: "SOP revisi" });
  assert.equal(calls[3].url, "http://localhost:8000/api/v1/knowledge/documents/doc-1/review");
  assert.deepEqual(JSON.parse(calls[3].init.body), { status: "approved", reason: "Reviewed" });
  assert.equal(calls[4].init.method, "DELETE");
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

test("Sumber ASK memakai route pengaturan dan redirect lama menjaga feedback", () => {
  assert.equal(knowledgeSettingsPath, "/reports/settings/knowledge");
  assert.equal(knowledgeDetailPath("doc / satu"), "/reports/settings/knowledge/doc%20%2F%20satu");
  assert.equal(
    legacyKnowledgeRedirect(null, { saved: "1", ignored: "private" }),
    "/reports/settings/knowledge?saved=1",
  );
  assert.equal(
    legacyKnowledgeRedirect("doc-1", { reviewed: "1", error: "invalid" }),
    "/reports/settings/knowledge/doc-1?reviewed=1&error=invalid",
  );
  const navigation = readFileSync(new URL("../components/reports-nav.tsx", import.meta.url), "utf8");
  const tabs = readFileSync(new URL("../app/reports/settings/settings-tabs.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(navigation, /Sumber ASK/);
  assert.match(tabs, /Sumber ASK/);
  assert.match(tabs, /aria-current/);
});

test("penjaga perubahan hanya menahan navigasi internal yang berpindah halaman", () => {
  const current = "http://localhost:3000/reports/settings?tab=account";
  assert.equal(internalNavigationTarget(current, "/reports/settings/knowledge"), "/reports/settings/knowledge");
  assert.equal(internalNavigationTarget(current, current), null);
  assert.equal(internalNavigationTarget(current, "https://example.com/help"), null);
});
