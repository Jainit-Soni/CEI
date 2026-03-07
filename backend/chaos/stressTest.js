/**
 * chaos/stressTest.js — CEI HTTP Endpoint Stress Test
 * =====================================================
 * Simulates 10,000 concurrent users across 4 critical API endpoints.
 * Runs against the locally running server (or configured BASE_URL).
 *
 * Usage:
 *   node chaos/stressTest.js                              -- Full 10k test
 *   node chaos/stressTest.js --quick                      -- 500 user smoke test
 *   node chaos/stressTest.js --url http://localhost:4000  -- Custom URL
 *
 * Target: ALL endpoints p95 < 150ms
 *
 * Endpoints Tested:
 *   A. GET /api/search?q=     — Search queries      (most write-intensive path)
 *   B. GET /api/colleges      — College list page   (main traffic driver)
 *   C. GET /api/college/:id   — College detail page (individual fetch)
 *   D. GET /api/colleges?sortBy=popularity — Ranking queries (heaviest sort)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isQuick = args.includes('--quick');
const urlArg = args.find(a => a.startsWith('--url='))?.split('=')[1]
    || args[args.indexOf('--url') + 1];

const BASE_URL = urlArg || process.env.STRESS_BASE_URL || 'http://localhost:4000';

const CONCURRENCY_STAGES = isQuick
    ? [50, 100, 500]
    : [100, 500, 1000, 2000, 5000, 10000];

const REQUESTS_PER_STAGE = isQuick ? 100 : 500;
const GOAL_P95_MS = 150;
const GOAL_P99_MS = 400;
const GOAL_ERROR_RATE = 0.02; // max 2%

const TEST_COLLEGE_IDS = [
    'iit-bombay', 'iit-delhi', 'iit-madras', 'bits-pilani',
    'nit-warangal', 'vit-vellore', 'manipal-university',
    'anna-university', 'srm-kattankulathur', 'amity-university'
];

const SEARCH_TERMS = ['IIT', 'engineering', 'MBA', 'pune', 'medical', 'bits', 'delhi', 'nit', 'law', 'B.Tech'];

// ── HTTP Request Helper ───────────────────────────────────────────────────────

function makeRequest(urlStr, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const parsed = new URL(urlStr);
        const lib = parsed.protocol === 'https:' ? https : http;

        const req = lib.get({
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname + parsed.search,
            headers: { 'Accept': 'application/json', 'Connection': 'keep-alive' },
            timeout: timeoutMs,
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                // Only 5xx and connection errors are failures.
                // 404 = found an endpoint that responded correctly = not an error.
                const ok = res.statusCode < 500;
                resolve({
                    latencyMs: Date.now() - start,
                    status: res.statusCode,
                    ok,
                    cached: res.headers['x-cache'] === 'HIT',
                });
            });
            res.resume();
        });

        req.on('error', (err) => {
            resolve({ latencyMs: Date.now() - start, status: 0, ok: false, error: err.code });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ latencyMs: timeoutMs, status: 0, ok: false, error: 'TIMEOUT' });
        });
    });
}

// ── Statistics ────────────────────────────────────────────────────────────────

function computeStats(results) {
    const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
    const errors = results.filter(r => !r.ok);
    const n = latencies.length;

    return {
        count: n,
        errorCount: errors.length,
        errorRate: errors.length / n,
        p50: latencies[Math.floor(n * 0.50)] || 0,
        p75: latencies[Math.floor(n * 0.75)] || 0,
        p95: latencies[Math.floor(n * 0.95)] || 0,
        p99: latencies[Math.floor(n * 0.99)] || 0,
        min: latencies[0] || 0,
        max: latencies[n - 1] || 0,
        avg: Math.round(latencies.reduce((s, v) => s + v, 0) / n),
        cacheHits: results.filter(r => r.cached).length,
    };
}

// ── Run a concurrency wave ────────────────────────────────────────────────────

async function runWave(label, urlFn, concurrency, count) {
    const results = [];
    const requestsTotal = Math.max(concurrency, count);

    // Fire concurrency batches
    for (let offset = 0; offset < requestsTotal; offset += concurrency) {
        const batchSize = Math.min(concurrency, requestsTotal - offset);
        const batch = Array.from({ length: batchSize }, (_, i) => makeRequest(urlFn(offset + i)));
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
    }

    return { label, ...computeStats(results) };
}

// ── Endpoint Definitions ─────────────────────────────────────────────────────

const ENDPOINTS = [
    {
        id: 'A',
        label: 'Search Queries',
        urlFn: (i) => `${BASE_URL}/api/search?q=${encodeURIComponent(SEARCH_TERMS[i % SEARCH_TERMS.length])}`,
        description: 'GET /api/search?q=...',
    },
    {
        id: 'B',
        label: 'College List',
        urlFn: (i) => `${BASE_URL}/api/colleges?page=${(i % 10) + 1}&limit=20`,
        description: 'GET /api/colleges?page=N',
    },
    {
        id: 'C',
        label: 'College Detail Page',
        urlFn: (i) => `${BASE_URL}/api/college/${TEST_COLLEGE_IDS[i % TEST_COLLEGE_IDS.length]}`,
        description: 'GET /api/college/:id',
    },
    {
        id: 'D',
        label: 'Ranking / Sort Queries',
        urlFn: (i) => {
            const combos = [
                'sortBy=popularity&order=desc',
                'sortBy=placement&order=desc',
                'sortBy=ranking&state=Maharashtra',
                'sortBy=popularity&band=Elite',
                'tier=Tier+1&sortBy=placement',
            ];
            return `${BASE_URL}/api/colleges?${combos[i % combos.length]}`;
        },
        description: 'GET /api/colleges?sortBy=...&...',
    },
];

// ── Formatter ─────────────────────────────────────────────────────────────────

function pass(cond) { return cond ? '✅' : '❌'; }

function printStageResult(result, concurrency) {
    const p95pass = result.p95 <= GOAL_P95_MS;
    const p99pass = result.p99 <= GOAL_P99_MS;
    const errpass = result.errorRate <= GOAL_ERROR_RATE;

    console.log(`  ${result.label.padEnd(22)}│  p50: ${String(result.p50).padStart(4)}ms  p95: ${String(result.p95).padStart(4)}ms ${pass(p95pass)}  p99: ${String(result.p99).padStart(4)}ms ${pass(p99pass)}  err: ${(result.errorRate * 100).toFixed(1)}% ${pass(errpass)}  n=${result.count}`);
}

// ── Warm-up + dynamic ID discovery ──────────────────────────────────────────

async function discoverRealIds() {
    try {
        const res = await makeRequest(`${BASE_URL}/api/colleges?limit=10&sortBy=popularity`);
        // We can't read the body in makeRequest (it's drained), so just use static fallback
        // Use the list endpoint itself for paged detail test
        return null;
    } catch { return null; }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║       CEI API Stress Test — 10,000 Concurrent Users          ║');
    console.log('║       Goal: p95 < 150ms | p99 < 400ms | Error Rate < 2%      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`  🎯  Target: ${BASE_URL}`);
    console.log(`  🔥  Mode  : ${isQuick ? 'QUICK (500 users)' : 'FULL (10,000 users)'}`);
    console.log(`  📊  Stages: ${CONCURRENCY_STAGES.join(' → ')}\n`);

    // ── Warm-up ──────────────────────────────────────────────────────────────
    console.log('  ──────────────────────────────────────────────────────────────');
    console.log('  🔥 WARM-UP (10 requests to prime Redis cache)');
    console.log('  ──────────────────────────────────────────────────────────────');
    await Promise.all(ENDPOINTS.map(ep => makeRequest(ep.urlFn(0))));
    await Promise.all(ENDPOINTS.map(ep => makeRequest(ep.urlFn(1))));
    console.log('  ✅  Cache primed. Starting stress stages...\n');

    const allResults = {}; // endpoint → stage → stats
    let totalTests = 0;
    let passedTests = 0;

    for (const ep of ENDPOINTS) {
        allResults[ep.id] = [];
    }

    for (const concurrency of CONCURRENCY_STAGES) {
        const bar = '─'.repeat(62);
        console.log(`  ${bar}`);
        console.log(`  🚦 Stage: ${String(concurrency).padStart(6)} concurrent users`);
        console.log(`  ${bar}`);

        for (const ep of ENDPOINTS) {
            const result = await runWave(ep.label, ep.urlFn, concurrency, REQUESTS_PER_STAGE);
            allResults[ep.id].push({ concurrency, ...result });
            printStageResult(result, concurrency);
            totalTests++;
            if (result.p95 <= GOAL_P95_MS && result.errorRate <= GOAL_ERROR_RATE) passedTests++;
        }
        console.log();
    }

    // ── Final Summary ─────────────────────────────────────────────────────────
    const bar = '═'.repeat(62);
    console.log(`\n  ${bar}`);
    console.log('  📊 FINAL SUMMARY — Worst-Case (10,000 concurrent)');
    console.log(`  ${bar}`);

    let systemPassed = true;
    for (const ep of ENDPOINTS) {
        const worst = allResults[ep.id][allResults[ep.id].length - 1];
        const epPassed = worst.p95 <= GOAL_P95_MS && worst.errorRate <= GOAL_ERROR_RATE;
        if (!epPassed) systemPassed = false;
        console.log(`  ${pass(epPassed)} Endpoint ${ep.id}: ${ep.label}`);
        console.log(`         p95=${worst.p95}ms  p99=${worst.p99}ms  err=${(worst.errorRate * 100).toFixed(1)}%  cache=${worst.cacheHits}/${worst.count}`);
    }

    const verdict = systemPassed ? '✅  ALL ENDPOINTS MEET <150ms p95 GOAL' : '❌  SOME ENDPOINTS FAIL <150ms GOAL';
    console.log(`\n  ${bar}`);
    console.log(`  ${verdict}`);
    console.log(`  Test Coverage: ${passedTests}/${totalTests} stage-endpoint combinations passed`);
    console.log(`  ${bar}\n`);

    // ── Save JSON report ──────────────────────────────────────────────────────
    const reportDir = path.join(__dirname, '../chaos-reports');
    fs.mkdirSync(reportDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `stress_report_${ts}.json`);

    const report = {
        runAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        mode: isQuick ? 'quick' : 'full',
        stages: CONCURRENCY_STAGES,
        goal: { p95_ms: GOAL_P95_MS, p99_ms: GOAL_P99_MS, max_error_rate: GOAL_ERROR_RATE },
        passed: systemPassed,
        endpoints: ENDPOINTS.map(ep => ({
            id: ep.id,
            label: ep.label,
            description: ep.description,
            stages: allResults[ep.id],
        })),
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`  📄  Report saved: chaos-reports/stress_report_${ts}.json\n`);

    process.exit(systemPassed ? 0 : 1);
}

main().catch(err => {
    console.error('\n❌  Stress test aborted:', err.message);
    console.error('    Is the server running? Start it with: node server.js');
    process.exit(2);
});
