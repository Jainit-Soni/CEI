/**
 * chaos/runner.js — CEI Deterministic Failure Simulation Suite
 * =============================================================
 * Orchestrates all 4 chaos test categories in sequence.
 * Produces a combined JSON report and a final system verdict.
 *
 * Usage:
 *   node backend/chaos/runner.js             # Full suite
 *   node backend/chaos/runner.js cache       # Cache tests only
 *   node backend/chaos/runner.js db          # DB tests only
 *   node backend/chaos/runner.js auth        # Auth tests only
 *   node backend/chaos/runner.js load        # Load tests only
 *
 * Exit codes:
 *   0 = RESILIENT   (all tests passed)
 *   1 = DEGRADED    (some tests failed, no critical failures)
 *   2 = COMPROMISED (critical failure detected — DO NOT DEPLOY)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const fs = require('fs');
const path = require('path');

const { runCacheTests } = require('./cacheTests');
const { runDbTests } = require('./dbTests');
const { runAuthTests } = require('./authTests');
const { runLoadTests } = require('./loadTests');

const BANNER = `
╔══════════════════════════════════════════════════════════╗
║       CEI — DETERMINISTIC FAILURE SIMULATION SUITE      ║
║            Chaos Engineering v1.0                         ║
║   "Prove the system survives violence before scaling"    ║
╚══════════════════════════════════════════════════════════╝
`;

async function main() {
    console.log(BANNER);

    const selectedCategory = process.argv[2]?.toLowerCase();
    const suiteResults = [];
    const suiteStart = Date.now();

    // ── Category routing ──────────────────────────────────────────────────────
    const ALL = !selectedCategory;

    if (ALL || selectedCategory === 'cache') {
        try { suiteResults.push(await runCacheTests()); }
        catch (err) { console.error('❌  Cache test suite crashed:', err.message); suiteResults.push({ report: { resilience: 'COMPROMISED' }, exitCode: 2 }); }
    }

    if (ALL || selectedCategory === 'db') {
        try { suiteResults.push(await runDbTests()); }
        catch (err) { console.error('❌  DB test suite crashed:', err.message); suiteResults.push({ report: { resilience: 'COMPROMISED' }, exitCode: 2 }); }
    }

    if (ALL || selectedCategory === 'auth') {
        try { suiteResults.push(await runAuthTests()); }
        catch (err) { console.error('❌  Auth test suite crashed:', err.message); suiteResults.push({ report: { resilience: 'COMPROMISED' }, exitCode: 2 }); }
    }

    if (ALL || selectedCategory === 'load') {
        try { suiteResults.push(await runLoadTests()); }
        catch (err) { console.error('❌  Load test suite crashed:', err.message); suiteResults.push({ report: { resilience: 'COMPROMISED' }, exitCode: 2 }); }
    }

    if (suiteResults.length === 0) {
        console.log(`Unknown category: "${selectedCategory}". Valid: cache | db | auth | load`);
        process.exit(1);
    }

    // ── Combined verdict ──────────────────────────────────────────────────────
    const maxExitCode = Math.max(...suiteResults.map(r => r.exitCode));
    const totalDuration = ((Date.now() - suiteStart) / 1000).toFixed(1);
    const verdictMap = { 0: '🛡️  RESILIENT', 1: '⚠️  DEGRADED', 2: '💥 COMPROMISED' };
    const verdict = verdictMap[maxExitCode];

    const bar = '═'.repeat(60);
    console.log(`\n${bar}`);
    console.log(`  FINAL SYSTEM VERDICT: ${verdict}`);
    console.log(`  Total Duration      : ${totalDuration}s`);
    console.log(bar);

    if (maxExitCode === 0) {
        console.log(`
  ✅  System is battle-hardened.
      All failure modes handled correctly.
      Safe to proceed with Phase VII (UX) and Phase VIII (Governance).
`);
    } else if (maxExitCode === 1) {
        console.log(`
  ⚠️   System is degraded under some failure modes.
       Review failed tests. OK to deploy with monitoring active.
`);
    } else {
        console.log(`
  💥  CRITICAL FAILURE DETECTED.
      DO NOT DEPLOY until all CRITICAL failures are resolved.
      A critical failure means adversarial exploitation is possible.
`);
    }

    // ── Save combined report ──────────────────────────────────────────────────
    const outDir = path.join(__dirname, '../chaos-reports');
    fs.mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const combined = {
        runTimestamp: new Date().toISOString(),
        verdict: verdict.replace(/[^\w\s]/g, '').trim(),
        exitCode: maxExitCode,
        durationSec: totalDuration,
        suites: suiteResults.map(r => r.report).filter(Boolean),
    };
    const combinedPath = path.join(outDir, `chaos_combined_${ts}.json`);
    fs.writeFileSync(combinedPath, JSON.stringify(combined, null, 2));
    console.log(`  📄  Combined report: backend/chaos-reports/chaos_combined_${ts}.json\n`);

    process.exit(maxExitCode);
}

main().catch(err => {
    console.error('CEI Chaos Suite — Fatal orchestrator error:', err);
    process.exit(2);
});
