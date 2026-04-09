# Maharashtra FRA 2024 Dry-Run Mapping Summary

## Constraints
- **Policy**: Deterministic EN-code Mapping Only
- **Fuzzy Matching**: DISABLED
- **Database Target**: `cei_v2`

## Results
- **Total Rows Analyzed**: 146
- **Successfully Mapped**: 0
- **Unmapped**: 146
- **Conflicts detected**: 0
- **Expected Coverage Gain**: 0 verified fees

### Conclusion
As anticipated under strict deterministic constraints, if the MongoDB document does not natively contain the DTE "EN-code" as an identifier (`id`, `stableKey`, or `meta.dteCode`), mapping yield will be low or zero. In order to ingest this structured fee truth, a bridging phase (DTE-to-AISHE) or supervised fuzzy linker must be executed first to populate the necessary identifiers.
