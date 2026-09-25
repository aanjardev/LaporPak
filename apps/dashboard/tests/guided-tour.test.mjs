import assert from "node:assert/strict";
import test from "node:test";
import { availableSteps, introSteps, pageGuide, pageGuideScope, pageTourStorageKey, tourStorageKey } from "../lib/guided-tour.ts";

test("tur awal khusus Admin Desa menyesuaikan layar dan status aktivasi", () => {
  const desktop = introSteps(true, false);
  const mobile = introSteps(false, true);
  assert.equal(desktop.length, 6);
  assert.equal(mobile.length, 3);
  assert.match(mobile[0].body, /Lengkapi Pengaturan Akun/);
  assert.equal(mobile[1].target, '[data-guide="mobile-menu"]');
  assert.notEqual(tourStorageKey("akun-a"), tourStorageKey("akun-b"));
});

test("panduan mengikuti halaman dan melewati target yang tidak tersedia", () => {
  const report = pageGuide("/reports/contoh", true, true);
  const targets = report.steps.map((step) => step.target);
  assert.ok(targets.includes('[data-guide="report-documents"]'));
  assert.ok(targets.includes('[data-guide="report-decision"]'));
  assert.deepEqual(availableSteps(report.steps, (selector) => selector !== '[data-guide="report-decision"]').map((step) => step.title).includes("Aksi petugas"), false);
  assert.equal(pageGuide("/reports/settings/knowledge/contoh", true, true).title, "Detail Sumber ASK");
  assert.equal(pageGuide("/reports/settings", false, false).steps.at(-1).title, "Aktivasi desa");
  assert.equal(pageGuide("/reports/dashboard", false, false).steps[0].target, '[data-guide="dashboard-inactive"]');
});

test("panduan otomatis disimpan per akun dan jenis halaman, bukan per tiket", () => {
  const reportA = pageGuideScope("/reports/tiket-a", true, true);
  const reportB = pageGuideScope("/reports/tiket-b", true, true);
  assert.equal(reportA?.id, "report-detail");
  assert.equal(reportB?.id, reportA.id);
  assert.equal(reportA.readyTarget, '[data-guide="report-info"]');
  assert.equal(pageGuideScope("/reports/dashboard", false, true)?.id, "dashboard-inactive");
  assert.equal(pageGuideScope("/reports/dashboard", true, true)?.id, "dashboard-active");
  assert.equal(pageGuideScope("/reports/settings/knowledge", true, false), null);
  assert.notEqual(pageTourStorageKey("akun-a", "report-detail"), pageTourStorageKey("akun-a", "request-detail"));
  assert.notEqual(pageTourStorageKey("akun-a", "report-detail"), pageTourStorageKey("akun-b", "report-detail"));
});
