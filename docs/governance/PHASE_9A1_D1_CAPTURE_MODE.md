# D1 — Capture Mode

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A.1 — Product Decision Lock + Official Reference Sync  
**Date:** 2026-08-11  
**Mode:** GOVERNANCE ONLY · NO APP IMPLEMENTATION  
**Official portal:** `docs/mira-face-analysis-experience.html`


## Decision: APPROVED
**AUTO-CAPTURE WHEN READY + MANUAL CAPTURE FALLBACK**

### Behavior (design)
face detected → alignment valid → distance valid → lighting acceptable → pose acceptable → stable for hold window → READY → auto capture

Manual shutter remains available.

### Constraints
- Auto-capture MUST NOT fire from face presence alone.
- Requires future **9B readiness contract**.
- Status: DESIGN APPROVED · IMPLEMENTATION NOT_STARTED
