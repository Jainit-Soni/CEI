
# Surface Tier Exposure Audit

**Date**: 2026-05-01
**Verdict**: ❌ FAIL

## Exposure Detail
- **registry_certified_expected**: 75
- **api_certified_actual**: 74
- **missing_certified_ids**: 1
- **registry_search_discoverable_expected**: 196
- **registry_search_discoverable_exposed**: 196
- **global_search_catalog_count**: 20269
- **hidden_registry_count**: 1
- **hidden_registry_exposed_count**: 0
- **badge_violation_count**: 1
- **final verdict**: FAIL

## Validation Guards
- **Certified Listing Filter**: ❌ FAIL
- **Registry Discoverability Parity**: ✅ PASS
- **Hidden Record Lockdown**: ✅ PASS
- **Badge Integrity**: ❌ FAIL (1 violations)

**Audit Summary**: Visibility discrepancies detected. Review backend filtering logic.
