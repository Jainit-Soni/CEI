/**
 * chaos/reporter.js — CEI Chaos Test Reporter
 * ============================================
 * Structured test result accumulator and renderer.
 * Produces a machine-readable JSON report + human-readable terminal summary.
 */

const fs = require('fs');
const path = require('path');

class ChaosReporter {
    constructor(suiteName) {
        this.suiteName = suiteName;
        this.startTime = Date.now();
        this.results = [];
        this.current = null;
    }

    // ── Test lifecycle ────────────────────────────────────────────────────────

    startTest(name, category) {
        this.current = {
            name,
            category,
            status: 'RUNNING',
            startMs: Date.now(),
            durationMs: null,
            assertions: [],
            error: null,
        };
        process.stdout.write(`  ⟳  ${name}...`);
    }

    assert(label, condition, { critical = false } = {}) {
        if (!this.current) throw new Error('No active test');
        const passed = Boolean(condition);
        this.current.assertions.push({ label, passed, critical });
        if (!passed && critical) {
            this.current.status = 'CRITICAL_FAIL';
        }
        return passed;
    }

    pass(note = '') {
        if (!this.current) return;
        this.current.durationMs = Date.now() - this.current.startMs;
        if (this.current.status !== 'CRITICAL_FAIL') {
            this.current.status = 'PASS';
        }
        if (note) this.current.note = note;
        this.results.push(this.current);
        const icon = this.current.status === 'PASS' ? '✅' : '💥';
        console.log(`\r  ${icon}  ${this.current.name} (${this.current.durationMs}ms)${note ? ' — ' + note : ''}`);
        this.current = null;
    }

    fail(errorOrMessage, { critical = true } = {}) {
        if (!this.current) return;
        this.current.durationMs = Date.now() - this.current.startMs;
        this.current.status = critical ? 'CRITICAL_FAIL' : 'FAIL';
        this.current.error = errorOrMessage instanceof Error
            ? { message: errorOrMessage.message, stack: errorOrMessage.stack }
            : { message: String(errorOrMessage) };
        this.results.push(this.current);
        console.log(`\r  ❌  ${this.current.name} — ${this.current.error.message}`);
        this.current = null;
    }

    // ── Final report ──────────────────────────────────────────────────────────

    summary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const critical = this.results.filter(r => r.status === 'CRITICAL_FAIL').length;
        const duration = Date.now() - this.startTime;

        const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

        const resilience = critical === 0 && failed === 0 ? 'RESILIENT'
            : critical === 0 ? 'DEGRADED'
                : 'COMPROMISED';

        const report = {
            suite: this.suiteName,
            timestamp: new Date().toISOString(),
            durationMs: duration,
            resilience,
            total, passed, failed, critical,
            passRate: `${pct}%`,
            results: this.results,
        };

        // ── Terminal output ──
        const bar = '═'.repeat(60);
        const icon = { RESILIENT: '🛡️ ', DEGRADED: '⚠️ ', COMPROMISED: '💥' }[resilience];
        console.log(`\n${bar}`);
        console.log(`  ${icon}  CEI CHAOS SUITE — ${this.suiteName}`);
        console.log(`${bar}`);
        console.log(`  Total     : ${total}`);
        console.log(`  Passed    : ${passed}   ✅`);
        console.log(`  Failed    : ${failed}   ❌`);
        console.log(`  Critical  : ${critical}  💥`);
        console.log(`  Pass Rate : ${pct}%`);
        console.log(`  Duration  : ${(duration / 1000).toFixed(1)}s`);
        console.log(`  Verdict   : ${resilience}`);
        console.log(`${bar}\n`);

        if (critical > 0 || failed > 0) {
            console.log('  FAILURES:\n');
            this.results
                .filter(r => r.status !== 'PASS')
                .forEach(r => {
                    console.log(`  [${r.status}] ${r.category} > ${r.name}`);
                    if (r.error) console.log(`         ${r.error.message}`);
                    r.assertions
                        .filter(a => !a.passed)
                        .forEach(a => console.log(`         ✗ ${a.label}`));
                    console.log();
                });
        }

        // ── Save JSON report ──
        const outDir = path.join(__dirname, '../chaos-reports');
        fs.mkdirSync(outDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `chaos_report_${ts}.json`;
        fs.writeFileSync(path.join(outDir, filename), JSON.stringify(report, null, 2));
        console.log(`  📄  Report saved: backend/chaos-reports/${filename}\n`);

        return { report, exitCode: critical > 0 ? 2 : failed > 0 ? 1 : 0 };
    }
}

module.exports = ChaosReporter;
