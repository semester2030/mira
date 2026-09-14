# MAJOR-9L-01 Root Cause

**Old behavior:** `face-intelligence-projector.ts` sealed `focus.publicFactAr` / `focus.reasonAr` with `provenance: canonical_face_report` without verifying against stored Face report.

**Impact:** A client could forge beauty/medical/golden-ratio text and have Advisor treat it as Face Intelligence evidence (Laws #33/#34 spirit violated).

**Fix:** Never read client free text for sealing. Resolve selection identifiers against `report.faceIntelligence` and project stored fields only.
