import assert from "node:assert/strict";
import test from "node:test";
import { ApiRequestError, apiFetch, requestTimeoutFor } from "../lib/admin.ts";
import { safeReturnPath } from "../lib/safe-return-path.ts";

test("tujuan login hanya boleh menuju portal lokal sesuai role", () => {
  assert.equal(safeReturnPath("/reports?status=verified"), "/reports?status=verified");
  assert.equal(safeReturnPath("/reports/72af1a52-7016-48c7-aacc-000000000001"), "/reports/72af1a52-7016-48c7-aacc-000000000001");
  assert.equal(safeReturnPath("/reports/knowledge/doc-1"), "/reports/knowledge/doc-1");
  assert.equal(safeReturnPath("/admin"), "/admin");
  assert.equal(safeReturnPath("/onboarding"), "/onboarding");
  for (const input of ["//evil.example", "https://evil.example", "/reports.evil", "/reports\\evil", ["/reports"], null]) {
    assert.equal(safeReturnPath(input), "/");
  }
});

test("API client memulihkan satu respons 401 dengan token baru", async () => {
  const originalFetch = global.fetch;
  let tokenCalls = 0;
  const authorizations = [];
  global.fetch = async (url, options = {}) => {
    if (url === "/api/auth/token") {
      tokenCalls += 1;
      return Response.json({ token: tokenCalls === 1 ? "expired" : "fresh" });
    }
    authorizations.push(options.headers.Authorization);
    return authorizations.length === 1
      ? Response.json({ message: "expired" }, { status: 401 })
      : Response.json({ ok: true });
  };
  try {
    assert.deepEqual(await apiFetch("/api/v1/test-auth-retry"), { ok: true });
    assert.deepEqual(authorizations, ["Bearer expired", "Bearer fresh"]);
    assert.equal(tokenCalls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("API client menggabungkan GET identik yang masih berjalan", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return Response.json({ ok: true });
  };
  try {
    const [first, second] = await Promise.all([
      apiFetch("/api/v1/test-deduplication"),
      apiFetch("/api/v1/test-deduplication"),
    ]);
    assert.deepEqual(first, { ok: true });
    assert.deepEqual(second, { ok: true });
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("API client memakai tenggat berbeda sesuai jenis operasi", () => {
  assert.equal(requestTimeoutFor("GET"), 15_000);
  assert.equal(requestTimeoutFor("PATCH", "{}"), 30_000);
  assert.equal(requestTimeoutFor("POST", new FormData()), 60_000);
});

test("API client tidak meneruskan pesan mentah server", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => url === "/api/auth/token"
    ? Response.json({ token: "test-token" })
    : Response.json({ error: { code: "private_detail", message: "rahasia internal" } }, { status: 500 });
  try {
    await assert.rejects(
      apiFetch("/api/v1/test-safe-error", { method: "POST", body: "{}" }),
      (error) => error instanceof ApiRequestError && !error.message.includes("rahasia internal") && error.outcomeUnknown === false,
    );
  } finally {
    global.fetch = originalFetch;
  }
});
