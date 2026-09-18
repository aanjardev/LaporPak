#!/usr/bin/env node
/**
 * LaporPak AI Test Suite
 *
 * Run all AI-related tests in one command.
 * Tests include: FTS recall, eval runner, gap tracker analysis.
 *
 * Usage:
 *   node evals/test-suite.js              # Run all tests
 *   node evals/test-suite.js --fts       # FTS recall only
 *   node evals/test-suite.js --evals    # Evaluation runner only
 *   node evals/test-suite.js --gaps     # Gap analysis only
 *   node evals/test-suite.js --verbose  # Detailed output
 *   node evals/test-suite.js --report   # Generate HTML report
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + colors.bold);
  console.log('═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60) + colors.reset + '\n');
}

// Parse arguments
const args = process.argv.slice(2);
const runFTS = args.includes('--fts') || args.includes('--all') || args.length === 0;
const runEvals = args.includes('--evals') || args.includes('--all') || args.length === 0;
const runGaps = args.includes('--gaps') || args.includes('--all') || args.length === 0;
const verbose = args.includes('--verbose') || args.includes('-v');
const generateReport = args.includes('--report');
const saveOutput = args.includes('--save');

// Run command helper
function runCommand(cmd, cwd = __dirname) {
  log(`Running: ${cmd}`, 'blue');
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: verbose ? 'inherit' : 'pipe',
      timeout: 120000,
    });
    return { success: true, output: verbose ? '' : output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.message,
      error: error.stderr || error.message,
      exitCode: error.status || 1,
    };
  }
}

// Check prerequisites
function checkPrerequisites() {
  logSection('PREREQUISITE CHECK');

  const checks = [
    { name: 'Node.js', check: () => execSync('node --version', { encoding: 'utf-8' }).trim() },
    { name: 'FTS test file', check: () => existsSync(join(__dirname, 'fts-recall.js')) },
    { name: 'Runner test file', check: () => existsSync(join(__dirname, 'runner.js')) },
    { name: 'Gap tracker file', check: () => existsSync(join(__dirname, 'gap-tracker.js')) },
    { name: 'Knowledge gaps file', check: () => existsSync(join(__dirname, 'knowledge-gaps.json')) },
    { name: 'Dataset index', check: () => existsSync(join(__dirname, 'index.json')) },
  ];

  const results = [];
  for (const check of checks) {
    try {
      const result = check.check();
      const status = typeof result === 'boolean' ? result : !!result;
      results.push({ name: check.name, pass: status, value: typeof result === 'string' ? result : null });
      log(`${status ? '✅' : '❌'} ${check.name}${typeof result === 'string' ? ': ' + result : ''}`, status ? 'green' : 'red');
    } catch (e) {
      results.push({ name: check.name, pass: false, error: e.message });
      log(`❌ ${check.name}: ${e.message}`, 'red');
    }
  }

  const allPassed = results.every(r => r.pass);
  console.log('');
  return { allPassed, results };
}

// Run FTS Recall Test
function runFTSRecall() {
  logSection('FTS RECALL TEST');

  const result = runCommand('node fts-recall.js' + (verbose ? ' --verbose' : ''));

  if (result.success) {
    log('✅ FTS Recall test completed', 'green');
    if (result.output) {
      console.log(result.output);
    }
  } else {
    log('❌ FTS Recall test failed', 'red');
    if (result.error) {
      console.log(result.error);
    }
  }

  return result;
}

// Run Evaluation Runner
function runEvaluation() {
  logSection('AI EVALUATION RUNNER');

  const cmd = 'node runner.js --verbose --output eval-results.json';
  const result = runCommand(cmd);

  if (result.success) {
    log('✅ Evaluation runner completed', 'green');
  } else {
    log('❌ Evaluation runner encountered issues', 'yellow');
  }

  return result;
}

// Run Gap Analysis
function runGapAnalysis() {
  logSection('KNOWLEDGE GAP ANALYSIS');

  // List gaps
  log('Listing pending gaps...', 'blue');
  const listResult = runCommand('node gap-tracker.js --list --pending');

  // Analyze gaps
  log('\nAnalyzing gap patterns...', 'blue');
  const analyzeResult = runCommand('node gap-tracker.js --analyze');

  return { listResult, analyzeResult };
}

// Generate HTML Report
function generateHTMLReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    ...results,
  };

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LaporPak AI Test Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #2563eb; margin-bottom: 0.5rem; }
    .subtitle { color: #666; margin-bottom: 2rem; }
    .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 1.5rem; margin-bottom: 1.5rem; }
    .card h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-bottom: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
    .stat { background: #f9fafb; padding: 1rem; border-radius: 6px; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #2563eb; }
    .stat-label { color: #6b7280; font-size: 0.875rem; }
    .pass { color: #16a34a; }
    .fail { color: #dc2626; }
    .warn { color: #ca8a04; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .badge-pass { background: #dcfce7; color: #16a34a; }
    .badge-fail { background: #fee2e2; color: #dc2626; }
    .badge-warn { background: #fef9c3; color: #ca8a04; }
    .timestamp { color: #6b7280; font-size: 0.875rem; }
    pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 LaporPak AI Test Report</h1>
    <p class="subtitle">Generated: ${new Date(report.timestamp).toLocaleString('id-ID')}</p>

    <div class="card">
      <h2>📊 Test Summary</h2>
      <div class="grid">
        <div class="stat">
          <div class="stat-value">${report.prerequisites?.allPassed ? '✅' : '❌'}</div>
          <div class="stat-label">Prerequisites</div>
        </div>
        <div class="stat">
          <div class="stat-value">${report.fts?.success ? '✅' : '❌'}</div>
          <div class="stat-label">FTS Recall</div>
        </div>
        <div class="stat">
          <div class="stat-value">${report.evals?.success ? '✅' : '❌'}</div>
          <div class="stat-label">Eval Runner</div>
        </div>
        <div class="stat">
          <div class="stat-value">${report.gaps ? '✅' : '❌'}</div>
          <div class="stat-label">Gap Analysis</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>🔍 Prerequisites</h2>
      <table>
        <thead>
          <tr><th>Check</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${(report.prerequisites?.results || []).map(r => `
            <tr>
              <td>${r.name}${r.value ? ': ' + r.value : ''}</td>
              <td><span class="badge ${r.pass ? 'badge-pass' : 'badge-fail'}">${r.pass ? 'PASS' : 'FAIL'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>📈 Recommendations</h2>
      <ul style="margin-left: 1.5rem;">
        <li>Run full test suite before each deployment</li>
        <li>Review failed cases and update prompts</li>
        <li>Track gap analysis for knowledge base expansion</li>
        <li>Monitor FTS recall metrics over time</li>
      </ul>
    </div>

    <p class="timestamp">
      LaporPak AI Engineering • ${report.timestamp}
    </p>
  </div>
</body>
</html>`;

  const reportPath = join(__dirname, 'test-report.html');
  writeFileSync(reportPath, html);
  log(`\n📄 HTML report generated: ${reportPath}`, 'green');

  return reportPath;
}

// Main
function main() {
  console.log('\n' + colors.bold);
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         LAPORPAK AI TEST SUITE v2.0                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝' + colors.reset);

  const results = {};

  // Prerequisites check
  results.prerequisites = checkPrerequisites();
  if (!results.prerequisites.allPassed) {
    log('\n⚠️ Prerequisites not met. Some tests may fail.', 'yellow');
  }

  // Run tests based on flags
  if (runFTS) {
    results.fts = runFTSRecall();
  }

  if (runEvals) {
    results.evals = runEvaluation();
  }

  if (runGaps) {
    results.gaps = runGapAnalysis();
  }

  // Summary
  logSection('TEST SUMMARY');

  const totalTests = [results.fts, results.evals, results.gaps?.listResult].filter(Boolean).length;
  const passedTests = [
    results.fts?.success,
    results.evals?.success,
    results.gaps?.listResult?.success,
  ].filter(Boolean).length;

  log(`Total Test Suites: ${totalTests}`);
  log(`Passed: ${passedTests}`, passedTests === totalTests ? 'green' : 'yellow');
  log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests > 0 ? 'red' : 'green');

  // Generate report if requested
  if (generateReport || saveOutput) {
    generateHTMLReport(results);
  }

  // Export eval results if available
  const evalResultsPath = join(__dirname, 'eval-results.json');
  if (existsSync(evalResultsPath)) {
    log(`\n📊 Eval results saved to: ${evalResultsPath}`, 'green');
  }

  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);
  log('✨ TEST SUITE COMPLETE', 'cyan');
  console.log(colors.bold + '═'.repeat(60) + colors.reset + '\n');

  // Exit with appropriate code
  const allPassed = results.prerequisites?.allPassed !== false &&
    (runFTS ? results.fts?.success !== false : true) &&
    (runEvals ? results.evals?.success !== false : true) &&
    (runGaps ? results.gaps?.listResult?.success !== false : true);

  process.exit(allPassed ? 0 : 1);
}

main();
