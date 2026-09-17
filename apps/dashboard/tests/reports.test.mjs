import assert from "node:assert/strict";
import test from "node:test";
import { getReportById, getReports } from "../lib/reports.ts";

test("mock daftar dan detail mengikuti alur laporan", async () => {
  const firstPage = await getReports({ page: 1, page_size: 20 });
  const secondPage = await getReports({ page: 2, page_size: 20 });
  assert.equal(firstPage.items.length, 20);
  assert.equal(secondPage.items.length, 7);
  assert.equal(firstPage.total, 27);
  assert.deepEqual(Object.keys(firstPage.items[0]).sort(), [
    "category", "created_at", "description", "id", "location",
    "status", "ticket_number", "urgency",
  ]);

  const filtered = await getReports({
    page: 1,
    page_size: 20,
    status: "rejected",
    category: "administration",
    search: "LP-2026-0006",
  });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0].ticket_number, "LP-2026-0006");

  const detail = await getReportById(firstPage.items[0].id);
  assert.equal(detail?.ticket_number, firstPage.items[0].ticket_number);
  assert.equal(detail?.status_history[0].new_status, "pending_verification");
  assert.equal(await getReportById("unknown"), null);
});
