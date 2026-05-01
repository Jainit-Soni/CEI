# CEI Number-Surface Maintenance

This guide documents the regression guards protecting the CEI frontend against unproven hardcoded numeric claims.

## 1. Scope of Protection
The number-surface guard ensures that high-risk marketing placeholders and unverified institutional facts are NOT hardcoded in the frontend source code. This forces the system to rely on deterministic API-backed data or neutral "Pending" states.

> [!WARNING]
> This guard protects against **hardcoded frontend numeric claims**. 
> It does NOT certify database truth, source provenance, or the full integrity of the CEI catalog.

## 2. Forbidden Hardcoded Claims
The following strings are strictly forbidden in any user-visible frontend component:
- **94%** (Placement fallbacks)
- **150+** (Recruiter density fallbacks)
- **4% drop** (Predictive cutoff claims)
- **42 institutes** (Unverified alert counts)
- **10,000+** (Historical headcount claims)
- **1.4M+** (Platform scale claims)
- **800,000** (Tuition fee fallbacks)
- **1,200,000** (Placement salary fallbacks)

## 3. Maintenance Commands
Run these commands regularly during development and as part of the CI pipeline:

```bash
# Verify no forbidden blockers exist in source
npm run verify:number-surface

# Perform a full multi-layer static audit
npm run audit:number-surface
```

## 4. Operational Verdict
The current operational verdict for the CEI number surface is:
**NUMBER_SURFACE_NEEDS_REVIEW**

This status indicates that while all critical blockers have been neutralized, remaining factual constants (e.g., Tier labels, cycle years) still require manual review or formal API linkage.
