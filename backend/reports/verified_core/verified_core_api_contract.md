# Verified Core 1.0 API Contract (v1)

## Base Endpoint: `GET /api/colleges/:id/truth`

This endpoint provides a strictly filtered payload for high-trust consumption. Any field not meeting the `official_verified` or `derived_deterministic` standard is returned as `unavailable`.

## Response Schema

```json
{
  "collegeId": "CORE-IITM",
  "name": "Indian Institute of Technology Madras",
  "verifiedStatus": "verified_core_member",
  "layers": {
    "identity": {
      "status": "official_verified",
      "source": "AISHE 2024",
      "data": {
        "aisheCode": "C-34021",
        "type": "IIT",
        "established": 1959
      }
    },
    "fees": {
      "status": "official_verified",
      "source": "Official Gazette 2024-25",
      "year": "2024-25",
      "data": {
        "tuition": 200000,
        "total": 212000
      }
    },
    "placements": {
      "status": "unavailable",
      "reason": "NIRF 2024 Data not yet ingested"
    },
    "rankings": {
      "status": "official_verified",
      "source": "NIRF 2024",
      "data": [
        { "category": "Overall", "rank": 2 }
      ]
    },
    "seats": {
      "status": "unavailable"
    }
  }
}
```

## Logic
1.  **Strict Filtering**: If `fees.isVerified` is false, the `fees` layer returns `status: "unavailable"`.
2.  **No Fallbacks**: This endpoint **never** falls back to legacy/estimated data.
3.  **Provenance Mandatory**: Every `official_verified` layer must include a `source` and `year` field.
