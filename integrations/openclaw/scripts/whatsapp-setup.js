#!/usr/bin/env node
/**
 * LaporPak WhatsApp Setup & Verification Script
 *
 * Automated steps for WhatsApp integration setup.
 * Run this to verify your OpenClaw + WhatsApp configuration.
 *
 * Usage:
 *   node integrations/openclaw/scripts/whatsapp-setup.js
 *   node integrations/openclaw/scripts/whatsapp-setup.js --verify
 *   node integrations/openclaw/scripts/whatsapp-setup.js --status
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..', '..');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
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

function runCommand(cmd, silent = false) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
      timeout: 30000,
    });
    return { success: true, output: silent ? output?.trim() : null };
  } catch (error) {
    return {
      success: false,
      output: silent ? error.stdout?.trim() : null,
      error: error.message,
    };
  }
}

// Check prerequisites
function checkPrerequisites() {
  logSection('PREREQUISITES CHECK');

  const checks = [
    { name: 'OpenClaw CLI', cmd: 'openclaw --version' },
    { name: 'Node.js', cmd: 'node --version' },
    { name: 'Gateway Health', cmd: 'openclaw gateway health' },
  ];

  let allPassed = true;
  for (const check of checks) {
    const result = runCommand(check.cmd, true);
    if (result.success) {
      log(`✅ ${check.name}: ${result.output || 'OK'}`, 'green');
    } else {
      log(`❌ ${check.name}: Not found`, 'red');
      allPassed = false;
    }
  }

  return allPassed;
}

// Check environment variables
function checkEnvironment() {
  logSection('ENVIRONMENT VARIABLES');

  const homeEnv = join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw', '.env');
  const exists = existsSync(homeEnv);

  if (exists) {
    log('✅ .openclaw/.env exists', 'green');

    const content = readFileSync(homeEnv, 'utf-8');
    const required = [
      'GEMINI_API_KEY',
      'LAPORPAK_API_URL',
      'LAPORPAK_API_KEY',
      'LAPORPAK_CHANNEL_ACCOUNT_ID',
    ];
    const missing = [];

    for (const key of required) {
      const line = content
        .split(/\r?\n/)
        .find((entry) => entry.trimStart().startsWith(`${key}=`));
      const value = line?.split('=', 2)[1]?.trim();
      if (value) {
        log(`   ${key}: CONFIGURED`, 'green');
      } else {
        log(`   ${key}: NOT SET`, 'red');
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      log(`\n⚠️ Missing environment variables: ${missing.join(', ')}`, 'yellow');
      return false;
    }
  } else {
    log('⚠️ .openclaw/.env not found', 'yellow');
    log('   Create it with:', 'yellow');
    log('   GEMINI_API_KEY=your-key', 'blue');
    log('   LAPORPAK_API_URL=http://localhost:8000', 'blue');
    log('   LAPORPAK_API_KEY=your-key', 'blue');
    return false;
  }

  return true;
}

// Check plugins
function checkPlugins() {
  logSection('OPENCLAW PLUGINS');

  const result = runCommand('openclaw plugins inspect laporpak-tools --runtime --json', true);

  if (result.success && result.output) {
    try {
      const data = JSON.parse(result.output);
      const tools = data.plugin?.toolNames || data.toolNames || [];
      if (data.plugin?.status !== 'loaded' || tools.length === 0) {
        throw new Error('plugin has no loaded tools');
      }
      log('✅ LaporPak tools registered:', 'green');
      for (const tool of tools) {
        log(`   - ${tool}`, 'cyan');
      }
      return true;
    } catch {
      log('⚠️ Could not parse plugin info', 'yellow');
    }
  }

  log('⚠️ LaporPak tools not found', 'yellow');
  log('   Run: openclaw plugins install integrations/openclaw/plugins/laporpak-tools', 'blue');
  return false;
}

// Check agents
function checkAgents() {
  logSection('OPENCLAW AGENTS');

  const result = runCommand('openclaw agents list', true);

  if (result.success) {
    log('✅ OpenClaw agents:', 'green');

    if (result.output?.includes('laporpak')) {
      log('   - laporpak agent: FOUND', 'green');

      // Check bindings
      const bindingsResult = runCommand('openclaw agents bindings', true);
      if (bindingsResult.success && bindingsResult.output?.includes('laporpak')) {
        log('   - WhatsApp binding: FOUND', 'green');
        return true;
      } else {
        log('   - WhatsApp binding: NOT FOUND', 'yellow');
        log('     Run: openclaw agents bind laporpak --channel whatsapp:default', 'blue');
        return false;
      }
    } else {
      log('   - laporpak agent: NOT FOUND', 'yellow');
      log('     Create agent in OpenClaw dashboard', 'blue');
      return false;
    }
  }

  return false;
}

// Check channel status
function checkChannelStatus() {
  logSection('WHATSAPP CHANNEL STATUS');

  const result = runCommand('openclaw channels status --probe', true);

  if (result.success && result.output) {
    log('Channel status:', 'green');
    console.log(result.output);

    if (result.output.includes('linked') && result.output.includes('running')) {
      log('\n✅ WhatsApp is connected and running!', 'green');
      return true;
    } else if (result.output.includes('linked')) {
      log('\n⚠️ WhatsApp linked but not running', 'yellow');
      return false;
    } else {
      log('\n⚠️ WhatsApp not connected', 'yellow');
      log('   Run: openclaw channels login --channel whatsapp', 'blue');
      return false;
    }
  }

  log('⚠️ Could not check channel status', 'yellow');
  return false;
}

// Check API health
function checkAPIHealth() {
  logSection('FASTAPI HEALTH');

  try {
    const result = execSync(
      'powershell -Command "Invoke-RestMethod http://127.0.0.1:8000/health -ErrorAction Stop | ConvertTo-Json -Compress"',
      { encoding: 'utf-8', timeout: 5000 }
    );

    if (result) {
      const data = JSON.parse(result);
      log('✅ FastAPI is healthy:', 'green');
      log(`   Status: ${data.status}`, 'cyan');
      log(`   Service: ${data.service}`, 'cyan');
      return true;
    }
  } catch {
    log('⚠️ FastAPI not reachable at http://127.0.0.1:8000', 'yellow');
    log('   Start with: cd services\\api && uv run uvicorn app.main:app --reload', 'blue');
    return false;
  }

  return false;
}

// Verify setup
function verifySetup() {
  logSection('FULL VERIFICATION');

  const checks = {
    'Prerequisites': checkPrerequisites(),
    'Environment': checkEnvironment(),
    'Plugins': checkPlugins(),
    'Agents': checkAgents(),
    'Channel': checkChannelStatus(),
    'API': checkAPIHealth(),
  };

  logSection('VERIFICATION SUMMARY');

  let allPassed = true;
  for (const [name, passed] of Object.entries(checks)) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';
    log(`${status}  ${name}`, color);
    if (!passed) allPassed = false;
  }

  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);

  if (allPassed) {
    log('✅ ALL CHECKS PASSED', 'green');
    log('\nYour LaporPak WhatsApp integration is ready!', 'green');
    log('\nTo test:', 'cyan');
    log('1. Send a message to your WhatsApp', 'white');
    log('2. Check OpenClaw logs', 'white');
    log('3. Verify report appears in API', 'white');
  } else {
    log('⚠️ SOME CHECKS FAILED', 'yellow');
    log('\nFix the issues above before testing WhatsApp integration.', 'yellow');
  }

  console.log(colors.bold + '═'.repeat(60) + colors.reset + '\n');

  return allPassed;
}

// Show setup instructions
function showInstructions() {
  logSection('WHATSAPP SETUP INSTRUCTIONS');

  console.log(`
1. ENSURE SERVICES RUNNING
   OpenClaw Gateway:  openclaw gateway start
   FastAPI:           cd services\\api && uv run uvicorn app.main:app --reload

2. CONFIGURE ENVIRONMENT
   Edit: %USERPROFILE%\\.openclaw\\.env
   GEMINI_API_KEY=your-google-ai-key
   LAPORPAK_API_URL=http://localhost:8000
   LAPORPAK_API_KEY=same-as-backend
   LAPORPAK_CHANNEL_ACCOUNT_ID=your-whatsapp-account-id

3. ENABLE PLUGIN
   openclaw plugins install integrations/openclaw/plugins/laporpak-tools

4. CREATE AGENT
   openclaw agents create --name laporpak --workspace integrations/openclaw/workspace

5. BIND WHATSAPP
   openclaw agents bind laporpak --channel whatsapp:default

6. SCAN QR CODE
   openclaw channels login --channel whatsapp
   (Scan with WhatsApp linked devices)

7. APPROVE PAIRING
   openclaw pairing list whatsapp
   openclaw pairing approve whatsapp <CODE>

8. TEST
   Send message to WhatsApp: "Halo, mau tanya soal KTP"

For detailed guide, see: docs/whatsapp-setup.md
`);
}

// Main
function main() {
  const args = process.argv.slice(2);

  console.log('\n' + colors.bold);
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         LAPORPAK WHATSAPP SETUP VERIFIER v1.0                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝' + colors.reset);

  if (args.includes('--help')) {
    showInstructions();
    return;
  }

  if (args.includes('--status')) {
    checkChannelStatus();
    return;
  }

  if (args.includes('--verify') || args.length === 0) {
    verifySetup();
  }
}

main();
