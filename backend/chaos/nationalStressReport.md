# CEI National Scale Stress Test Report
**Template — Fill after running `k6 run backend/chaos/loadSimulator.js`**

---

## Test Environment

| Field | Value |
|---|---|
| Run Date | {{DATE}} |
| Target URL | {{BASE_URL}} |
| Environment | Local / Staging |
| k6 Version | {{k6 version}} |
| Node.js Version | {{node --version}} |
| Active ScoringVersion | {{versionId}} |
| Dataset Hash | {{datasetHash}} |

---

## Scenario Results

### Scenario A — Public API Ramp (0→5k req/sec)

| Metric | Result | Threshold | Pass/Fail |
|---|---|---|---|
| p50 latency | Xms | < 100ms | |
| p95 latency | Xms | < 300ms | |
| p99 latency | Xms | < 700ms | |
| Error Rate | X% | < 2% | |
| Cache Hit Rate | X% | Target > 90% | |

### Scenario B — 500 Concurrent ScoringVersion Reads

| Metric | Result |
|---|---|
| Success Rate | X/500 |
| Version Consistency | All same / Divergent |
| p95 latency | Xms |

### Scenario C — 1000-VU Anomaly/Cluster Burst

| Metric | Result |
|---|---|
| 500-error rate | X% |
| Recovery time | Xs |
| Memory spike (if measured) | XMB |

### Scenario D — 200 Governance API req/sec Burst

| Metric | Result |
|---|---|
| Success rate | X% |
| Auth errors (expected 0) | X |

---

## Three Invariant Verification

| Invariant | Status | Evidence |
|---|---|---|
| Scoring Determinism | ✅ / ❌ | Score of iit-bombay before/after: {{X}} vs {{Y}} |
| Data Integrity | ✅ / ❌ | Record hash before/after: Match / Mismatch |
| Auto Recovery | ✅ / ❌ | System returned 200 within {{N}}s of chaos |

---

## Failure Analysis (if any)

_Fill only if thresholds failed._

**Failed Threshold:**
**Root Cause:**
**Remediation:**

---

## Certification

> This report certifies that CEI survived the Phase XV National Scale Stress Test on {{DATE}} with the above results. Signed by: {{OPERATOR}} (via JWT role: super_admin).

**Report Hash (SHA-256 of entire document):** `{{hash}}`
