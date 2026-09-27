# Wave 2 — Before / After inventory

| Area | Wave 1 (owner iPhone) | Wave 2 | Token / purpose |
|------|------------------------|--------|-----------------|
| Background | Delight/gradient + sparkles | Flat blush canvas | `AppColors.background` — less saturation |
| Hero | Full-bleed + 3 chips + purple title | 1–2 chips; `textPrimary` | Brand quieter; garment leads |
| Top hierarchy | Progress + voice bubble + occasion + hero | Compact progress → hero → colors | Reduce dashboard depth |
| Colors | HEX truth + carded harmony | HEX truth + plain section + look strip | Data ≠ brand |
| Cards | Many nested surfaces | Aggressive reduction | Fewer containers |
| Recommendations | Horizontal luxury cards | Same merchandising; softer surface; honest empty image | `surface` + `AppShadows.card` |
| Accessories | Same row | Same; compact cards | No new icons |
| Occasions | Gradient report card under hero | Compact row in wardrobe chapter | `surface` + `border` |
| CTA | Primary sticky next | Secondary sticky; ghost secondaries | `PremiumButton` variants |
| Ask Mira | Purple card + secondary button | Light surface + ghost CTA | Brand accent icon only |
| Spacing | Dense chapter chrome | Tighter progress; more section air | Design system rhythm |

## Hardcoded audit (changed Fashion presentation)

- Unjustified new UI `Color(0x…)` / Fashion-local pinks: **0**
- Runtime garment HEX: exempt (data)
- Makeup empty fallbacks: now `AppColors.primaryLight|primary|secondary`
