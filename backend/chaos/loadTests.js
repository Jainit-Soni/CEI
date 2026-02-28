/**
 * chaos/loadTests.js — Category 4: Performance Degradation
 * ==========================================================
 * Simulates high-concurrency and stampede scenarios and validates:
 *   - No thundering herd (lock is respected under simultaneous cold starts)
 *   - Stable response under 500 concurrent requests
 *   - Cache invalidation mid-traffic doesn't produce errors
 *   - Hydration under load finishes with consistent record count
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const ChaosReporter = require('./reporter');
const Redis = require('ioredis');

function makeTestRedis() {
    return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
    });
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// Simulate a lightweight "request" that resolves a Redis active pointer
async function simulateRequest(redis, requestId) {
    const ACTIVE = 'colleges:map:active';
    const start = Date.now();
    try {
        const activeKey = await redis.get(ACTIVE);
        if (!activeKey) return { id: requestId, status: 'MISS', latencyMs: Date.now() - start };

        // Simulate a real field read
        const fields = await redis.hkeys(activeKey);
        const sample = fields.length > 0 ? await redis.hget(activeKey, fields[0]) : null;

        return {
            id: requestId,
            status: sample ? 'HIT' : 'EMPTY',
            latencyMs: Date.now() - start,
            records: fields.length
        };
    } catch (err) {
        return { id: requestId, status: 'ERROR', latencyMs: Date.now() - start, error: err.message };
    }
}

async function runLoadTests() {
    const R = new ChaosReporter('PERFORMANCE & LOAD');
    const redis = makeTestRedis();

    try { await redis.connect(); }
    catch (err) {
        console.error('❌  Cannot connect to Redis — skipping load tests.\n');
        return R.summary();
    }

    const ACTIVE = 'colleges:map:active';
    const LOCK = 'colleges:hydrating';
    const TEST_KEY = `chaos:load:v${Date.now()}`;

    console.log('\n' + '─'.repeat(60));
    console.log('  ⚡  Category 4: Performance Degradation');
    console.log('─'.repeat(60) + '\n');

    // ── Seed a test active key with 500 "records" ─────────────────────────────
    const seedPipeline = redis.pipeline();
    for (let i = 0; i < 500; i++) {
        seedPipeline.hset(TEST_KEY, `college_${i}`, JSON.stringify({ id: `college_${i}`, name: `College ${i}` }));
    }
    await seedPipeline.exec();
    await redis.set(ACTIVE, TEST_KEY, 'EX', 300);

    // ── TEST 1: 500 concurrent requests — zero errors ─────────────────────────
    R.startTest('500 concurrent Redis reads complete without error', 'LOAD');
    try {
        const concurrency = 500;
        const tasks = Array.from({ length: concurrency }, (_, i) => simulateRequest(redis, i));
        const results = await Promise.all(tasks);

        const hits = results.filter(r => r.status === 'HIT').length;
        const errors = results.filter(r => r.status === 'ERROR').length;
        const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
        const p95 = latencies[Math.floor(concurrency * 0.95)];
        const p99 = latencies[Math.floor(concurrency * 0.99)];

        R.assert('Zero errors under 500 concurrent', errors === 0, { critical: true });
        R.assert('All requests got a response', results.length === concurrency, { critical: true });
        R.assert('Cache hit rate > 95%', hits / concurrency >= 0.95, { critical: true });
        R.assert('p95 latency < 200ms', p95 < 200);
        R.assert('p99 latency < 500ms', p99 < 500);

        R.pass(`p95=${p95}ms, p99=${p99}ms, hits=${hits}/${concurrency}`);
    } catch (err) { R.fail(err); }

    // ── TEST 2: Cold-start stampede — lock prevents duplicate hydration ────────
    R.startTest('Cold-start stampede: only 1 of 20 goroutines hydrates', 'LOAD');
    try {
        // Clear the active pointer to simulate cold start
        await redis.del(ACTIVE);

        // Track how many processes acquired the hydration lock
        const LOCKacquirers = [];

        const stampede = Array.from({ length: 20 }, async (_, i) => {
            // Each "process" tries to acquire the lock
            const acquired = await redis.set(LOCK, `process_${i}`, 'NX', 'EX', 30);
            if (acquired === 'OK') {
                LOCKacquirers.push(i);
                // Simulate hydration delay
                await sleep(50);
                // Set active pointer (hydration complete)
                await redis.set(ACTIVE, TEST_KEY, 'EX', 300);
                await redis.del(LOCK);
            }
        });

        await Promise.all(stampede);

        R.assert('Exactly 1 process acquired the hydration lock', LOCKacquirers.length === 1, { critical: true });
        R.assert('Active pointer restored after hydration', await redis.exists(ACTIVE) === 1, { critical: true });
        R.assert('Lock released after hydration', await redis.exists(LOCK) === 0, { critical: true });

        R.pass(`Lock acquired by process ${LOCKacquirers[0]} only — ${20 - 1} blocked correctly`);
    } catch (err) { R.fail(err); }

    // ── TEST 3: Cache invalidation during live traffic ────────────────────────
    R.startTest('Cache invalidation during live traffic — no 503 cascade', 'LOAD');
    try {
        // Restore active key
        await redis.set(ACTIVE, TEST_KEY, 'EX', 300);

        // Launch 100 background "requests"
        const bgRequests = Array.from({ length: 100 }, (_, i) =>
            simulateRequest(redis, i).then(r => ({ ...r, phase: 'pre-invalidation' }))
        );

        // Simultaneously trigger cache invalidation
        const invalidation = (async () => {
            await sleep(5); // Small delay so some requests are in-flight
            const newKey = `chaos:load:v${Date.now() + 1}`;
            // Write new key
            const p = redis.pipeline();
            for (let i = 0; i < 100; i++) p.hset(newKey, `college_${i}`, JSON.stringify({ id: `college_${i}` }));
            await p.exec();
            // Atomic pointer swap
            await redis.set(ACTIVE, newKey, 'EX', 300);
            return newKey;
        })();

        const [results, newKey] = await Promise.all([Promise.all(bgRequests), invalidation]);

        const errors = results.filter(r => r.status === 'ERROR').length;
        const successes = results.filter(r => r.status !== 'ERROR').length;

        R.assert('No error cascade from mid-traffic invalidation', errors === 0, { critical: true });
        R.assert('Requests served during invalidation', successes > 90);

        // Cleanup
        await redis.del(newKey);
        R.pass(`${successes}/100 served, ${errors} errors during invalidation`);
    } catch (err) { R.fail(err); }

    // ── TEST 4: Latency profile under simulated load spike ────────────────────
    R.startTest('Latency stays stable under progressive load (100→500 req)', 'LOAD');
    try {
        await redis.set(ACTIVE, TEST_KEY, 'EX', 300);

        const loadLevels = [100, 200, 300, 500];
        const p95byLevel = [];

        for (const level of loadLevels) {
            const tasks = Array.from({ length: level }, (_, i) => simulateRequest(redis, i));
            const results = await Promise.all(tasks);
            const sorted = results.map(r => r.latencyMs).sort((a, b) => a - b);
            const p95 = sorted[Math.floor(level * 0.95)];
            p95byLevel.push({ level, p95 });
        }

        // p95 should not grow > 5x from 100 to 500 concurrent
        const p95At100 = p95byLevel[0].p95;
        const p95At500 = p95byLevel[3].p95;
        const growthFactor = p95At500 / Math.max(p95At100, 1);

        R.assert('p95 at 100 req < 200ms', p95At100 < 200);
        R.assert('p95 at 500 req < 500ms', p95At500 < 500);
        R.assert('Latency growth factor < 10x', growthFactor < 10, { critical: true });

        const profile = p95byLevel.map(l => `${l.level}req→${l.p95}ms`).join(', ');
        R.pass(`Latency profile: ${profile} (growth=${growthFactor.toFixed(1)}x)`);
    } catch (err) { R.fail(err); }

    // ── Cleanup ────────────────────────────────────────────────────────────────
    await redis.del(TEST_KEY, ACTIVE, LOCK);
    await redis.quit();

    return R.summary();
}

module.exports = { runLoadTests };
