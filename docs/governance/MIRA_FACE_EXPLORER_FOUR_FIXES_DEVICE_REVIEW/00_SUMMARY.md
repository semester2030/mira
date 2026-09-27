# MIRA Face Explorer — four fixes device review

## Verdict

Code merge of `MIRA_FACE_EXPLORER_FOUR_FIXES` is in the tree; profile build
`1.0.0+2026091708` succeeded; related tests passed. **Visual clarity and
approved-layout parity on a physical iPhone are NOT proven** — install and
same-attempt screenshots were not completed this session.

## Closed in code

1. **Lens size from real layout width** — `LayoutBuilder` + `FaceExplorerLensGeometry` (no fixed 400 assumption).
2. **Selected pixel centered at ×2/×3** — shared photo+mask `Positioned.fromRect`; stage focus ring via `stageFocusPoint`.
3. **One mask presentation** — `FaceExplorerMaskPresentation`; `presentationDecoded=true` only for remapped bytes; raw fallback stays `false`.
4. **Score scope labels** — forehead score labeled as forehead; missing region score not replaced by zero/other region.

## Clarity (presentation-only)

- Profile bumps (opacity / `minVisibleAlpha`) via `profileForConcern` without changing analysis scores or inventing marks.
- `FilterQuality.medium` for remapped masks only (`02_renderer_sampling`).
- Wash kill: wrinkles/pores/oiliness `luminanceGateFloor` raised to **62** (above Perfect gray wash ≈61) so `minVisibleAlpha` cannot paint the face; mid strokes (~78) still pass. Synthetic clarity evidence under `evidence/clarity_synthetic/`.

## Untested (must not claim closed)

- Real-attempt oil amber / wrinkle green / pore cyan readability at natural size
- Lens center match at ×2/×3 and tap-ring alignment on device
- Side-by-side vs `MIRA_MAP_APPROVED_INPUTS_AND_REVIEW` at equal dimensions
- Manual capture re-check

## Build identity

See `evidence/BUILD_ID.txt` → `1.0.0+2026091708`.
