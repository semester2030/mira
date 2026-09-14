# PHASE 5 — FASHION ICON SYSTEM STUDY

**Task ID:** `MIRA-P5-FASHION-ICON-SYSTEM-STUDY-2026-09-07`  
**Mode:** READ-ONLY · DESIGN-SYSTEM STUDY · ASSET SELECTION  
**Date:** 2026-09-07  

> **STUDY ONLY — NO ICON MIGRATION PERFORMED**  
> NO package install · NO Dart edits · NO SVG creation · NO deploy · NO commit

**Upstream evidence:** `P5_FASHION_EXPERIENCE_UX_FORENSIC_AUDIT.md` (ICON SYSTEM = INCONSISTENT)

---

## 1 — Executive verdict

MIRA Fashion currently uses **65 distinct Material icons** across **114 usages** (re-verified 2026-09-07). The fix is **not** 1:1 replacement of 65 glyphs. The production target is a **canonical set of exactly 36 Fashion semantic icons**, plus a separate **System UI** family.

Recommended split after Phosphor catalog matching (`phosphor-icons/core`, 1530 names):

| Bucket | Count |
|--------|------:|
| Phosphor | **21** |
| Custom MIRA SVG | **15** |
| Fashion semantic total | **36** |
| System UI (outside 36) | **29** Material identifiers today → migrate to one Phosphor system set |

**Mandatory gate:** build an **Owner Icon Preview** of all 36 before any production screen migration.

---

## 2 — Verified current reality

| Metric | Value |
|--------|------:|
| Scope | `lib/features/outfit_analysis/**` + `ask_outfit_mira_section.dart` |
| Icon usages | **114** |
| Distinct identifiers | **65** |
| Material | **65** |
| Cupertino | **0** |
| SvgPicture in Fashion feature | **0** |
| Icon-like PNG assets in Fashion feature | **0** (luxury pieces use catalog images separately; `assets/icons/` only has `guest_icon.svg` shared) |

Inventory file: `CURRENT_FASHION_ICON_INVENTORY.json`

Classification of the 65:
- ~29 System-UI-ish (back, check, camera, refresh, chevron, …)
- ~36 Fashion-ish / overloaded semantics (`checkroom`, `auto_awesome`, `air_rounded` for scarf, hearts for occasion, …)

---

## 3 — Package verification (NO INSTALL)

| Field | Value |
|-------|-------|
| CURRENT_FLUTTER_VERSION | **3.38.9** (stable) |
| CURRENT_DART_VERSION | **3.10.8** |
| SDK constraint | `>=3.8.1 <4.0.0` |
| CURRENT_ICON_PACKAGES | Material (SDK), `cupertino_icons: ^1.0.8`, `flutter_svg: ^2.0.10`, `flutter_launcher_icons` (dev) |
| Phosphor today | **Not installed** |

### Deprecated vs maintained

| Package | Status | Notes |
|---------|--------|-------|
| `phosphor_flutter` | **Deprecated / avoid** | Official older Flutter port; Dart 3 `IconData` final-class breakage risk |
| `phosphoricons_flutter` | **Maintained successor naming** | v**1.0.0** (pub.dev, 2026-05-22); Dart 3.x; core **v2.0.8**; MIT; `sdk:>=3.0.0`; **recommended primary** |
| `phosphor_icons` | Alternative community fork | v**3.0.1** (FuncCloud, 2026-07-16); also Dart 3 / Flutter 3.x; more recent publish |

**RECOMMENDED_PHOSPHOR_PACKAGE:** `phosphoricons_flutter: ^1.0.0`  
**RECOMMENDED_VERSION_POLICY:** pin caret `^1.0.0`; re-verify before install; do **not** add `phosphor_flutter`.  
**LICENSE (icon assets):** Phosphor Icons **MIT** (retain copyright notice in source distribution).  
**SDK_COMPATIBILITY:** Compatible with Mira’s Dart 3.10 / Flutter 3.38 constraints (package env `>=3.0.0`).  
**MIGRATION_RISK:** Medium — community packages (not first-party Phosphor team); API differs from Material; duotone may need package widget; Owner may prefer `phosphor_icons` if FuncCloud fork proves healthier — **OWNER DECISION** if primary package choice is contested.  
**PACKAGE INSTALL PERFORMED:** **NO**

**flutter_svg:** Already present — reuse for Custom MIRA SVGs; no new SVG dependency required.

---

## 4 — Exact 36 taxonomy (unchanged count)

Groups A–F as owner-specified (9+4+6+5+6+6 = **36**). No autonomous taxonomy changes.

**OWNER DECISION FLAGS (non-count):**
- Whether `dress` uses Phosphor `dress` vs Custom for perfect garment-family optics (study recommends Phosphor `dress` + Custom peers matched to its geometry).
- Ask Mira: Custom brand-derived (recommended) vs Phosphor stylist metaphor.
- Everyday: `house-simple` vs Custom soft “day look”.

---

## 5 — Phosphor / Custom decisions

See `MIRA_FASHION_36_ICON_MASTER_MATRIX.md`.

**CUSTOM MIRA SVG (15):**  
`blouse`, `skirt`, `jacket`, `coat`, `abaya`, `suit_set`, `fabric`, `silhouette_cut`, `jewelry`, `scarf`, `hat`, `formal`, `special_occasion`, `elegant`, `ask_mira`

**PHOSPHOR (21):**  
`dress`, `shirt`←`shirt-folded`, `pants`, `color_palette`←`palette`, `fit`←`ruler`, `handbag`, `shoe_heel`←`high-heel`, `belt`, `everyday`←`house-simple`, `work`←`briefcase`, `evening`←`moon-stars`, `spring`←`flower`, `summer`←`sun`, `autumn`←`leaf`, `winter`←`snowflake`, `casual`←`sneaker`, `outfit_styling`←`coat-hanger`, `color_harmony`←`swatches`, `recommendations`←`star-four`, `similar_looks`←`images`, `wardrobe`←`dresser`

Match quality notes:
- Never chose Phosphor merely because a glyph exists (`hoodie` ≠ jacket; `air` already wrong for scarf; `heart` rejected for wedding).
- Season set is a coherent Phosphor mini-family — Custom unnecessary.
- Abaya: **CUSTOM only** — respectful garment category; Law #38.

---

## 6 — Custom SVG design contract (canonical)

| Spec | Value |
|------|-------|
| viewBox | `0 0 24 24` |
| Visual grid | 24×24 |
| Primary stroke | **1.6** (range 1.5–1.75) |
| stroke-linecap | `round` |
| stroke-linejoin | `round` |
| Style | Premium outline; optional soft fill only for selected / Ask Mira |
| Optical box | Shared safe padding ≈ 2px inset |
| Color | `currentColor` / theme tokens only — no hardcoded pink |
| Forbidden | Raster, embedded fonts, emoji, unnecessary masks/clipPaths, heavy path noise |
| RTL | Fashion objects **DO_NOT_MIRROR**; directional system icons separate |
| Match target | Optical weight of Phosphor **Light/Regular** so hybrid family coheres |
| Delivery name | `mira_fashion_<semantic_id>.svg` |

**ICON DESIGN CONTRACT:** PASS (ready for artist) — Ask Mira brand mark may need **OWNER DECISION** on emblem motif.

---

## 7 — Optical size system (from MIRA Fashion layouts)

Observed Material sizes today: 12, 14, 15, 16, 18, 20, 22, 26, 28, 32, 40, 48.

| Role | Nominal px | Optical intent | Container | Min touch | Stroke | Label gap |
|------|------------|----------------|-----------|-----------|--------|-----------|
| XS | 16 | Captions / dense chips | none | n/a (non-hit) | 1.5 | 6 |
| SM | 18 | Inline meta | 28 | 44 | 1.5 | 6 |
| MD | **22** | Default Fashion semantic | 36 | **44** | 1.6 | 8 |
| LG | 24 | Section headers / Ask Mira | 40 | 48 | 1.6–1.75 | 8 |
| XL | 28 | Empty states only | 56 | 56 | 1.75 | 10 |

Rule: enlarge **hit target**, not artwork, for accessibility.

---

## 8 — Weight policy

| State | Weight |
|-------|--------|
| DEFAULT | Phosphor **Light** or **Regular** (pick one globally — recommend **Regular** for MD+) |
| SELECTED | **Fill** *or* Regular + filled container (prefer container so stroke family stays coherent) |
| DISABLED | Regular @ 38% opacity via token |
| DECORATIVE | Light |
| PRIMARY ACTION | Regular + brand accent container |

Avoid mixing Thin/Bold/Duotone arbitrarily. Duotone optional later for Ask Mira only after Owner preview.

---

## 9 — Color policy (tokens)

Map to existing `AppColors` — icons must not hardcode:

| Token role | Proposed binding |
|------------|------------------|
| primary icon | `textPrimary` / `secondary` for brand moments |
| secondary icon | `textSecondary` |
| muted | `textTertiary` |
| selected | `primary` or `secondary` on soft `cardPurple`/`primaryLight` fill |
| disabled | muted @ low opacity |
| success/warning/error | `success` / `warning` / `error` — system only |
| fashion accent | `gold` sparingly (Ask Mira / premium moments) |

Fashion semantic grid: **MONOCHROME** by default.  
**SEMANTIC COLOR** never replaces real garment HEX swatches.  
**DUOTONE:** Ask Mira only if Owner approves.

### Color swatch ≠ palette icon
`color_palette` / `color_harmony` are **concept icons**. Detected garment colors remain **HEX/RGB swatches** (separate remediation FX-01).

---

## 10 — System UI icons (outside 36)

Current System-ish Material identifiers (29):  
`arrow_back_*`, `arrow_forward_rounded`, `chevron_left`, `keyboard_arrow_up_rounded`, `close_rounded`, `refresh_rounded`, `info_outline_rounded`, `error_outline_rounded`, `cloud_off_outlined`, `check_*`, `lock_outline_rounded`, `photo_library_outlined`, `photo_camera_rounded`, `cameraswitch_rounded`, `circle` (shutter), `videocam_off_rounded`, `touch_app_outlined`, `visibility_*`, `link_rounded`, `compare_*`, `add_a_photo_outlined`, `chat_bubble_outline_rounded`, `verified_user_rounded`

**Target:** migrate System UI to the **same Phosphor package** (not Material), via `MiraSystemIcon` — not counted in 36.

Suggested Phosphor system map (study):  
back←`arrow-left` (mirror RTL), close←`x`, camera←`camera`, gallery←`images`, refresh←`arrow-clockwise`, info←`info`, check←`check-circle`, warning←`warning`, search←`magnifying-glass`, more←`dots-three`, etc.

---

## 11 — RTL rules

| Class | Rule |
|-------|------|
| Back / forward / chevron / undo / redo | **MIRROR_IN_RTL** |
| Share (if curved) | Evaluate; often **MIRROR** |
| Fashion objects (dress, bag, heel, seasons, …) | **DO_NOT_MIRROR** |
| Symmetric (palette, snowflake, star-four) | **SEMANTICALLY_NEUTRAL** |

Arabic language alone must not flip garment silhouettes.

---

## 12 — Current → target migration summary

| Action | Distinct icons |
|--------|---------------:|
| REPLACE (Fashion → 36 semantic) | ~36 fashion-ish Material IDs |
| REMAP (System → MiraSystemIcon/Phosphor) | ~29 system Material IDs |
| REMOVE (redundant variants / collisions) | outlined+rounded duplicates of same meaning |
| KEEP as-is long-term | **0** Material Fashion semantics |

Every usage in inventory maps to: **one of 36** OR **SYSTEM_UI** OR **REMOVE**.

### Semantic collisions flagged
| Current | Problem | Target |
|---------|---------|--------|
| `air_rounded` | Scarf | `scarf` CUSTOM |
| `auto_awesome_*` | AI/everything sparkle | split: recommendations / elegant / Ask Mira |
| `checkroom_*` | Garment + wardrobe + empty | garment IDs + `wardrobe` |
| `favorite_*` | Wedding + wishlist | wishlist=SYSTEM favorite; occasion=`special_occasion` |
| `weekend_outlined` | Casual/everyday | `everyday` / `casual` |
| `diamond_outlined` | Elegant + jewelry + formal | split custom/phosphor roles |
| `linear_scale` | Belt | `belt` |

### Ask Mira
**CUSTOM / BRAND-DERIVED** — communicates personal stylist intelligence; **not** chatbot, robot, medical AI, or generic sparkle.

### Abaya
**CUSTOM** — respectful minimal fashion garment; **not** dress/coat/robe substitute; Law #38 garment category only.

---

## 13 — Selected / unselected / labels / touch

- Selection: container border + soft fill + optional Fill weight — **not color alone**.
- Important Fashion categories: **ICON + Arabic label** required.
- Icon-only acceptable: tiny decorative chapter chrome after familiarity; avoid for occasions/garments.
- Touch: artwork MD 22; hit ≥ 44.

---

## 14 — Proposed asset architecture (NOT created)

```
assets/icons/fashion/
  garments/     mira_fashion_blouse.svg …
  attributes/   mira_fashion_fabric.svg …
  accessories/  mira_fashion_scarf.svg …
  occasions/    mira_fashion_formal.svg …
  seasons/      (none if Phosphor-only)
  intelligence/ mira_fashion_ask_mira.svg …
```

Phosphor glyphs: no asset files; resolved via registry.

---

## 15 — Central registry (design only — not implemented)

```text
MiraFashionIcon.{dress,blouse,…,askMira}
  → resolver(style: default|selected|disabled)
  → Phosphor IconData  OR  SvgPicture.asset
  → semanticsLabelAr
MiraSystemIcon.{back,close,camera,…}
```

**Governance rule (future):** Fashion feature screens MUST NOT call `Icons.*` / `CupertinoIcons.*` / `PhosphorIcons.*` directly — only wrappers.

---

## 16 — Performance

| Factor | Assessment |
|--------|------------|
| Phosphor font package | ~6 weight TTFs; tree-shake with `@staticIconProvider` if package supports |
| 15 custom SVGs | Small; reuse existing `flutter_svg` |
| Bundle | Low–moderate; prefer subsetting if package allows later |
| Parsing | SVG cost negligible at 15 icons |

---

## 17 — Licensing

| Source | License | Commercial | Attribution | Modify | Notes |
|--------|---------|------------|-------------|--------|-------|
| Phosphor Icons (assets) | **MIT** | YES | Keep LICENSE/copyright in repo | YES | https://phosphoricons.com / GitHub LICENSE |
| `phosphoricons_flutter` | MIT (package) | YES | Package license file | per MIT | Unofficial community port |
| Custom MIRA SVGs | Project original | YES | N/A | YES | Commissioned/owned by MIRA |
| Material Icons (current) | Apache 2.0 | YES | Retain notices | — | Exit Fashion usage after migration |

**LICENSE: CLEAR** (pending Owner acceptance of community Flutter package).

---

## 18 — Preview specification (NOT implemented)

Future screen `FashionIconSystemPreview`:
- Grid of **all 36**
- Columns: icon, Arabic label, English ID, source (Phosphor/Custom), default, selected, SM size
- Backgrounds: white, `AppColors.background`
- Owner approval checkbox gate before production remap

---

## 19 — Owner approval gate (mandatory)

1. STUDY (this document) — **DONE**  
2. **ICON SYSTEM PREVIEW** — Owner reviews all 36 together  
3. Only then: package install + Custom SVG production + registry + screen migration  
4. **Production icon migration: NOT AUTHORIZED** until Owner APPROVED preview

---

## 20 — Counts summary

```
TOTAL TARGET ICONS = 36
PHOSPHOR = 21
CUSTOM MIRA SVG = 15
21 + 15 = 36 ✓
SYSTEM UI ICONS = 29 (current distinct Material system-ish; not in 36)
CURRENT VERIFIED FASHION ICON USAGES = 114
CURRENT DISTINCT ICONS = 65
ICONS TO KEEP (Material long-term Fashion) = 0
ICONS TO REMAP (system→Phosphor system) = 29
ICONS TO REPLACE (fashion→36) = 36
ICONS TO REMOVE (duplicate variants/collisions) = residual outlined/rounded twins after remap
```

---

## 21 — Next implementation gate

**NEXT:** Owner-authorized task to (1) install recommended Phosphor package, (2) commission 15 SVGs to contract, (3) implement **Preview-only** screen — **still no mass Fashion screen replacement** until preview APPROVED.
