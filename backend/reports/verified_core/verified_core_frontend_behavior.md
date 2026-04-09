# Verified Core 1.0 Frontend Behavior

## Visual Identity
Verified Core institutions will display a specific "Brutally Verified" badge in the header.

## Rules for Data Display

### 1. Verified Data Layer
- **Display**: Shown with a distinct green check and a sub-label: "Source: [Official Source]".
- **Hover**: Tooltip showing the exact verification timestamp and match basis.

### 2. Unavailable Data Layer
- **Behavior**: Instead of hiding the section, show a "Truth Pending" placeholder.
- **Copy**: "Official [Fees/Placements/Seats] for 2024-25 are currently being verified against primary records. Subscribe to updates."
- **Constraint**: **NEVER** show legacy values in this mode.

### 3. Derived Data Layer
- **Display**: Shown with an info icon.
- **Label**: "Deterministic Derived Truth".
- **Disclaimer**: "This data is mapped via official institutional identifiers but not yet manually certified by the source authority."

---

## Technical Integration
Frontend will consume the new `/api/colleges/:id/truth` endpoint. If the page is in "Verified Mode", it will ignore the standard `college` data object for these layers and rely 100% on the `truth` slice.
