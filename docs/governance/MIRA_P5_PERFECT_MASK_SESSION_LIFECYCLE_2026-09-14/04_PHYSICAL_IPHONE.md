# Physical iPhone acceptance

Device: fayez iPhone `00008110-00191986268BA01E`
Build: Flutter **profile** (signed)

## Required owner check
1. One real Skin analysis (signed-in → `/ai/skin-analysis`).
2. Open Face Explorer.
3. Tap المسام — HUD must show:
   `SESSION_READY bytes=<positive>`
   NOT `NO_SESSION`.
4. Repeat التجاعيد / الترطيب / الدهون / التصبغات / الحبوب — same session, bytes>0 when artifact exists.

## Status
PHYSICAL IPHONE: install this build → **OWNER CONFIRM SESSION_READY**
OWNER VISUAL APPROVAL: PENDING
VISIBLE MASKS: deferred until SESSION_READY proven (per task gate)

If HUD still shows NO_SESSION after this build on a fresh analysis, breakpoint moves to **MASK_SESSION_CREATE** (ephemeralMasks missing from API response) — still not UI.
