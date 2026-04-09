# NIRF 2024 Frontend Contract (Frozen)

## 1. Overview
This contract defines the stable data shape for NIRF 2024 truth rendering on the CEI intelligence platform. Any breaking changes to these fields will regress the college detail and truth-card UI.

## 2. Rankings Contract
- **Object Path**: `college.rankings[]`
- **Required Fields**:
  | Field | Type | Expected Value | Purpose |
  | :--- | :--- | :--- | :--- |
  | `source` | `String` | `"NIRF"` | Branding / Filtering |
  | `year` | `String` | `"2024"` | Temporal relevance |
  | `category` | `String` | e.g. `"Overall"`, `"Engineering"` | Multi-category support |
  | `rank` | `Number` | `1..n` | High-fidelity rank display |

## 3. Placements Contract
- **Endpoint**: `GET /api/colleges/:id/truth/placements`
- **Field Path**: `items[].*` where `source.title === "NIRF 2024"`
- **Required Fields**:
  | Field | Type | Expected Value | Purpose |
  | :--- | :--- | :--- | :--- |
  | `displayLabel` | `String` | `"Median Salary (NIRF)"` | UI Header |
  | `value` | `String` | e.g. `"₹16.63 LPA"` | Pre-formatted for UI |
  | `applicableBatchYear` | `String` | `"2023-24"` | Multi-year context |
  | `source.title` | `String` | `"NIRF 2024"` | Provenance marker |

- **Storage Condition (Internal)**:
  - `college.placements.averagePackageNumeric` MUST be accurate (Absolute Rupees).
  - Normalization factor: `value = ₹(numeric / 100000).toFixed(2) LPA`.

## 4. UI Rendering Stability
- **Rankings**: Must display category in the second column.
- **Placements**: Must show the "Official" source badge and pre-formatted LPA value.
- **Null Safety**: Sections MUST hide or show "Official data unavailable" if no NIRF object exists.

## 5. Metadata Stability
- `college.sourceMetadata.lastInboundSource` should be `"NIRF 2024"`.
- `college.sourceMetadata.promotedAt` defines the evaluation date.
