# Frontend & API Visibility Audit
*Note*: This determines if structural components inside data shapes meet minimal thresholds to be passed directly to the React components.

- **Fees Visibility Estimates**: The `/truth/fees` contract guarantees exposure if `isVerified` OR `bridgeStatus` propagates and `totalNumeric` is present.
- **Rankings Visibility Estimates**: The NIRF and overall vault expects Array lengths > 0.
- **Placements Visibility Estimates**: Demands numerical averages/highest.

Check the row-level data matrix CSV to isolate any gaps between `present` and `visible`.