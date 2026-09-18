#!/usr/bin/env node
/**
 * FTS Recall Tester
 *
 * Test knowledge base retrieval with different query patterns.
 * Measures recall@5 for the target ≥90%.
 *
 * Usage:
 *   node evals/fts-recall.js
 *   node evals/fts-recall.js --verbose
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load knowledge base schema
function loadKnowledgeBase() {
  // Simulated retrieval test cases
  // In production, these would hit the actual API
  return [
    // ASK: Office Hours
    {
      query: "kapan kantor buka",
      expected_keys: ["office_hours"],
      category: "ASK"
    },
    {
      query: "jam pelayanan",
      expected_keys: ["office_hours"],
      category: "ASK"
    },
    {
      query: "hari kerja",
      expected_keys: ["office_hours"],
      category: "ASK"
    },
    {
      query: "besok buka nggak",
      expected_keys: ["office_hours"],
      category: "ASK"
    },

    // ASK: KTP
    {
      query: "bikin KTP baru",
      expected_keys: ["ktp_new"],
      category: "ASK"
    },
    {
      query: " KTP hilang",
      expected_keys: ["ktp_replacement"],
      category: "ASK"
    },
    {
      query: "KTP rusak",
      expected_keys: ["ktp_replacement", "ktp_change"],
      category: "ASK"
    },
    {
      query: "nama beda di dokumen",
      expected_keys: ["ktp_change"],
      category: "ASK"
    },

    // ASK: Surat Pengantar
    {
      query: "surat pengantar",
      expected_keys: ["surat_pengantar"],
      category: "ASK"
    },
    {
      query: "minta surat RT",
      expected_keys: ["surat_pengantar"],
      category: "ASK"
    },

    // ASK: Waste
    {
      query: "sampah",
      expected_keys: ["waste_report"],
      category: "ASK"
    },
    {
      query: "tumpukan sampah",
      expected_keys: ["waste_report"],
      category: "ASK"
    },
    {
      query: "TPS",
      expected_keys: ["waste_report", "istilah_sampah"],
      category: "ASK"
    },

    // ASK: Drainage
    {
      query: "got mampet",
      expected_keys: ["drainage_report"],
      category: "ASK"
    },
    {
      query: "selokan",
      expected_keys: ["drainage_report"],
      category: "ASK"
    },
    {
      query: "genangan air",
      expected_keys: ["drainage_report"],
      category: "ASK"
    },

    // ASK: Road
    {
      query: "jalan rusak",
      expected_keys: ["road_report"],
      category: "ASK"
    },
    {
      query: "lubang di jalan",
      expected_keys: ["road_report"],
      category: "ASK"
    },
    {
      query: "aspal rusak",
      expected_keys: ["road_report"],
      category: "ASK"
    },

    // ASK: Glossary
    {
      query: "apa itu RT",
      expected_keys: ["istilah_wilayah"],
      category: "ASK"
    },
    {
      query: "RW singkatan apa",
      expected_keys: ["istilah_wilayah"],
      category: "ASK"
    },
    {
      query: "FC artinya",
      expected_keys: ["istilah_admin"],
      category: "ASK"
    },

    // ASK: Status
    {
      query: "cara cek status laporan",
      expected_keys: ["track"],
      category: "ASK"
    },
    {
      query: "pending artinya",
      expected_keys: ["status_info"],
      category: "ASK"
    },
    {
      query: "selesai",
      expected_keys: ["status_info"],
      category: "ASK"
    },

    // ASK: Bukan Desa
    {
      query: "bansos",
      expected_keys: ["bukan_desa"],
      category: "ASK"
    },
    {
      query: "passport",
      expected_keys: ["bukan_desa"],
      category: "ASK"
    },
    {
      query: "urus tanah",
      expected_keys: ["bukan_desa"],
      category: "ASK"
    },

    // Unknown (no match expected)
    {
      query: "cuaca hari ini",
      expected_keys: [],
      category: "UNKNOWN"
    },
    {
      query: "resep rendang",
      expected_keys: [],
      category: "UNKNOWN"
    },

    // Edge cases - Regional terms
    {
      query: "parit",
      expected_keys: ["drainage_report", "istilah_drainase"],
      category: "ASK"
    },
    {
      query: "siring",
      expected_keys: ["drainage_report", "istilah_drainase"],
      category: "ASK"
    },
    {
      query: "mubazir",
      expected_keys: ["waste_report", "istilah_sampah"],
      category: "ASK"
    },

    // Edge cases - Mixed language
    {
      query: "bikin KTP baru dong",
      expected_keys: ["ktp_new"],
      category: "ASK"
    },
    {
      query: "where to bikin KTP",
      expected_keys: ["ktp_new"],
      category: "ASK"
    },
  ];
}

// Simulate FTS retrieval (mock)
function simulateRetrieval(query) {
  const knowledgeBase = [
    { service_key: "office_hours", aliases: ["kantor buka","jam pelayanan","hari kerja","jam kerja","buka jam","tutup jam","besok buka"] },
    { service_key: "ktp_new", aliases: ["ktp baru","bikin ktp","buat ktp","cetak ktp"] },
    { service_key: "ktp_replacement", aliases: ["ktp hilang","ktp rusak","ganti ktp"] },
    { service_key: "ktp_change", aliases: ["perubahan ktp","beda nama","nama beda","salah nama","data berbeda"] },
    { service_key: "surat_pengantar", aliases: ["surat pengantar","surat pengantar rt","minta surat"] },
    { service_key: "waste_report", aliases: ["sampah","tumpukan sampah","tps","buang sampah"] },
    { service_key: "drainage_report", aliases: ["got mampet","selokan mampet","selokan","drainase","genangan"] },
    { service_key: "road_report", aliases: ["jalan rusak","jalan berlubang","lubang di jalan","aspal rusak"] },
    { service_key: "streetlight_report", aliases: ["lampu jalan","pju","penerangan jalan"] },
    { service_key: "istilah_wilayah", aliases: ["rt","rw","dusun","rukun tetangga"] },
    { service_key: "istilah_drainase", aliases: ["got","selokan","siring","parit"] },
    { service_key: "istilah_sampah", aliases: ["tps","tpa","tempat sampah","mubazir"] },
    { service_key: "istilah_admin", aliases: ["fc","fotocopy","kk","ktp","nik"] },
    { service_key: "track", aliases: ["cek status","status laporan","laporan saya"] },
    { service_key: "status_info", aliases: ["menunggu verifikasi","terverifikasi","selesai","pending"] },
    { service_key: "bukan_desa", aliases: ["passport","sim","tanah","bansos"] },
  ];

  // Simple mock: check if query contains any alias
  const queryLower = query.toLowerCase();
  const matches = [];

  for (const kb of knowledgeBase) {
    for (const alias of kb.aliases) {
      if (queryLower.includes(alias.toLowerCase())) {
        matches.push(kb.service_key);
        break;
      }
    }
  }

  return matches.slice(0, 5);
}

// Test single query
function testQuery(testCase, verbose = false) {
  const retrieved = simulateRetrieval(testCase.query);
  const hasMatch = testCase.expected_keys.some(key => retrieved.includes(key));

  const result = {
    query: testCase.query,
    expected: testCase.expected_keys,
    retrieved: retrieved,
    passed: hasMatch || testCase.expected_keys.length === 0,
    category: testCase.category,
  };

  if (verbose) {
    const status = result.passed ? '✅' : '❌';
    console.log(`  ${status} "${testCase.query}"`);
    console.log(`     Expected: ${testCase.expected_keys.join(', ') || 'none'}`);
    console.log(`     Retrieved: ${retrieved.join(', ') || 'none'}`);
  }

  return result;
}

// Main
function main() {
  const verbose = process.argv.includes('--verbose');
  const testCases = loadKnowledgeBase();

  console.log('🔍 FTS Recall Test\n');
  console.log(`Testing ${testCases.length} query patterns...\n`);

  const results = [];
  for (const tc of testCases) {
    results.push(testQuery(tc, verbose));
  }

  // Summary
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed);
  const recall = (passed / total) * 100;

  console.log('\n📊 Summary\n');
  console.log(`Total queries: ${total}`);
  console.log(`Passed: ${passed} (${recall.toFixed(1)}%)`);
  console.log(`Failed: ${failed.length} (${(100 - recall).toFixed(1)}%)`);

  // By category
  console.log('\n📈 By Category\n');
  const byCategory = {};
  for (const r of results) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { total: 0, passed: 0 };
    }
    byCategory[r.category].total++;
    if (r.passed) byCategory[r.category].passed++;
  }

  for (const [cat, stats] of Object.entries(byCategory)) {
    const pct = (stats.passed / stats.total * 100).toFixed(1);
    console.log(`  ${cat}: ${stats.passed}/${stats.total} (${pct}%)`);
  }

  // Target check
  console.log('\n🎯 Target: recall@5 ≥90%\n');
  if (recall >= 90) {
    console.log(`✅ PASSED: ${recall.toFixed(1)}% meets target`);
  } else {
    console.log(`❌ BELOW TARGET: ${recall.toFixed(1)}% (need ${(90 - recall).toFixed(1)}% more)`);
  }

  // Failed details
  if (failed.length > 0 && !verbose) {
    console.log('\n❌ Failed Queries:\n');
    for (const f of failed) {
      console.log(`  - "${f.query}"`);
      console.log(`    Expected: ${f.expected.join(', ')}`);
      console.log(`    Retrieved: ${f.retrieved.join(', ') || 'none'}`);
    }
  }

  // Recommendations
  console.log('\n💡 Recommendations:\n');
  const missingAliases = new Set();
  for (const f of failed) {
    for (const key of f.expected) {
      missingAliases.add(key);
    }
  }

  if (missingAliases.size > 0) {
    console.log('Add these aliases to improve recall:');
    for (const key of missingAliases) {
      console.log(`  - ${key}`);
    }
  } else {
    console.log('All test queries pass!');
  }

  console.log('\n✨ Done!');
}

main();
