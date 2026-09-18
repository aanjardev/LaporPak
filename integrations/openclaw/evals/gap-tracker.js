#!/usr/bin/env node
/**
 * Knowledge Gap Tracker v2.0
 *
 * Track unanswered questions, analyze patterns, and prioritize knowledge base expansion.
 *
 * Usage:
 *   node gap-tracker.js --add "pertanyaan warga" [service_key]
 *   node gap-tracker.js --list [--pending] [--by-priority]
 *   node gap-tracker.js --export [--format markdown|json]
 *   node gap-tracker.js --analyze
 *   node gap-tracker.js --resolve <id> [notes]
 *   node gap-tracker.js --bulk-add <file.json>
 *   node gap-tracker.js --stats
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'knowledge-gaps.json');
const ANALYSIS_FILE = join(__dirname, 'gap-analysis.json');

const args = process.argv.slice(2);

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Load existing gaps
function loadGaps() {
  if (!existsSync(DATA_FILE)) {
    return {
      gaps: [],
      metadata: {
        version: '0.2.0',
        lastUpdated: new Date().toISOString(),
        totalQuestions: 0,
      },
    };
  }
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

// Save gaps
function saveGaps(data) {
  data.metadata.lastUpdated = new Date().toISOString();
  data.metadata.totalQuestions = data.gaps.length;
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Generate unique ID
function generateId() {
  return `gap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Detect potential service key from question
function detectServiceKey(question) {
  const patterns = {
    office_hours: ['kantor', 'buka', 'jam', 'pelayanan', 'hari kerja', 'libur'],
    ktp_new: ['ktp baru', 'bikin ktp', 'buat ktp', 'cetak ktp', 'ktp pertama'],
    ktp_replacement: ['ktp hilang', 'ktp rusak', 'ganti ktp', 'surat hilang'],
    ktp_change: ['nama beda', 'salah nama', 'perubahan ktp', 'alamat salah'],
    surat_pengantar: ['surat pengantar', 'minta surat', 'surat rt', 'fc dokumen'],
    kk: ['kk baru', 'bikin kk', 'keluarga', 'bayi lahir', 'nikah'],
    waste_report: ['sampah', 'tps', 'buang sampah', 'tumpukan'],
    drainage_report: ['got', 'selokan', 'drainase', 'air meluap', 'genangan'],
    road_report: ['jalan rusak', 'lubang', 'aspal', 'kerusakan jalan'],
    streetlight_report: ['lampu jalan', 'pju', 'penerangan'],
    bukan_desa: ['passport', 'sim', 'tanah', 'bansos', 'bpjs', 'kesehatan'],
    track: ['cek status', 'laporan saya', 'tracking'],
    status_info: ['pending', 'verifikasi', 'selesai', 'artinya'],
    glossary: ['apa itu', 'artinya', 'definisi', 'pengertian'],
  };

  const q = question.toLowerCase();
  for (const [key, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => q.includes(kw))) {
      return key;
    }
  }
  return null;
}

// Auto-prioritize based on question type
function autoPrioritize(question, serviceKey) {
  const highPriority = ['emergency', 'urgent', 'penting', 'segera'];
  const mediumPriority = ['ktp', 'kk', 'surat', 'administrasi'];

  const q = question.toLowerCase();

  if (highPriority.some(kw => q.includes(kw))) return 'high';
  if (mediumPriority.some(kw => q.includes(kw))) return 'medium';
  if (serviceKey?.includes('report')) return 'medium';
  return 'low';
}

// Add new gap
function addGap(question, serviceKey = null, source = 'user_interaction') {
  const data = loadGaps();

  // Normalize question
  const normalizedQuestion = question.trim().toLowerCase();

  // Check for duplicate (similar question)
  const exists = data.gaps.some(g => {
    const existing = g.question.toLowerCase();
    return existing === normalizedQuestion ||
      (existing.includes(normalizedQuestion) || normalizedQuestion.includes(existing));
  });

  if (exists) {
    log(`⚠️ Similar gap already exists`, 'yellow');
    return;
  }

  const detectedKey = serviceKey || detectServiceKey(question);
  const priority = autoPrioritize(question, detectedKey);

  const gap = {
    id: generateId(),
    question: question.trim(),
    service_key: detectedKey,
    source,
    created_at: new Date().toISOString(),
    status: 'pending',
    priority,
    frequency: 1,
    notes: '',
    suggested_answer: '',
  };

  data.gaps.push(gap);
  saveGaps(data);

  log(`✅ Gap added:`, 'green');
  log(`   Question: ${question}`);
  log(`   Service Key: ${detectedKey || 'unknown'}`);
  log(`   Priority: ${priority}`);
}

// Bulk add from JSON file
function bulkAdd(filepath) {
  if (!existsSync(filepath)) {
    log(`❌ File not found: ${filepath}`, 'red');
    return;
  }

  const content = readFileSync(filepath, 'utf-8');
  const items = JSON.parse(content);

  if (!Array.isArray(items)) {
    log('❌ JSON must be an array of questions', 'red');
    return;
  }

  let added = 0;
  for (const item of items) {
    if (typeof item === 'string') {
      addGap(item);
      added++;
    } else if (item.question) {
      addGap(item.question, item.service_key, item.source || 'bulk_import');
      added++;
    }
  }

  log(`\n✅ Added ${added} gaps from ${filepath}`, 'green');
}

// List gaps with filters
function listGaps(filter = null, sortBy = 'priority') {
  const data = loadGaps();
  let gaps = [...data.gaps];

  // Filter
  if (filter === 'pending') {
    gaps = gaps.filter(g => g.status === 'pending');
  } else if (filter === 'resolved') {
    gaps = gaps.filter(g => g.status === 'resolved');
  } else if (filter === 'high') {
    gaps = gaps.filter(g => g.priority === 'high' && g.status === 'pending');
  }

  // Sort
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => {
    if (sortBy === 'priority') {
      return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    } else if (sortBy === 'frequency') {
      return (b.frequency || 1) - (a.frequency || 1);
    } else if (sortBy === 'date') {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    return 0;
  });

  // Stats
  const byStatus = { pending: 0, resolved: 0 };
  const byPriority = { high: 0, medium: 0, low: 0 };
  for (const g of data.gaps) {
    byStatus[g.status] = (byStatus[g.status] || 0) + 1;
    byPriority[g.priority] = (byPriority[g.priority] || 0) + 1;
  }

  console.log('\n📚 Knowledge Gap Tracker v2.0\n');
  log(`Total: ${data.gaps.length} gaps`, 'blue');
  console.log('');
  console.log(`  Pending: ${byStatus.pending || 0}`);
  console.log(`  Resolved: ${byStatus.resolved || 0}`);
  console.log('');
  console.log(`  High Priority: ${byPriority.high || 0}`);
  console.log(`  Medium: ${byPriority.medium || 0}`);
  console.log(`  Low: ${byPriority.low || 0}`);
  console.log('');

  if (gaps.length === 0) {
    log('  No gaps to display', 'green');
    return;
  }

  console.log('─'.repeat(60));
  console.log(`Showing ${gaps.length} gaps:`);
  console.log('─'.repeat(60));

  for (const gap of gaps) {
    const statusIcon = gap.status === 'resolved' ? '✅' : '⏳';
    const priorityColor = gap.priority === 'high' ? 'red' : gap.priority === 'medium' ? 'yellow' : 'blue';
    const priorityBadge = `[${gap.priority.toUpperCase()}]`;

    console.log(`\n${statusIcon} ${gap.id}`);
    console.log(`   Question: ${gap.question}`);
    console.log(`   Service: ${gap.service_key || 'unknown'} ${colors[priorityColor]}${priorityBadge}${colors.reset}`);
    console.log(`   Frequency: ${gap.frequency || 1}x`);
    console.log(`   Created: ${new Date(gap.created_at).toLocaleDateString('id-ID')}`);

    if (gap.notes) {
      console.log(`   Notes: ${gap.notes}`);
    }
    if (gap.suggested_answer) {
      console.log(`   Suggested: ${gap.suggested_answer.substring(0, 50)}...`);
    }
  }
}

// Analyze gaps for patterns
function analyzeGaps() {
  const data = loadGaps();
  const pending = data.gaps.filter(g => g.status === 'pending');

  if (pending.length === 0) {
    log('✅ No pending gaps to analyze', 'green');
    return;
  }

  // Group by service key
  const byService = {};
  for (const gap of pending) {
    const key = gap.service_key || 'uncategorized';
    if (!byService[key]) {
      byService[key] = { count: 0, questions: [], priority: 'low' };
    }
    byService[key].count++;
    byService[key].questions.push(gap.question);

    // Update priority if any question is high
    if (gap.priority === 'high') {
      byService[key].priority = 'high';
    } else if (gap.priority === 'medium' && byService[key].priority !== 'high') {
      byService[key].priority = 'medium';
    }
  }

  // Sort by count
  const sorted = Object.entries(byService).sort((a, b) => b[1].count - a[1].count);

  // Generate recommendations
  const recommendations = [];
  for (const [service, info] of sorted) {
    recommendations.push({
      service_key: service,
      gap_count: info.count,
      priority: info.priority,
      action: info.count >= 3 ? 'CREATE_CHUNK' : 'ADD_ALIASES',
      questions: info.questions,
    });
  }

  // Save analysis
  const analysis = {
    timestamp: new Date().toISOString(),
    total_gaps: pending.length,
    by_service: sorted.map(([k, v]) => ({ service: k, count: v.count, priority: v.priority })),
    recommendations,
    high_priority_gaps: pending.filter(g => g.priority === 'high').map(g => g.question),
  };

  writeFileSync(ANALYSIS_FILE, JSON.stringify(analysis, null, 2));

  // Display
  console.log('\n📊 Gap Analysis\n');
  console.log(`Analyzed ${pending.length} pending gaps\n`);

  console.log('By Service Key:');
  console.log('─'.repeat(60));
  for (const [service, info] of sorted) {
    const badge = info.priority === 'high' ? '🔴' : info.priority === 'medium' ? '🟡' : '🟢';
    console.log(`  ${badge} ${service}: ${info.count} gaps`);
  }

  console.log('\nRecommendations:');
  console.log('─'.repeat(60));
  for (const rec of recommendations) {
    const action = rec.action === 'CREATE_CHUNK' ? '📝 Create new chunk' : '🔗 Add aliases';
    console.log(`\n  ${rec.service_key} (${rec.priority} priority):`);
    console.log(`     ${action}`);
    console.log(`     Questions: ${rec.gap_count}`);
  }

  log(`\n📄 Analysis saved to: ${ANALYSIS_FILE}`, 'green');
}

// Export gaps
function exportGaps(format = 'markdown') {
  const data = loadGaps();
  const pending = data.gaps.filter(g => g.status === 'pending');
  const byService = {};

  for (const gap of pending) {
    const key = gap.service_key || 'uncategorized';
    if (!byService[key]) byService[key] = [];
    byService[key].push(gap);
  }

  if (format === 'json') {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalGaps: pending.length,
      byService,
      highPriority: pending.filter(g => g.priority === 'high'),
    };
    console.log(JSON.stringify(exportData, null, 2));
  } else {
    // Markdown format
    console.log('\n# Knowledge Gap Report\n');
    console.log(`**Generated:** ${new Date().toLocaleString('id-ID')}`);
    console.log(`**Total Pending Gaps:** ${pending.length}\n`);
    console.log('## Priority Summary\n');

    const high = pending.filter(g => g.priority === 'high');
    const medium = pending.filter(g => g.priority === 'medium');
    const low = pending.filter(g => g.priority === 'low');

    console.log(`- 🔴 High: ${high.length}`);
    console.log(`- 🟡 Medium: ${medium.length}`);
    console.log(`- 🟢 Low: ${low.length}`);

    console.log('\n## Gaps by Service Key\n');

    for (const [service, gaps] of Object.entries(byService)) {
      console.log(`### ${service} (${gaps.length} gaps)\n`);
      for (const gap of gaps) {
        const badge = gap.priority === 'high' ? '🔴' : gap.priority === 'medium' ? '🟡' : '🟢';
        console.log(`${badge} ${gap.question}`);
        console.log(`   - ID: ${gap.id}`);
        console.log(`   - Created: ${gap.created_at}`);
        if (gap.notes) console.log(`   - Notes: ${gap.notes}`);
        console.log('');
      }
    }

    console.log('## Recommended Actions\n');
    console.log('1. Create knowledge chunks for high-frequency gaps');
    console.log('2. Add aliases for common question phrasings');
    console.log('3. Expand existing chunks with related topics');
    console.log('4. Review high-priority gaps for urgent coverage');
  }
}

// Update gap status
function updateStatus(id, status, notes = '', suggestedAnswer = '') {
  const data = loadGaps();
  const gap = data.gaps.find(g => g.id === id);

  if (!gap) {
    log(`❌ Gap not found: ${id}`, 'red');
    return;
  }

  const oldStatus = gap.status;
  gap.status = status;
  if (notes) gap.notes = notes;
  if (suggestedAnswer) gap.suggested_answer = suggestedAnswer;
  gap.updated_at = new Date().toISOString();
  gap.resolved_at = status === 'resolved' ? new Date().toISOString() : null;

  saveGaps(data);
  log(`✅ Gap ${id} updated: ${oldStatus} → ${status}`, 'green');
}

// Show statistics
function showStats() {
  const data = loadGaps();

  const total = data.gaps.length;
  const pending = data.gaps.filter(g => g.status === 'pending').length;
  const resolved = data.gaps.filter(g => g.status === 'resolved').length;

  const byPriority = { high: 0, medium: 0, low: 0 };
  const byService = {};
  const byMonth = {};

  for (const gap of data.gaps) {
    byPriority[gap.priority] = (byPriority[gap.priority] || 0) + 1;
    const key = gap.service_key || 'unknown';
    byService[key] = (byService[key] || 0) + 1;
    const month = gap.created_at.substring(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;
  }

  console.log('\n📈 Knowledge Gap Statistics\n');
  console.log(`Total Gaps: ${total}`);
  console.log(`  Pending: ${pending}`);
  console.log(`  Resolved: ${resolved}`);
  console.log(`  Resolution Rate: ${total > 0 ? ((resolved / total) * 100).toFixed(1) : 0}%`);

  console.log('\nBy Priority:');
  console.log(`  🔴 High: ${byPriority.high || 0}`);
  console.log(`  🟡 Medium: ${byPriority.medium || 0}`);
  console.log(`  🟢 Low: ${byPriority.low || 0}`);

  console.log('\nTop Service Keys:');
  const topServices = Object.entries(byService).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [key, count] of topServices) {
    console.log(`  ${key}: ${count}`);
  }

  console.log('\nRecent Activity:');
  const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
  for (const [month, count] of months) {
    console.log(`  ${month}: ${count} gaps`);
  }
}

// Increment frequency
function incrementFrequency(id) {
  const data = loadGaps();
  const gap = data.gaps.find(g => g.id === id);

  if (gap) {
    gap.frequency = (gap.frequency || 1) + 1;
    saveGaps(data);
    log(`✅ Frequency updated: ${gap.question} (${gap.frequency}x)`, 'green');
  }
}

// Main CLI
function main() {
  const cmd = args[0];

  switch (cmd) {
    case '--add':
    case '-a':
      if (!args[1]) {
        log('❌ Question required. Usage: --add "question" [service_key]', 'red');
        return;
      }
      addGap(args[1], args[2] || null);
      break;

    case '--bulk-add':
      if (!args[1]) {
        log('❌ File path required. Usage: --bulk-add <file.json>', 'red');
        return;
      }
      bulkAdd(args[1]);
      break;

    case '--list':
    case '-l':
      listGaps(
        args.includes('--pending') ? 'pending' : args.includes('--resolved') ? 'resolved' : null,
        args.includes('--by-priority') ? 'priority' : 'date'
      );
      break;

    case '--analyze':
      analyzeGaps();
      break;

    case '--export':
      exportGaps(args.includes('--json') ? 'json' : 'markdown');
      break;

    case '--resolve':
      if (!args[1]) {
        log('❌ Gap ID required. Usage: --resolve <id> [notes]', 'red');
        return;
      }
      updateStatus(args[1], 'resolved', args.slice(2).join(' '));
      break;

    case '--mark-pending':
      if (!args[1]) {
        log('❌ Gap ID required. Usage: --mark-pending <id>', 'red');
        return;
      }
      updateStatus(args[1], 'pending', args.slice(2).join(' '));
      break;

    case '--freq':
      if (!args[1]) {
        log('❌ Gap ID required. Usage: --freq <id>', 'red');
        return;
      }
      incrementFrequency(args[1]);
      break;

    case '--stats':
      showStats();
      break;

    case '--help':
    case '-h':
      console.log(`
📚 Knowledge Gap Tracker v2.0

Usage:
  node gap-tracker.js --add "question" [service_key]
  node gap-tracker.js --bulk-add <file.json>
  node gap-tracker.js --list [--pending] [--resolved] [--by-priority]
  node gap-tracker.js --analyze
  node gap-tracker.js --export [--json]
  node gap-tracker.js --resolve <id> [notes]
  node gap-tracker.js --mark-pending <id> [notes]
  node gap-tracker.js --freq <id>
  node gap-tracker.js --stats
  node gap-tracker.js --help

Examples:
  node gap-tracker.js --add "Bansos kemana?" bukan_desa
  node gap-tracker.js --list --pending
  node gap-tracker.js --analyze
  node gap-tracker.js --export > gaps.md
  node gap-tracker.js --resolve gap-123 "Added to knowledge base"
  node gap-tracker.js --stats
      `);
      break;

    default:
      if (cmd) {
        log(`❌ Unknown command: ${cmd}`, 'red');
      }
      showStats();
      console.log('\nUse --help for usage information.');
  }
}

main();
