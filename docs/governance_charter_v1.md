# CEI Governance Charter v1.0
**Effective: 2026-02-28 | Status: RATIFIED | Authority: Constitutional**

*This charter governs all operational and methodological decisions for the CEI (Constitutional Education Intelligence) platform. No clause may be violated by any operator, subscriber, or automated system. All clauses are enforced through code — the codebase IS the enforcement mechanism.*

*Charter Hash: [Stored in GovernanceCharter MongoDB collection on ratification]*

---

## Article I — Scoring Version Amendment Protocol

**Clause 1.1 — Five-Gate Activation**
No ScoringVersion may be activated without passing all 5 gates in sequence:
- **Gate 1:** Authentication — valid super_admin JWT required
- **Gate 2:** Draft Creation — from a verified `scoring_run_manifest.json` with SHA-256 fingerprint
- **Gate 3:** Peer Review — at least one `reviewer` role must approve via `/api/governance/version/:id/review`
- **Gate 4:** Chaos Certification — `chaosVerdict: "RESILIENT"` must be recorded
- **Gate 5:** Activation — final super_admin confirmation

**Clause 1.2 — Review Window**
Every new ScoringVersion must remain in `draft` status for a minimum of **7 calendar days** before it may proceed to Gate 5. Automated activation bypassing this window is a code-level violation.

**Clause 1.3 — No Silent Methodology Changes**
Weight changes, vector additions, or penalty vector modifications must create a **new** ScoringVersion. Patching weights in an existing active version is prohibited. Enforced by: Mongoose `pre('save')` hook rejecting updates to `weights` on active versions.

**Clause 1.4 — Change Log Requirement**
Every new ScoringVersion must include a `changesSummary` field describing what changed from the previous version. Empty `changesSummary` on a new version results in Gate 2 rejection.

---

## Article II — Freeze Window Enforcement

**Clause 2.1 — Minimum Freeze Duration**
Every newly activated ScoringVersion carries a `freezeUntil` date: minimum **90 calendar days** from activation date.

**Clause 2.2 — Freeze Window Override**
A freeze may only be terminated early under an **S1 Governance Compromise incident** — documented in the AuditLog with incident ID, rationale, and super_admin JWT signature. No other condition permits early termination.

**Clause 2.3 — Scheduler Enforcement**
The daily `freeze-window-check` scheduler job monitors all active versions. Versions with `freezeUntil < now` trigger a logged warning. Versions with unexpired freeze windows that show weight mutations trigger an S1 incident automatically.

---

## Article III — Emergency Rollback Procedure

**Clause 3.1 — Rollback Conditions**
A ScoringVersion may be rolled back to the previous version ONLY if:
- An S1 incident has been formally raised and acknowledged
- The active version is fewer than 24 hours old (Cooling-Off Window)
- Two super_admin JWTs independently confirm the rollback

**Clause 3.2 — Rollback Does Not Delete**
Rolled-back versions are never deleted. They are set to `status: "rolled_back"` with a `rollbackReason` field. All computed scores remain attributable to the version that generated them.

**Clause 3.3 — Post-Rollback Audit**
Within 7 days of a rollback, a `changesSummary` explaining the failure must be appended to the rolled-back version record. This is enforced by the scheduler `monthly-integrity-recompute` job.

---

## Article IV — Key Rotation Standards

**Clause 4.1 — JWT_SECRET Rotation**
`JWT_SECRET` must be rotated every **90 days**. Rotation procedure:
1. Issue new JWT_SECRET to Vercel environment variables
2. Revoke all outstanding tokens via `POST /api/admin-auth/revoke` for each active JTI
3. Re-authenticate all operator sessions with the new secret
4. Log rotation event to AuditLog with `event: "KEY_ROTATED"`

**Clause 4.2 — BACKUP_ENCRYPTION_KEY Rotation**
`BACKUP_ENCRYPTION_KEY` (AES-256-GCM) must be rotated every **180 days**. Old key must be retained in a secure vault for 1 year to allow decryption of historical backups.

**Clause 4.3 — No Hardcoded Secrets**
Zero secrets may appear in source code. Enforcement: GitHub secret scanning enabled on repository.

---

## Article V — Governance Role Permissions Matrix

| Action | super_admin | reviewer | auditor | anonymous |
|---|:---:|:---:|:---:|:---:|
| Activate ScoringVersion | ✅ | ❌ | ❌ | ❌ |
| Draft ScoringVersion | ✅ | ❌ | ❌ | ❌ |
| Approve at Gate 3 | ✅ | ✅ | ❌ | ❌ |
| Certify Chaos (Gate 4) | ✅ | ❌ | ❌ | ❌ |
| View Audit Log | ✅ | ✅ | ✅ | ❌ |
| View Verification Queue | ✅ | ✅ | ✅ | ❌ |
| Approve Verification Task | ✅ | ✅ | ❌ | ❌ |
| Revoke JWT Token | ✅ | ❌ | ❌ | ❌ |
| Trigger Manual Scans | ✅ | ✅ | ❌ | ❌ |
| View Transparency API | ✅ | ✅ | ✅ | ✅ |
| View Public API v1 | ✅ | ✅ | ✅ | ✅ |
| Emergency Rollback | ✅ (2 required) | ❌ | ❌ | ❌ |

---

## Article VI — No Undocumented Powers

**Clause 6.1 — Explicit Authorization Only**
Any API action that modifies CEI state (scores, versions, field sources, audit records) must be explicitly authorized by this charter. Any action not listed in Article V is **prohibited by default**.

**Clause 6.2 — Code-Charter Alignment**
Every clause in this charter must have a corresponding enforcement mechanism in code. Clauses without code enforcement are considered aspirational and must be annotated `[TODO: Code Enforcement]`.

**Clause 6.3 — Charter Immutability**
This charter, once ratified, is stored with its SHA-256 hash in the `GovernanceCharter` MongoDB collection. The record is set to `status: "ratified"` and the Mongoose pre-hook prevents updates. Amendment requires a new charter version (`v2.0`) to be ratified following the same protocol as ScoringVersion activation (Article I).

---

## Article VII — Monetization Neutrality

**Clause 7.1 — Score Neutrality Absolute**
No monetary subscription, payment, or commercial relationship may influence any institution's CEI score, ranking, or competitiveness band. This is enforced by the `SubscriptionTier` model being entirely decoupled from `ScoringVersion`.

**Clause 7.2 — Prohibited Revenue Actions**
The following are permanently prohibited:
- Paid score modification or rank adjustment
- Tiered score visibility (all scores are always public)
- Silent weight bias for subscribing institutions
- Undisclosed methodology changes tied to commercial relationships

**Clause 7.3 — Permitted Revenue Streams**
- Advanced simulation API access (Pro/Enterprise subscription tiers)
- PDF evidence packet exports
- Bulk data API access above rate limits
- Custom peer clustering and benchmarking reports

---

*End of CEI Governance Charter v1.0*
*Ratification must occur via: POST /api/governance/charter/ratify (super_admin JWT required)*
*Charter document hash stored in: GovernanceCharter MongoDB collection*
