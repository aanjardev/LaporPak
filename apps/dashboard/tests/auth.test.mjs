import assert from "node:assert/strict";
import test from "node:test";
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
