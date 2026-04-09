# NIRF 2024 Frontend Field Contract

This document defines the data contract between MongoDB, the Backend API, and the Frontend UI for NIRF 2024 truth.

## 1. MongoDB Stored Shape
- **Collection**: `colleges`

### Rankings Structure
- **Field**: `rankings` (Array)
- **Object Schema**:
  ```json
  {
    "source": "NIRF",
    "rank": 15, // Number
    "year": "2024",
    "category": "Engineering" // e.g. "Overall", "Management", "Pharmacy"
  }
  ```

### Placements Structure
- **Field**: `placements` (Object)
- **Object Schema**:
  ```json
  {
    "averagePackage": "1663440", // String representation
    "averagePackageNumeric": 1663440, // Number
    "academicYear": "2023-24",
    "source": "NIRF 2024",
    "isVerified": true
  }
  ```

### Metadata / Provenance
- **Field**: `sourceMetadata`
- **Object Schema**:
  ```json
  {
    "lastInboundSource": "NIRF 2024",
    "promotedAt": "ISO Date String"
  }
  ```

## 2. API Expected Shape
### Placements Truth Endpoint
- **URL**: `/api/colleges/:id/truth/placements`
- **Expected Return**: 
  ```json
  {
    "sectionStatus": "available",
    "freshnessStatus": "verified_audit",
    "items": [
      {
        "displayLabel": "Median Salary (NIRF)",
        "value": "₹16.63 LPA",
        "confidence": 0.98,
        "applicableBatchYear": "2023-24",
        "source": { "title": "NIRF 2024", "type": "official_source" }
      }
    ]
  }
  ```

### College Details Endpoint
- **URL**: `/api/college/:id`
- **Return**: Includes the `college` object with full `rankings` array.

## 3. Frontend Render Shape
- **Rankings Table**: Displays [Authority] [Rank] [Category] [Year].
- **Placement Card**: Displays [Metric Icon] [Display Label] [Metric Value] [Batch Year] [Source Info].
