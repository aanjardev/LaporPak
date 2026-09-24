import assert from "node:assert/strict";
import test from "node:test";
import { reportsDataSource } from "../lib/reports-data-source.ts";
import { contentSecurityPolicy } from "../lib/security-headers.ts";
import { updateReportStatus } from "../lib/reports.ts";

test("production cannot return simulated mutation success or use missing configuration", async (t) => {
  const saved = { ...process.env };
  t.after(() => { process.env = saved; });
  process.env.NODE_ENV = "production";
  process.env.VERCEL_ENV = "production";
  for (const source of ["", "mock", "invalid"]) {
    process.env.REPORTS_DATA_SOURCE = source;
    assert.throws(reportsDataSource);
    await assert.rejects(updateReportStatus("72af1a52-7016-48c7-aacc-000000000001", { status: "verified", reason: "test" }));
  }
  process.env.REPORTS_DATA_SOURCE = "api";
  assert.equal(reportsDataSource(), "api");
  process.env.REPORTS_DATA_SOURCE = "mock";
  process.env.VERCEL_ENV = "preview";
  assert.equal(reportsDataSource(), "mock");
});

test("CSP allows nonce scripts but denies embedding and plugins", (t) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  const policy = contentSecurityPolicy("test-nonce");
  assert.match(policy, /script-src 'self' 'nonce-test-nonce' 'strict-dynamic'/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "form-action 'self'", "base-uri 'self'"]) assert.ok(policy.includes(directive));
});
