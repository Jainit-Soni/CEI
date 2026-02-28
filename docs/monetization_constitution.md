# CEI Monetization Constitution v1.0
**Status: RATIFIED | Authority: GovernanceCharter v1.0, Article VII**

*This document defines the boundaries of CEI commercial activity. Violations constitute a Governance Charter breach.*

---

## Absolute Prohibitions (Cannot be changed by any operator, under any circumstance)

| Prohibited Action | Enforcement |
|---|---|
| Modifying scores for payment | `ScoringVersion` Mongoose pre-hook rejects weight changes on active versions |
| Creating "premium rank" tiers | `SubscriptionTier.features.scoreVisibility` is immutable `true` |
| Hiding methodology from non-subscribers | `features.methodologyAccess` is immutable `true`; `/api/verify/*` is always public |
| Applying hidden weights to subscriber institutions | Zero coupling between `SubscriptionTier` and `ScoringVersion` models |
| Charging for dispute submission | Dispute API is always free |

---

## Permitted Revenue Streams

| Tier | Revenue Mechanism | Score Impact |
|---|---|---|
| Pro (₹3,499/mo) | Advanced simulation API, trajectory Monte Carlo, peer cluster | **ZERO** |
| Enterprise (₹21,999/mo) | Bulk data export, custom clustering, evidence PDF, dedicated support | **ZERO** |
| All tiers | Verified Institution Badge embedding | **ZERO** |

---

## Governance Compliance

This document is stored with its SHA-256 hash in the `GovernanceCharter` MongoDB collection.
Any change to permitted or prohibited activities requires a new `GovernanceCharter` version to be ratified (Article I).

*Document Hash: [Compute SHA-256 of this file to verify]*
