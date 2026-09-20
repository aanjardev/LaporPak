import assert from "node:assert/strict";
import test from "node:test";

import {
  createReceiptDocument,
  getReportDocuments,
  retryReportDocument,
  reviseReportDocument,
  revokeReportDocument,
} from "../lib/report-documents.ts";
import { uploadVillageLogo } from "../lib/villages.ts";

const reportId = "72af1a52-7016-48c7-aacc-6c35417be819";
const documentId = "8ee0a6d8-e581-4d5c-bcc3-26110c5f50b5";

test("dashboard memakai endpoint dokumen dan menjaga unggahan logo sebagai multipart", async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    if (url === "/api/auth/token") return Response.json({ token: "admin-token" });
    requests.push({ url: String(url), options });
    if (String(url).endsWith("/documents")) return Response.json({ items: [] });
    return Response.json({
      id: documentId,
      document_type: "receipt",
      version: 1,
      status: "pending",
      delivery_status: "pending",
      created_at: "2026-09-20T08:00:00Z",
    });
  };
  try {
    await getReportDocuments(reportId);
    await createReceiptDocument(reportId);
    await retryReportDocument(reportId, documentId);
    await reviseReportDocument(reportId, "receipt", "Koreksi lokasi");
    await revokeReportDocument(reportId, documentId, "Dokumen salah");
    await uploadVillageLogo(
      "00000000-0000-4000-8000-000000000002",
      new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" }),
    );

    assert.equal(requests.length, 6);
    assert.ok(requests.every(({ options }) => options.headers.Authorization === "Bearer admin-token"));
    assert.match(requests[1].url, /\/documents\/receipt$/);
    assert.match(requests[2].url, /\/retry$/);
    assert.deepEqual(JSON.parse(requests[3].options.body), { document_type: "receipt", reason: "Koreksi lokasi" });
    assert.match(requests[4].url, /\/revoke$/);
    assert.ok(requests[5].options.body instanceof FormData);
    assert.equal(requests[5].options.headers["Content-Type"], undefined);
  } finally {
    global.fetch = originalFetch;
  }
});
