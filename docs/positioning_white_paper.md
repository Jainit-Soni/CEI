# CEI National Positioning White Paper v1.0
**Status: RATIFIED | Date: 2026-02-28 | Version: 1.0**

*All claims in this document are annotated as [CODE-VERIFIED] (backed by a specific file/API) or [ASPIRATIONAL] (design target, not yet enforced in production).*

---

## Official Self-Definition

> **CEI is a publicly verifiable, deterministic, governance-bound education intelligence infrastructure.**

This is not marketing language. Each word is technically enforced:
- **Publicly verifiable:** `GET /api/verify/methodology` and `GET /api/verify/institution/:id/manifest` allow any developer to independently recompute any CEI score. [CODE-VERIFIED: `/backend/routes/verify.js`]
- **Deterministic:** SHA-256 fingerprinting on all scoring engine runs guarantees identical outputs from identical inputs. [CODE-VERIFIED: `src/phase3_score.py`]
- **Governance-bound:** ScoringVersion activation requires 5 gates; active versions are frozen for 90 days minimum. [CODE-VERIFIED: `/backend/routes/governance.js`, `GovernanceCharter v1.0`]
- **Infrastructure:** Field-level provenance, AuditLog, Merkle-verified backups, incident framework, and a public API — this is infrastructure, not a website. [CODE-VERIFIED: Phases X–XV]

---

## Differentiation from NIRF / AISHE

| Dimension | NIRF | AISHE | CEI |
|---|---|---|---|
| **Scoring transparency** | Methodology PDF published | Data published | Live API — machine-readable weights |
| **Reproducibility** | Cannot verify independently | Not applicable | Any developer can recompute any score |
| **Methodology immutability** | Annually revised | Data collection | Version-locked with freeze windows |
| **Data provenance** | Institution self-reported | Government forms | Field-level source + confidence labels |
| **Dispute resolution** | Survey/committee | Not applicable | Evidence packet API (cryptographic) |

**CEI does not compete with NIRF or AISHE.** It is designed to complement them:
- AISHE provides ground truth data (enrollment, courses, faculty)
- NIRF provides government-ranked outcomes
- CEI provides a **deterministic, open, recomputable** intelligence layer on top of the same ecosystem

---

## Technical Claims (All Verifiable)

| Claim | Verification |
|---|---|
| Scoring is deterministic | Run `POST /api/verify/recompute` with any institution's vectors — result matches stored score |
| Versions cannot change silently | Mongoose pre-hook rejects weight updates on active versions |
| Data provenance is field-level | `GET /api/v1/institution/:id/integrity` returns per-field source type and confidence |
| Backups are Merkle-verified | `node backend/scripts/restore.js` verifies pre/post Merkle root match |
| JWT governance tokens can be revoked | `POST /api/admin-auth/revoke` with JTI |
| Emergency incidents are auto-classified | `lib/incident.js` — S1 incidents trigger AuditLog + webhook |

---

## No Unverifiable Claims

The following statements are **ASPIRATIONAL** and not yet enforced in code:

1. [ASPIRATIONAL] CEI covers 68,168+ institutions with fully verified data.
   *Current state: Coverage is deterministic for all records in the scoring CSV; field-level verification is in progress.*

2. [ASPIRATIONAL] CEI is recognized by regulatory bodies (UGC, AICTE).
   *Current state: CEI is independent infrastructure. No formal recognition exists.*

3. [ASPIRATIONAL] CEI issues legally admissible institutional certifications.
   *Current state: Evidence packets are cryptographically sound but have no legal standing yet.*

---

## Regulatory Positioning

CEI is designed to **withstand** regulatory scrutiny, not to claim regulatory authority.

Under hostile examination, CEI can produce:
- **ScoringVersion proof:** Timestamped, frozen, and chaos-certified. [CODE-VERIFIED: `GET /api/evidence/version/:id/proof`]
- **Dataset hash:** SHA-256 fingerprint of the exact dataset used for any scoring run. [CODE-VERIFIED: `scoring_run_manifest.json`]
- **Record hash:** Per-institution tamper-evident hash for any point-in-time record. [CODE-VERIFIED: `GET /api/verify/record-hash/:id`]
- **Evidence packet:** Structured regulatory-grade proof bundle with self-signing hash. [CODE-VERIFIED: `GET /api/evidence/:collegeId`]

---

## Commitment to Neutrality

CEI's monetization architecture is **constitutionally separated** from its scoring engine:
- No commercial relationship alters any score, rank, or band.
- All CEI scores, methodology, and verification APIs are always publicly free.
- Any attempt to monetize ranking positions is a Governance Charter violation.

[CODE-VERIFIED: `SubscriptionTier.js` pre-save hook, `monetization_constitution.md`]

---

*End of CEI National Positioning White Paper v1.0*
*Document Hash: [Compute SHA-256 of this file to verify integrity]*
