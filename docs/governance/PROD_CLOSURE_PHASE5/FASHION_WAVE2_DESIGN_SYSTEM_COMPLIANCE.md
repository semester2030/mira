# FASHION WAVE 2 — DESIGN SYSTEM COMPLIANCE

**Task:** `MIRA-P5-FASHION-VISUAL-REFINEMENT-WAVE2-2026-09-07`  
**BASE SHA:** `248e7ccfd3a5a13001964d788c63703776c98f3f`  
**OWNER VISUAL APPROVAL:** PENDING

## Canonical Design System files

- `lib/shared/theme/colors.dart` → `AppColors`
- `lib/shared/theme/typography.dart` → `AppTypography`
- `lib/shared/theme/spacing.dart` → `AppSpacing`
- `lib/shared/theme/borders.dart` → `AppBorders`
- `lib/shared/theme/shadows.dart` → `AppShadows`
- `lib/shared/theme/gradients.dart` → `AppGradients`
- `lib/shared/theme/theme.dart` → `AppTheme`
- Buttons: `PremiumButton` variants (`primary` / `secondary` / `ghost` / `gold`)

## Parallel Fashion theme

**NO**

## Tokens reused (Wave 2)

| Token | Fashion usage |
|-------|----------------|
| `AppColors.background` | Result canvas (replaced Delight/gradient shell) |
| `AppColors.surface` | Hero panel, Ask Mira, occasion row, piece cards |
| `AppColors.primary` | Brand accent, chips, progress, Ask Mira icon |
| `AppColors.primaryLight` | Soft chip / chip fills |
| `AppColors.secondary` | Secondary emphasis only (not page fill) |
| `AppColors.border` | Light borders + light-swatch ring |
| `AppColors.onPrimary` | Dark-swatch ring / active contrast |
| `AppColors.textPrimary` | Titles / headings |
| `AppColors.textSecondary` | Body / supporting |
| `AppColors.textTertiary` | Captions / demoted labels |
| `AppColors.success` / `gold` / `error` | Semantic states only |
| `AppShadows.card` | Piece card elevation |
| `PremiumButton` ghost/secondary | CTA hierarchy demotion |

## Tokens added

**0** — existing tokens sufficient; no Fashion-local palette.

## Hardcoded UI colors (Wave 2 changed files)

| Location | Before | After | Verdict |
|----------|--------|-------|---------|
| Hero title `Color(0xFF3D2F45)` | hardcoded | `textPrimary` | FIXED |
| Hero photo scrim black ARGB | hardcoded | `AppColors.shadow` alphas | FIXED (photo scrim) |
| Luxury card `Colors.white` / brown / purple text | hardcoded | `surface` / `textTertiary` / `textPrimary` | FIXED |
| Image frame `#FAFAFA` + black shadow | hardcoded | `background` + border token | FIXED |
| Insight section `Color(0xFF5A4A6A)` | hardcoded | `textPrimary` | FIXED |
| Makeup illustration fallbacks `#E8A0B0`… | hardcoded Fashion pinks | `primaryLight` / `primary` / `secondary` | FIXED |
| Ask Mira `cardPurple` well | brand-tint overload | light surface + `primary` icon | FIXED |
| Occasion gradient fill | primary+secondary wash | surface + border row | FIXED |
| Result shell Delight gradient + sparkles | large purple/pink | flat `background` | FIXED |

## New unjustified hardcoded UI colors introduced

**0**

## Runtime Fashion HEX

- Pipeline: `FashionColorBinding` (HEX-first)
- False gray `#9E9E9E`: still blocked
- Garment colors rendered as **DATA**, not tokens
- Look-chapter strip: `OutfitGarmentColorStrip` uses binding only

## Semantic separation

| Domain | Tokens / source |
|--------|-----------------|
| Brand | `primary`, `primaryLight`, `secondary` for CTA/identity |
| Semantic UI | `success`, `gold`, `error`, `warning` for states |
| Fashion data | runtime HEX via binding |

## Typography / spacing / buttons / surfaces

- Typography: `AppTypography.*` only in changed Fashion presentation
- Spacing: normalized section gaps; chapter strip height reduced (74→36)
- Buttons: canonical `PremiumButton`; sticky next = `secondary` (was primary-dominant)
- Surfaces: fewer cards; color harmony is plain section; reason lists uncarded

## Dark Mode

Not invented in Wave 2.
