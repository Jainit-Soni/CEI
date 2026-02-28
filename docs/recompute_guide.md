# How to Recompute a CEI Score Independently
**A developer guide to independent score verification**

---

## Overview

Any CEI score can be independently verified in **4 steps** using only the public API.
No special access. No API key required.

---

## Step 1: Fetch Active Weights

```bash
curl https://ce-intelligence-backend.vercel.app/api/verify/methodology
```

Response extract:
```json
{
  "scoringVersion": "2026.02.28-v1",
  "formula": {
    "vectors": {
      "A": { "name": "Accreditation",  "weight": 0.30 },
      "F": { "name": "Faculty Legacy", "weight": 0.20 },
      "I": { "name": "Infrastructure", "weight": 0.20 },
      "S": { "name": "Scale",          "weight": 0.15 },
      "D": { "name": "Demand",         "weight": 0.10 },
      "U": { "name": "Urban Proximity","weight": 0.05 }
    }
  }
}
```

---

## Step 2: Fetch Institution Vectors

```bash
curl https://ce-intelligence-backend.vercel.app/api/verify/institution/iit-bombay/manifest
```

Response extract:
```json
{
  "inputVector": { "A": 8.0, "F": 7.5, "I": 10.0, "S": 6.0, "D": 8.0, "U": 5.0 },
  "weights":     { "A": 0.30, "F": 0.20, "I": 0.20, "S": 0.15, "D": 0.10, "U": 0.05 },
  "recomputedScore": 87.25,
  "storedCeiScore":  87.25,
  "mismatch":        false
}
```

---

## Step 3: Apply the Formula

**Python:**
```python
def compute_cei(v, w):
    raw = sum(w[k] * v[k] for k in ['A','F','I','S','D','U'])
    return min(100, max(0, round(raw * 10, 4)))

vectors = {"A": 8.0, "F": 7.5, "I": 10.0, "S": 6.0, "D": 8.0, "U": 5.0}
weights = {"A": 0.30, "F": 0.20, "I": 0.20, "S": 0.15, "D": 0.10, "U": 0.05}
print(compute_cei(vectors, weights))  # → 87.25
```

**JavaScript:**
```js
function computeCEI(v, w) {
    const raw = ['A','F','I','S','D','U'].reduce((s,k) => s + w[k] * v[k], 0);
    return Math.min(100, Math.max(0, +(raw * 10).toFixed(4)));
}
const v = {A:8.0, F:7.5, I:10.0, S:6.0, D:8.0, U:5.0};
const w = {A:0.30, F:0.20, I:0.20, S:0.15, D:0.10, U:0.05};
console.log(computeCEI(v, w));  // → 87.25
```

---

## Step 4: Verify Match

```bash
curl -X POST https://ce-intelligence-backend.vercel.app/api/verify/recompute \
  -H "Content-Type: application/json" \
  -d '{"A":8.0,"F":7.5,"I":10.0,"S":6.0,"D":8.0,"U":5.0,"collegeId":"iit-bombay"}'
```

Expected response:
```json
{
  "computedScore": 87.25,
  "storedScore":   87.25,
  "matchVerdict":  "MATCH",
  "mismatchInvestigationProtocol": null
}
```

---

## If a Mismatch is Detected

If `matchVerdict: "MISMATCH"` — the drift exceeds 0.5 points and an investigation should be triggered.

**Investigation Protocol:**
1. Note the `scoringVersion` in the manifest response
2. Fetch the version proof: `GET /api/evidence/version/:versionId/proof`
3. Verify the `datasetHash` matches the scoring run manifest
4. Open an issue at [github.com/Jainit-Soni/CEI](https://github.com/Jainit-Soni/CEI) with the full API response payloads

CEI will respond with an AuditLog extract and a frozen version proof within 48 hours.
