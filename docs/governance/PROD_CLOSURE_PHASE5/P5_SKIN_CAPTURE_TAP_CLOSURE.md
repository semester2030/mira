# P5 — SKIN CAPTURE TAP CLOSURE

**Task:** `MIRA-P5-SKIN-CAPTURE-TAP-CLOSURE-2026-09-10`

## ROOT CAUSE CLASS: **D + F** (READY desync / dead tap)

### Exact cause

1. **`_canTakePhoto` required `_mirrorGuidance?.isReady == true` even when `FaceCaptureMirrorFlag` is OFF.**  
   Mirror guidance is never evaluated when mirror is disabled → `isReady` stays null → shutter stayed unauthorized.

2. **Shutter `GestureDetector.onTap` was nulled when `enabled` (readiness) flickered false**, so a physical tap during READY→NOT_READY race produced a **dead tap** with no handler and no message.

3. When mirror ON, shutter used `canManualCapture` while visual READY used `isReady` — dual sources.

### Exact fix (surgical)

| File | Change |
|------|--------|
| `skin_capture_tap_gate.dart` | Single `isCaptureReady` predicate |
| `face_capture_panel.dart` | `_canonicalCaptureReady`; pointer always attached while session interactive; reject with visible reason when not ready |
| `skin_capture_tap_debug.dart` | Optional `--dart-define=MIRA_SKIN_CAPTURE_TAP_DEBUG=true` |

**THRESHOLDS MODIFIED: NO**  
**FACE MAP MODIFIED: NO**

## Physical iPhone

Install candidate for owner. 3-tap matrix: **NOT RUN by Cursor** → CAPTURE TAP ACCEPTANCE = BLOCKED until owner confirms 3/3.
