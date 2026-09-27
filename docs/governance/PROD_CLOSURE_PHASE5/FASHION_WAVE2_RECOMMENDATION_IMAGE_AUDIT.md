# Wave 2 — Recommendation image source audit

| Source class | How it appears | Wave 2 treatment |
|--------------|----------------|------------------|
| REAL PRODUCT/GARMENT IMAGE | `SuggestedPieceModel.imageAsset` loads via `Image.asset` | Shown when asset exists |
| REAL GENERATED/PROVIDER IMAGE | Not fabricated in presentation | Unchanged — no fake generation |
| KNOWN STATIC CATEGORY ASSET | Catalog PNG under assets | Shown when path valid |
| GENERIC PLACEHOLDER | Prior checkroom + soft purple wash + “قريباً” | Replaced with quieter DS absence: checkroom + `textTertiary` + “لا توجد صورة لهذه القطعة” |
| MISSING IMAGE | `errorBuilder` | Same elegant absence — no invented dress imagery |

**Rule:** Do not fabricate recommendation imagery to match reference.
