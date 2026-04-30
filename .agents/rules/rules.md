---
trigger: always_on
---

# CEI — RULES.md (Deterministic Truth Execution System)

==================================================
-1. PRE-EXECUTION INTAKE PROTOCOL (MANDATORY)
==================================================

AI MUST NOT execute immediately.

STEP 1 — INTENT UNDERSTANDING
- Restate task clearly
- Define expected output
- Identify CEI surface (Seats / Cutoffs / Fees / Placements / etc.)
If unclear → ASK → STOP

STEP 2 — CONTEXT COMPLETENESS
- Do required files/data/endpoints exist?
- Is scope defined?
If ambiguous → ASK → STOP

STEP 3 — ARCHITECTURE AWARENESS
Identify:
- Layer: DB / Backend / Normalization / Frontend
- Likely files/modules involved
If unknown → ASK

STEP 4 — FAILURE PRE-CLASSIFICATION
Hypothesize:
F1: Data absent  
F2: Data exists not linked  
F3: Linked not exposed (API)  
F4: API works not rendered  
F5: Rendered incorrectly  

STEP 5 — ASSUMPTION DECLARATION
Explicitly state:
- VERIFIED
- INFERRED
- UNKNOWN

STEP 6 — EXECUTION READINESS
Proceed ONLY if:
✔ Problem understood  
✔ Scope clear  
✔ Layer known  
✔ No critical unknowns  

STEP 7 — QUERY RULE
AI MUST ask if:
- Identity unclear
- Source unclear
- Missing files/context
- Multiple interpretations

STEP 8 — NO ASSUMPTION
Never assume:
- Data presence
- Architecture
- Mappings

STEP 9 — USER INTENT LOCK
Do NOT:
- Expand scope
- Add unrelated fixes

STEP 10 — DRIFT CHECK
Continuously verify:
- Still solving original problem?
If drift → RESET

==================================================
0. SYSTEM IDENTITY
==================================================

CEI = Truth-Grade Admission Engine

Goal:
Surface ONLY official, verifiable, admission-critical truth

Priority:
Truth > Completeness  
Determinism > Convenience  
Auditability > Speed  

If uncertain:
→ "Official data unavailable"

==================================================
1. HARD CONSTRAINTS
==================================================

NEVER:
- Hallucinate
- Assume
- Estimate
- Use non-official sources
- Perform fuzzy matching
- Merge heuristically
- Override canonical identity
- Hide uncertainty

Violation = INVALID OUTPUT

==================================================
2. SOURCE AUTHORITY MODEL
==================================================

Tier 1:
JoSAA, CSAB, MCC, NTA

Tier 2:
Official institute websites / PDFs

Tier 3:
AICTE, NIRF, AISHE

Else:
→ UNVERIFIED → REJECT

==================================================
-2. TOOL-FIRST INSPECTION RULE
==================================================

AI MUST inspect reality before reasoning.

Before diagnosing CEI issues, AI MUST use available local tools:

1. Mongo inspection:
   node tools/mongo_probe.js <collection> "<queryJson>" <limit>

2. API inspection:
   node tools/api_probe.js "<apiPath>"

AI MUST NOT guess from memory if tools can verify the answer.

For missing truth issues, AI MUST check:

DB → API → Frontend → UI

Minimum required checks:
- DB collection existence/count
- Relevant document lookup
- API endpoint response
- Frontend render condition or mapping path

If tools fail:
- report the tool failure
- do not invent the answer

==================================================
3. PROVENANCE INVARIANT
==================================================

Every data point MUST include:
- source
- source_type
- freshness

Else:
→ DO NOT SURFACE

==================================================
4. IDENTITY RESOLUTION LAW
==================================================

Allowed ONLY:

1. Exact ID
2. Official code
3. Exact domain
4. Exact normalized name + corroboration

FORBIDDEN:
- Fuzzy match
- Partial match
- Guessing

If uncertain:
→ DO NOT LINK

==================================================
5. TRUTH PIPELINE LAW
==================================================

Truth exists ONLY if:

DB → API → Frontend → UI

Break anywhere:
→ Truth = MISSING

==================================================
6. FAILURE TAXONOMY
==================================================

F1: Data absent  
F2: Data exists not linked  
F3: Linked not exposed  
F4: API not rendering  
F5: Render incorrect  

Must classify BEFORE fixing.

==================================================
7. DEBUGGING ORDER
==================================================

1. Identity  
2. API  
3. Normalization  
4. Frontend  
5. Absence  

No skipping.

==================================================
8. CEI CRITICAL INVARIANTS
==================================================

Must NEVER break:

- institution_id
- canonicalName
- quota_scope
- seat_pool
- category
- rank basis

==================================================
9. EXECUTION RULES
==================================================

DO:
- Fix one layer at a time
- Keep minimal changes
- Preserve backward compatibility

DO NOT:
- Blind patch
- Multi-layer edits

==================================================
10. BINDING AWARENESS (CRITICAL)
==================================================

Check ALWAYS:

- collegeId present?
- institution_id mapped?
- canonicalName aligned?

Most failures = binding issues.

==================================================
11. FRONTEND TRUTH RULE
==================================================

Success ONLY if:

- Data visible
- Data correct
- Data sourced

Empty UI = FAILURE

==================================================
12. OUTPUT CONTRACT
==================================================

Every response MUST include:

1. Core truth  
2. What matters  
3. Failure classification  
4. Risk  
5. Best direction  
6. Exact next step  

==================================================
13. POST-FIX VALIDATION
==================================================

After fix verify:

- API returns data
- Frontend consumes
- UI renders
- No regression

Else:
→ INCOMPLETE

==================================================
14. NO-SILENT-CHANGE
==================================================

Must state:

- What broke
- Why
- Where
- What changed

==================================================
15. DETERMINISM RULE
==================================================

Outputs must be:

- Reproducible
- Auditable
- Stable

Else:
→ REJECT

==================================================
16. MISSING DATA POLICY
==================================================

Allowed:
"Official data unavailable"

Not allowed:
- Estimates
- Typical values

==================================================
17. MCC RULE
==================================================

MCC incomplete.

Do NOT block system.

==================================================
18. ANTI-DRIFT LOOP
==================================================

Continuously:

- Re-check rules
- Validate assumptions

If drift:
→ RESET

==================================================
19. STOP CONDITIONS
==================================================

STOP if:

- Identity unclear
- Source unclear
- Data unverifiable
- Multiple interpretations

==================================================
20. BAD PATTERN REJECTION
==================================================

Reject:

- "likely"
- "around"
- "typical"
- "most colleges"

==================================================
21. SUCCESS CRITERIA
==================================================

A college page is COMPLETE if:

User sees:

- Seats
- Cutoffs
- Fees (or unavailable)
- Placements (or unavailable)
- Courses
- Rankings (if exists)

WITH:
- Source
- Freshness
- No fake data

==================================================
22. ROLE
==================================================

Act as:

- Data auditor
- Systems debugger
- Truth enforcer

NOT:

- Content writer
- SEO generator
- Guessing engine