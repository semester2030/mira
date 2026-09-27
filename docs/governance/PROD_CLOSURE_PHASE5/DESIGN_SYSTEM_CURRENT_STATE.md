# DESIGN SYSTEM — CURRENT STATE

**Task:** `MIRA-P5-FASHION-VISUAL-REFINEMENT-WAVE2-2026-09-07`  
**WAVE2_BASE_SHA:** `248e7ccfd3a5a13001964d788c63703776c98f3f`  
**WORKTREE_BASELINE:** Wave 1 Fashion UI restructure present (uncommitted) — preserved

## Canonical files

| Area | Path |
|------|------|
| Colors | `lib/shared/theme/colors.dart` → `AppColors` |
| Typography | `lib/shared/theme/typography.dart` → `AppTypography` |
| Spacing | `lib/shared/theme/spacing.dart` → `AppSpacing` |
| Borders | `lib/shared/theme/borders.dart` → `AppBorders` |
| Shadows | `lib/shared/theme/shadows.dart` → `AppShadows` |
| Gradients | `lib/shared/theme/gradients.dart` → `AppGradients` |
| ThemeData | `lib/shared/theme/theme.dart` → `AppTheme` |
| Dark | `lib/shared/theme/dark_mode.dart` (exists; Fashion Wave 2 does **not** invent Dark Mode) |

## Brand / surface tokens (AppColors)

| Token | HEX | Role |
|-------|-----|------|
| `primary` | `#E86FA9` | Brand accent / primary CTA |
| `primaryLight` | `#FADAE9` | Soft brand wash |
| `primaryDark` | `#C95889` | Pressed / deep brand |
| `secondary` | `#C19EE0` | Secondary brand / lavender |
| `accent` | `#FFB6B9` | Soft accent |
| `background` | `#FFF7FA` | App canvas |
| `surface` / `card` | `#FFFFFF` | Elevated surfaces |
| `textPrimary` | `#4A3A3A` | Headings |
| `textSecondary` | `#524343` | Body |
| `textTertiary` | `#6D5C5C` | Captions |
| `border` | `#F8BBD0` | Borders |
| `success` | `#A469C9` | Semantic success (note: purple-tinted) |
| `error` | `#E57373` | Semantic error |
| `warning` | `#FFD54F` | Semantic warning |
| `info` | `#64B5F6` | Semantic info |
| `gold` / `goldLight` | gold family | Emphasis / trust |
| `cardPink` / `cardPurple` | soft fills | Optional tinted cards |
| `onPrimary` | white | Text on brand |
| `gradientStart` / `gradientEnd` | blush→lavender | Background gradients |

## Spacing

`AppSpacing.xs`…`xxxl`, plus `screenPadding`, `cardPadding`, etc.

## Fashion-specific theme

**None.** No parallel Fashion ColorScheme. Runtime garment HEX is **data**, not tokens (`FashionColorBinding`).

## Wave 2 token decisions

| Need | Decision |
|------|----------|
| Fashion canvas | Reuse `AppColors.background` — replace Delight/gradient shell |
| Content surface | `AppColors.surface` sparingly |
| Brand CTA | `PremiumButton` variants + `AppColors.primary` |
| Soft chip | `primaryLight` / `border` alphas — no new pink |
| Text | `textPrimary` / `textSecondary` / `textTertiary` |
| New token | **NONE** — existing tokens sufficient |

## Dark Mode

Not invented in Wave 2. Existing dark tokens left untouched.
