/**
 * chaos/loadSimulator.js — CEI k6 Load Simulation Script (Phase XV)
 * ==================================================================
 * Run with: k6 run backend/chaos/loadSimulator.js
 *
 * Tests 4 scenarios against the CEI API.
 * TARGET: Local/Staging only. NEVER production Vercel.
 *
 * Override base URL: k6 run --env BASE_URL=http://localhost:5000 loadSimulator.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ── Custom Metrics ──────────────────────────────────────────────────────────
const p99Latency = new Trend('cei_p99_latency_ms', true);
const errorRate = new Rate('cei_error_rate');
const cacheHitCounter = new Counter('cei_cache_hits');

// ── Configuration ──────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Institution IDs in the test dataset
const TEST_COLLEGES = [
    'iit-bombay', 'iit-delhi', 'iit-madras', 'nit-warangal',
    'anna-university', 'bits-pilani', 'vit-vellore', 'manipal-university',
    'amity-university', 'srm-kattankulathur'
];

function randomCollege() {
    return TEST_COLLEGES[Math.floor(Math.random() * TEST_COLLEGES.length)];
}

// ── Test Scenarios ─────────────────────────────────────────────────────────

/**
 * Scenario A — Ramp 0→5000 req/sec over 2 minutes (Public API read pressure)
 */
export const options = {
    scenarios: {
        scenarioA_public_api_ramp: {
            executor: 'ramping-arrival-rate',
            startRate: 0,
            timeUnit: '1s',
            preAllocatedVUs: 200,
            maxVUs: 1000,
            stages: [
                { target: 100, duration: '30s' },
                { target: 500, duration: '60s' },
                { target: 5000, duration: '120s' },
                { target: 0, duration: '30s' }
            ],
            exec: 'publicApiRead'
        },

        scenarioB_concurrent_version_reads: {
            executor: 'constant-vus',
            vus: 500,
            duration: '2m',
            startTime: '30s',
            exec: 'versionRead'
        },

        scenarioC_burst_anomaly_scan: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { target: 1000, duration: '10s' },
                { target: 1000, duration: '20s' },
                { target: 0, duration: '10s' }
            ],
            startTime: '1m',
            exec: 'anomalyScanBurst'
        },

        scenarioD_governance_burst: {
            executor: 'ramping-arrival-rate',
            startRate: 200,
            timeUnit: '1s',
            preAllocatedVUs: 50,
            maxVUs: 100,
            stages: [
                { target: 200, duration: '10s' }
            ],
            startTime: '90s',
            exec: 'governanceRead'
        }
    },

    thresholds: {
        'http_req_duration': ['p(50)<100', 'p(95)<300', 'p(99)<700'],
        'cei_error_rate': ['rate<0.02'],  // < 2% error rate
        'cei_p99_latency_ms': ['p(99)<700']
    }
};

// ── Scenario A: Public institution read ────────────────────────────────────
export function publicApiRead() {
    const res = http.get(`${BASE_URL}/api/v1/institution/${randomCollege()}`, {
        headers: { 'Accept': 'application/json' },
        tags: { scenario: 'A_public_api' }
    });

    p99Latency.add(res.timings.duration);

    // Detect cache hit via X-Cache header
    if (res.headers['X-Cache'] === 'HIT') cacheHitCounter.add(1);

    const ok = check(res, {
        'status 200': (r) => r.status === 200,
        'has scoringVersion': (r) => JSON.parse(r.body || '{}').scoringVersion !== undefined,
        'has snapshotHash': (r) => JSON.parse(r.body || '{}').snapshotHash !== undefined,
        'determinism: score present': (r) => {
            const b = JSON.parse(r.body || '{}');
            return b.data && typeof b.data.ceiScore === 'number';
        }
    });

    errorRate.add(!ok);
    sleep(0.1);
}

// ── Scenario B: ScoringVersion concurrent reads ────────────────────────────
export function versionRead() {
    const res = http.get(`${BASE_URL}/api/v1/scoring-version/active`, {
        tags: { scenario: 'B_version' }
    });

    check(res, {
        'version read 200': (r) => r.status === 200,
        'version has weights': (r) => {
            const b = JSON.parse(r.body || '{}');
            return b.data && b.data.weights;
        }
    });

    errorRate.add(res.status !== 200);
    sleep(0.05);
}

// ── Scenario C: Concurrent peer-cluster reads (anomaly scan proxy) ─────────
export function anomalyScanBurst() {
    const res = http.get(`${BASE_URL}/api/simulator/peer-cluster/${randomCollege()}`, {
        tags: { scenario: 'C_anomaly_burst' }
    });

    check(res, {
        'cluster status ok': (r) => r.status === 200 || r.status === 404,
        'response time < 500ms': (r) => r.timings.duration < 500
    });

    errorRate.add(res.status >= 500);
    sleep(0.01);
}

// ── Scenario D: Governance API burst read ─────────────────────────────────
export function governanceRead() {
    const res = http.get(`${BASE_URL}/api/transparency/active`, {
        tags: { scenario: 'D_governance' }
    });

    check(res, {
        'governance ok': (r) => r.status === 200 || r.status === 404
    });

    sleep(0.05);
}

// ── Summary Handler ────────────────────────────────────────────────────────
export function handleSummary(data) {
    const metrics = data.metrics;

    const summary = {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        p50_ms: metrics.http_req_duration?.values?.['p(50)']?.toFixed(1),
        p95_ms: metrics.http_req_duration?.values?.['p(95)']?.toFixed(1),
        p99_ms: metrics.http_req_duration?.values?.['p(99)']?.toFixed(1),
        error_rate_pct: (metrics.cei_error_rate?.values?.rate * 100)?.toFixed(2),
        cache_hits: metrics.cei_cache_hits?.values?.count,
        total_requests: metrics.http_reqs?.values?.count,
        thresholds_passed: Object.values(data.thresholds || {}).every(t => t.ok),
    };

    console.log('\n═══════════════════════════════════════════');
    console.log('  CEI National Scale Stress Test Results');
    console.log('═══════════════════════════════════════════');
    console.log(`  p50:          ${summary.p50_ms} ms`);
    console.log(`  p95:          ${summary.p95_ms} ms`);
    console.log(`  p99:          ${summary.p99_ms} ms`);
    console.log(`  Error Rate:   ${summary.error_rate_pct}%`);
    console.log(`  Total Reqs:   ${summary.total_requests}`);
    console.log(`  Thresholds:   ${summary.thresholds_passed ? '✅ ALL PASSED' : '❌ FAILED'}`);
    console.log('═══════════════════════════════════════════\n');

    return {
        'backend/chaos/last_stress_result.json': JSON.stringify(summary, null, 2),
        stdout: JSON.stringify(summary)
    };
}
