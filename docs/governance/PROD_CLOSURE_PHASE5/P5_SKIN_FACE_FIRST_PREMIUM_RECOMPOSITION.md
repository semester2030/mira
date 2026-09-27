# PHASE 5 — SKIN FACE-FIRST PREMIUM RECOMPOSITION

**Task:** `MIRA-P5-SKIN-FACE-FIRST-PREMIUM-RECOMPOSITION-2026-09-09`  
**Date:** 2026-09-09

## Mission

Presentation-layer recomposition: the **current analysis face** is the primary interaction surface. Truth model unchanged (`LANDMARK_TEMPLATE`).

## Current analysis image

| Rule | Implementation |
|------|----------------|
| Use real capture | `FaceResultMirrorImageHold.prepareFrom` always when Skin Interactive ON |
| Display | `FaceMapBaseMode.ephemeralUserImage` → `Image.file` |
| No stock model | `premium_face_base.png` **not** used as current user face |
| Release | Screen `dispose` + registry on logout |

## Privacy

- `EphemeralAnalysisFaceRegistry` tracks holds
- Logout / guest exit → `AnalysisSession.clear` + `releaseAll`
- No Firebase Storage / Firestore / Postgres image path added
- History: **no** face photo; neutral diagram labeled «تمثيل استرشادي»

## Composition

Personal summary → **large Face Explorer** → metrics → regions → Top Insights → Routine → Journey → Ask Mira → optional transparency

## Iconography

`MiraSkinGlyphs` CustomPainter language — no Material/emoji scatter in Skin Interactive primary chrome.

## Map truth

`LANDMARK_TEMPLATE` / illustrative soft overlays — no invented region scores.

## Owner gate

`OWNER VISUAL APPROVAL = PENDING` · Phase 6 = NOT STARTED
