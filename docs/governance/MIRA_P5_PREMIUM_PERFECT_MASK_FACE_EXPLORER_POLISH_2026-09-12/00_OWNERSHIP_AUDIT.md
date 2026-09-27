# Ownership / Reuse Audit — Face Explorer Polish

| Responsibility | Canonical owner | Action | Duplicates |
|---|---|---|---:|
| Perfect mask result | `PerfectMaskSession` / API ephemeralMasks | REUSE | 0 |
| Mask lifecycle | `PerfectMaskSession` | REUSE | 0 |
| Selected metric | `_focusedConcernId` + panel `_selectedId` | REUSE | 0 |
| Selected subregion | panel `_selectedSubregion` | REUSE | 0 |
| Face Explorer | `ResultsSkinMapPanel` | EXTEND presentation only | 0 |
| Mask renderer | `PerfectMaskOverlay` | EXTEND fadeDuration only | 0 |
| Presentation labels | `MetricPresentationPolicy` | EXTEND (ONE map) | 0 |
| Design System | `AppColors` / `AppTypography` / `AppSpacing` / `SkinFaceMapVisualTokens` | EXTEND tokens | 0 |

**ACTIVE DUPLICATE RESPONSIBILITIES = 0**  
No MaskService / PremiumFaceExplorerController / SkinMaskProvider / parallel theme.
