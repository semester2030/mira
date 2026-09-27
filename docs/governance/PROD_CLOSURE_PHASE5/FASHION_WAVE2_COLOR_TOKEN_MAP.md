# Fashion Wave 2 — Color token decision gate (exact names)

Canonical file: `lib/shared/theme/colors.dart` → class `AppColors`

| CURRENT TOKEN (repo) | HEX | PROPOSED / ACTUAL FASHION USAGE (Wave 2) |
|----------------------|-----|------------------------------------------|
| `AppColors.background` | `#FFF7FA` | Primary Fashion result canvas |
| `AppColors.surface` | `#FFFFFF` | Hero panel, Ask Mira, occasion row, piece cards |
| `AppColors.card` | = surface | Same as surface (alias) |
| `AppColors.primary` | `#E86FA9` | Brand accent: chips emphasis, progress, Ask Mira icon, text links |
| `AppColors.primaryLight` | `#FADAE9` | Soft chip / ActionChip fill (limited area) |
| `AppColors.primaryDark` | `#C95889` | Not newly expanded in Wave 2 |
| `AppColors.secondary` | `#C19EE0` | Secondary emphasis only — not page-scale fill |
| `AppColors.accent` | `#FFB6B9` | Not used as Fashion page wash |
| `AppColors.textPrimary` | `#4A3A3A` | Garment title, section headings |
| `AppColors.textSecondary` | `#524343` | Body / supporting copy |
| `AppColors.textTertiary` | `#6D5C5C` | Captions, demoted occasion line, absence labels |
| `AppColors.border` | `#F8BBD0` | Light borders + light-swatch visibility ring |
| `AppColors.onPrimary` | white | Dark-swatch ring / contrast on brand |
| `AppColors.shadow` | `0x1A000000` | Photo hero scrim alphas only |
| `AppColors.success` | `#A469C9` | Semantic confirmed states only (e.g. strengths) |
| `AppColors.gold` / `goldLight` | gold family | Semantic / trust accents — not Fashion rebrand |
| `AppColors.error` / `warning` / `info` | semantic | Unchanged — not remapped to garment colors |
| `AppColors.cardPurple` / `cardPink` | tint fills | **Demoted** — Ask Mira no longer uses purple well |
| `AppGradients` / Delight background | gradient | **Removed** from Fashion result shell |
| Runtime garment HEX | data | Via `FashionColorBinding` — NOT a Design System token |

## New tokens proposed / added

| MISSING TOKEN | Decision |
|---------------|----------|
| — | **None.** Existing tokens achieved the light Fashion composition. |

## Parallel Fashion theme

**NO**

## Hardcoded UI colors introduced by Wave 2

**0** unjustified.  
Exempt: runtime HEX data; `Colors.transparent` for modal sheets.
