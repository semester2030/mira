# PHASE 5 — FASHION EXPERIENCE UI/UX FORENSIC AUDIT

**Task ID:** `MIRA-P5-FASHION-EXPERIENCE-UX-FORENSIC-2026-09-07`  
**Mode:** READ-ONLY · FORENSIC UI/UX AUDIT  
**Date:** 2026-09-07  
**Implementation performed:** **NO**  
**Deploy / commit / flag changes:** **NONE**

> **AUDIT ONLY — NO IMPLEMENTATION PERFORMED**  
> Frozen systems preserved: Fashion Knowledge Platform, Garment / Outfit / Styling Intelligence, Advisor orchestration laws, Face/Skin, backend domain truth.

---

## 0 — Executive UX verdict

The Fashion Analysis journey is **functionally rich** (capture → occasion → multi-chapter result → recolor → wardrobe → Advisor) but **not fashion-editorial enough**. Primary visual competition is between a large **«درجة الإطلالة»** ring (`compatibilityScore`) and nested white cards, while garment imagery is often **partial hero** (side-by-side with the score, not full-bleed editorial).

The owner-observed **gray/silver identical color circles** are **not primarily a design-token problem**. Exact root cause is a **name→Color binding failure** after pixel matching stores shaded Arabic labels (`أسود متوسط`) that **exact-fail** `FashionColorLibrary.byName`, then fall through to **`#9E9E9E`**. Concurrently, the wardrobe palette UI **ignores available `DetectedGarmentColor.hex`** and **mixes detected + recommended** colors under the title **«ألوان تناسبك»**.

**Implementation recommendation:** **MODERATE RESTRUCTURE** (truth + hierarchy + iconography waves) — **not** a domain-intelligence redesign and **not** “more pink.”

---

## 1 — Real Fashion journey (source-backed)

```
Dashboard / Side menu «حلّلي إطلالتك»
  → AnalysisNavigation.openOutfitAnalysis
  → OutfitUploadScreen          (/outfit-upload)
  → OutfitLiveCaptureScreen     (/outfit-live-capture)  [primary]
     or OutfitCameraScreen      (/outfit-camera)        [legacy]
  → OccasionSelectScreen        (/occasion-select)
       [in-place AsyncLoading «جاري التحليل...» — no dedicated processing route]
  → OutfitResultScreen          (/outfit-result)
       → trust gate → OutfitResultStoryShell chapters:
            look | colors | play | wardrobe
  → optional: OutfitHistoryScreen, OutfitCompareScreen,
              RecommendationsScreen, MiraAdvisorScreen (AskOutfitMiraSection)
```

| SCREEN ID | Name | Source | Route |
|-----------|------|--------|-------|
| F-01 | Mode hub | `outfit_upload_screen.dart` | `/outfit-upload` |
| F-02 | Live capture | `outfit_live_capture_screen.dart` + `outfit_live_capture_panel.dart` | `/outfit-live-capture` |
| F-03 | Legacy camera | `outfit_camera_screen.dart` + `outfit_capture_panel.dart` | `/outfit-camera` |
| F-04 | Occasion + submit | `occasion_select_screen.dart` | `/occasion-select` |
| F-05 | Result shell | `outfit_result_screen.dart` + `outfit_result_story_shell.dart` | `/outfit-result` |
| F-06 | History | `outfit_history_screen.dart` | `/outfit-history` |
| F-07 | Compare | `outfit_compare_screen.dart` | `/outfit-compare` |
| F-08 | Style report (adjacent) | `mira_style_report_screen.dart` | `/mira-style-report` |
| F-09 | Advisor handoff target | `mira_advisor_screen.dart` via `ask_outfit_mira_section.dart` | `/mira-advisor` |
| F-10 | Recommendations | `recommendations_screen.dart` | `/recommendations` |

**State:** Riverpod `OutfitIntelligenceNotifier` — **no Bloc**.  
**API:** `/ai/vision/outfit/analyze`, `/ai/outfit-intelligence`, history/snapshots, recolor.  
**Perfect Corp is not on the Fashion color path** (skin only). Fashion semantics: Vision + OpenAI color **IDs** + on-device CIEDE2000 pixel palette.

---

## 2 — Screen-by-screen UX audit

| ID | Goal | Primary visual | Primary CTA | Density | Fashion feel | Grade |
|----|------|----------------|-------------|---------|--------------|-------|
| F-01 | Choose Quick vs Smart | Two mode cards + purple/pink accents | Mode card tap | BALANCED | GOOD entry, generic icons | **GOOD** |
| F-02 | Full-body capture | Camera + body guide overlay | Shutter | HIGH | Functional, not editorial | **NEEDS_REFINEMENT** |
| F-03 | Legacy capture | Same family | Shutter | HIGH | Duplicate path | **NEEDS_REFINEMENT** |
| F-04 | Pick occasion + run | Occasion chips + PremiumButton | «حلّلي الإطلالة» / loading | BALANCED | Clear | **GOOD** |
| F-05 look | Understand look | Photo + BeautyScoreRing + tags + harmony bars | Chapter swipe / scroll | **EXCESSIVE** | Score > garment | **POOR** |
| F-05 colors | Understand colors | Harmony rows + sliders + alt circles | Tap swatches | HIGH | Mixed semantics | **POOR** (color truth) |
| F-05 play | Recolor / vote | Recolor chips + swipe | Apply recolor | HIGH | Playful, dense | **NEEDS_REFINEMENT** |
| F-05 wardrobe | Pieces / Ask Mira | Luxury cards + palette circles | Ask Mira / wishlist | **EXCESSIVE** | Merch-ish but card-heavy | **NEEDS_REFINEMENT** |
| F-06 | History | List cards + score % | Open / compare | BALANCED | Utility | **GOOD** |
| F-07 | Compare | Dual columns + score pills | Add photo | HIGH | Analytical | **NEEDS_REFINEMENT** |
| F-09 | Advisor | Chat | Send | — | Contextual if flag ON | **PARTIAL** cohesion |

**No invented screens.** Processing is **in-place on F-04**, not a dedicated route.

---

## 3 — Color circles / swatch forensic (HIGH PRIORITY)

### Pipeline (truth)

```
OpenAI semantic color IDs (FashionVisionDocument)
  → Garment Intelligence normalizeColorId / attributes.colors (IDs, no hex on public garments DTO)
  → Flutter CanonicalGarment → incomplete _colorIdToAr map (unmapped IDs dropped)
  → On-device segment palette (CIEDE2000) → DetectedGarmentColor { hex, nameAr, displayNameAr }
  → OutfitAnalysis.dominantColors often = detailed.map(displayNameAr)  // e.g. "أسود متوسط"
  → UI:
       Harmony panel: prefers insight.hex → CORRECT when detailedColors present
       «ألوان تناسبك» / alternatives / slider / recolor chips: VisionColorMapper.toDisplayColor(name)
         → FashionColorLibrary.byName EXACT match only
         → miss → ProfessionalColorMatcher.hexForName → '#9E9E9E'
         → last resort lavender 0xFFC19EE0
```

### Exact root cause (owner gray/silver circles)

| Layer | Verdict |
|-------|---------|
| Primary | **FLUTTER_PARSING_DEFECT** — `displayNameAr` (`${nameAr} ${shade}`) fails exact `byName` |
| Coupled | **FALLBACK_COLOR_DEFECT** — universal `#9E9E9E` for any miss → identical circles |
| Coupled | **UI_BINDING_DEFECT** — palette builder binds **names only**, ignores `detailedColors[].hex` |
| Contributing | **HARDCODED / catalog proximity** — `silver`/`silver_metal` `#C7C7C7` ≈ `gray_light`/`gray_soft` `#B8B8B8` |
| Contributing | **BACKEND_MAPPING** — ontology IDs only on wire; incomplete Arabic ID map |
| Not primary | Design token override / `Colors.grey` Material usage in swatch widgets (not found) |
| Not Perfect Corp | Skin path only |

**Evidence files:**
- `professional_color_matcher.dart` L88–92 (`displayNameAr`), L275–278 (`#9E9E9E`)
- `fashion_color_library.dart` L12–17 (exact `byName`)
- `vision_color_mapper.dart` L79–89
- `outfit_intelligence_service.dart` L297–301 (`displayNameAr` into dominantColors)
- `outfit_insight_builder.dart` L14–36 (mixes zones + **recommendedColors**; `_colorFromName`)
- `outfit_insight_cards.dart` L255–269 (circles from `sw.color`)
- `outfit_color_harmony_panel.dart` L155–158 (hex path when available)

### Classification

| Question | Answer |
|----------|--------|
| COLOR DATA CORRECT (when detailedColors exist) | **PARTIAL** — hex often correct in matcher; stored labels break re-lookup |
| COLOR UI BINDING CORRECT | **NO** for wardrobe palette / many name-only surfaces |
| PRIMARY / SECONDARY / RECOMMENDED SEPARATED | **NO** — mixed in `OutfitInsightBuilder.palette` under «ألوان تناسبك» |

---

## 4 — Color semantic model

| Concept | Data available? | UI separation? |
|---------|-----------------|----------------|
| Primary garment color | `GarmentColorPalette.primaryColor` / detailed[0] | Not prominently labeled as «لون القطعة الأساسي» |
| Extracted garment colors | `detailedColors`, zone colors | Partially in harmony panel |
| Recommended coordinating | `recommendedColors` | Mixed into same circle row as extracted |

**Proposed hierarchy (compatible with data — plan only):**
1. لون القطعة الأساسي  
2. درجات موجودة في القطعة  
3. ألوان مقترحة للتنسيق  

Do **not** fabricate colors absent from intelligence.

---

## 5 — Color accuracy / accessibility

| Topic | Finding |
|-------|---------|
| Fidelity | Broken when name→Color fallback fires |
| Light/dark swatches | White border helps; gray fallback collapses distinction |
| Labels | Arabic names present in snackbars/rows; circles alone are color-only |
| Interactive vs informational | Palette circles are **interactive** (haptic + snackbar) but look like **informational** swatches — affordance ambiguity |
| Color-blind | Names help in rows; circle-only row fails “not by color alone” when interaction depends on hue |

---

## 6–8 — Icon inventory & system

**Source:** Material `Icons.*` only in Fashion journey (no Cupertino; luxury pieces also use `Image.asset` catalog PNGs).  
**Unique Material identifiers in journey (+ Ask Mira):** **65**.

### System consistency

| Axis | Verdict |
|------|---------|
| Libraries mixed | Material + PNG assets (luxury) — **PARTIAL** |
| Filled vs outlined | Mixed (`favorite_rounded` vs `favorite_border`, `checkroom_outlined` vs `checkroom_rounded`) — **INCONSISTENT** |
| Optical size | 12–32px without optical equalization — **INCONSISTENT** |
| Fashion specificity | Heavy use of `auto_awesome`, `checkroom`, `diamond`, `flash_on` — **GENERIC** |
| Wrong semantics | Scarf → `Icons.air_rounded`; some jewelry → `auto_awesome` — **SEMANTICALLY_WRONG / AMBIGUOUS** |
| RTL chevrons | `chevron_left` / `arrow_back_*` used for forward affordances in RTL — **NEEDS_REFINEMENT** |

### Representative icon verdicts (complete ID list in appendix A)

| Concept | Icon | Flags |
|---------|------|-------|
| Garment generic | `checkroom_*` | GENERIC |
| Occasion wedding | `favorite_border_rounded` | AMBIGUOUS |
| Occasion work | `work_outline_rounded` | OK |
| Occasion casual | `weekend_outlined` | AMBIGUOUS |
| Scarf | `air_rounded` | SEMANTICALLY_WRONG |
| Soft sparkle / Mira | `auto_awesome_*` | OVERUSED / GENERIC |
| Score elegance | `diamond_outlined` | GENERIC luxury cliché |
| Capture shutter | `circle` | WEAK |
| Advisor | `style_outlined` + `chat_bubble_outline_rounded` | PARTIAL |

**ICON SYSTEM: INCONSISTENT**

---

## 9–10 — Fashion-first hierarchy & first-glance

**Principle:** GARMENT FIRST → KEY INSIGHT → DETAILS.

**Current first three eye-catchers on F-05 look (typical):**
1. Large pink/purple **BeautyScoreRing** («درجة الإطلالة»)
2. Nested white card chrome / tags
3. Photo (flex ~11 vs score column ~12) — **not dominant**

**First-glance test:**

| Question | Answerable in ~3s? |
|----------|--------------------|
| What garment? | PARTIAL (title/copy; photo if present) |
| Primary color? | **NO** reliably (gray circles elsewhere; not hero) |
| Style/category? | PARTIAL (tags) |
| Most useful insight? | Ambiguous (score dominates) |
| What next? | Weak (chapter chrome / many CTAs later) |

**GARMENT IS VISUAL HERO: PARTIAL → often NO on look chapter**  
**VISUAL HIERARCHY: POOR / NEEDS_REFINEMENT**

---

## 11 — Card overload

Inventory (result path): hero card, harmony embedded card, why-this-works, skin link, color harmony panel, alternatives, photo slider, insight premium cards (palette/pieces/accessories/makeup), next occasion, Ask Mira PremiumCard, trust banners, sticky hero, chapter chrome.

| Pattern | Present? |
|---------|----------|
| Card-inside-card | YES (hero contains harmony panel) |
| Repeated white surfaces | YES |
| Soft purple shadows | YES (`AppColors.secondary` alpha) |
| Could be chip/row | Many tags & metrics |

**CARD OVERLOAD: YES**

Disposition theme: KEEP structure, **SIMPLIFY/MERGE** surfaces, progressive disclosure for technical CIEDE2000 prose.

---

## 12 — Chips / badges

| Control | Class | Affordance issue |
|---------|-------|------------------|
| Occasion chips (F-04) | SELECTOR | Mostly clear |
| Hero tags | RESULT / ATTRIBUTE | Look decorative |
| Confidence pills | STATUS | OK |
| Palette circles | ambiguous INFO↔BUTTON | **YES** |
| Vote chips | BUTTON | OK |
| ActionChip starter Qs | BUTTON | OK |
| History score pill | RESULT | OK |

---

## 13 — CTA hierarchy

| Screen | Dominant next? | Violation |
|--------|----------------|-----------|
| F-01 | Mode card | OK |
| F-02 | Shutter | OK |
| F-04 | Analyze button | OK (loading replaces label) |
| F-05 | Many: chapters, refresh, compare, recommendations, Ask Mira, wishlist, recolor | **FAIL — competing primaries** |
| Accent | Pink/purple `PremiumButton` + gold accents | Overused for hierarchy |

**CTA HIERARCHY: FAIL / NEEDS_REFINEMENT**

---

## 14 — MIRA accent usage

`AppColors.primary` `#E86FA9`, `secondary` `#C19EE0`, `background` `#FFF7FA`, borders `#F8BBD0`.

Used for: brand surfaces, progress, chips, icons, card shadows, CTAs, decorative bubbles.

**Finding:** Accent carries **decoration + interaction + score emotion** simultaneously → reduces semantic importance. Neutrals should dominate merchandising surfaces; accent reserved for **one primary action** and brand moments.

Reject “add more pink/gradients/hearts.”

---

## 15 — Typography

Tokens: `AppTypography` (Tajawal + Playfair). Levels: titleMedium, labelLarge, bodySmall, labelSmall heavily reused.

Issues: many equal-weight titles on stacked cards; long Arabic score subtitles; truncation risk on luxury piece titles; numeric ring competes with titles.

---

## 16 — Spacing / rhythm

Common magic numbers: 6, 8, 10, 12, 14, 16, 18, 20, 22, 26, 28 radii; hero padding `fromLTRB(18,20,18,22)`; insight card `20/18/20/20`.

**Inconsistent vs a single spacing scale** — duplicated local constants rather than shared fashion spacing tokens.

---

## 17 — Information density

| Chapter | Feel | Why |
|---------|------|-----|
| look | TECHNICAL REPORT + score dashboard | Ring + multi bars + tags |
| colors | Mixed fashion / lab | CIEDE2000 copy (“247 درجة…”) |
| play | Tooling | Recolor controls |
| wardrobe | Merch catalog | Many cards |

**INFORMATION DENSITY: EXCESSIVE on result**

Recommend progressive disclosure: SUMMARY → WHY → DETAILS (no implementation).

---

## 18 — Recommendations presentation

Luxury piece cards + illustrated tiles + wishlist. Strength: asset imagery when catalog hits. Weakness: database-card rhythm, compatibility % competing with outfit score, generic `checkroom` fallbacks.

Direction: editorial merchandising strips, fewer simultaneous cards, reason-first captions.

---

## 19 — Occasions / accessories

Occasions: Material icons per `MiraOccasion` — recognizable for work/school; weaker for wedding/casual/scarf semantics.  
Accessories: taxonomy icon map + luxury assets — **generic when asset missing**.

---

## 20 — Score semantics — CRITICAL

| Field | Meaning (source) | UI |
|-------|------------------|----|
| **`compatibilityScore`** (0–100) | Deterministic outfit compatibility / occasion-weighted engine score | **BeautyScoreRing** label **«درجة الإطلالة»**; subtitle `تقييم $score/100 لـ…` |
| `colorHarmonyScore` | Color component | Harmony bars |
| `skinCompatibilityScore` | Smart-mode skin link | Bars / CTA |
| `occasionMatchScore` / `styleBalanceScore` | Weighted components | Bars |
| Palette `confidence` | CIEDE2000 match confidence | `% دقة` pills — **not** the big ring |
| History `توافق N%` | `miraStyleReport.outfitScore ?? compatibilityScore` | Card trailer |
| Piece `compatibilityPercent` | Recommendation fit | Luxury card (explicitly distinguished in copy) |

**Owner “~73”:** almost certainly **`compatibilityScore == 73`**, not color confidence.

**User misread risk:** `BeautyScoreRing` + large number + verdicts like «نتيجة الإطلالة جيدة» / «تحتاجين تحسينات» can be read as **appearance/attractiveness judgment** even though domain intent is outfit-occasion compatibility.

**SCORE SEMANTICS: AMBIGUOUS → PROBLEMATIC (HIGH-SEVERITY UX/SEMANTIC)**

---

## 21 — Fashion Knowledge laws (UI audit only)

| Law | Statement | UI verdict |
|-----|-----------|------------|
| **#37** | Garment/form advice must not judge body attractiveness/value | **AT RISK** — large personal score ring + judgmental Arabic verdicts; capture UI exposes `OutfitBodySilhouette` labels («جسم صغير/نحيف», «جسم ممتلئ»). Domain FK Law #37 code path separate; **presentation risk**. |
| **#38** | Culture is explicit context, never inferred identity | **PASS / AT RISK low** — occasion is explicit user selection; no auto cultural identity inference found in these screens. |
| **#39** | Feedback is preference/system evidence, not domain truth | **AT RISK** — swipe votes / wishlist stored as preference; must not be presented as fashion truth (copy mostly preference-OK; monitor Advisor). |

---

## 22 — Advisor handoff

`AskOutfitMiraSection` → `AdvisorRouteArgs(outfitAnalysis, skinReport, initialQuestion?)` → `MiraAdvisorScreen` builds `AdvisorFashionContext`.

| Aspect | Verdict |
|--------|---------|
| Context preserved | PARTIAL–YES when flag/entitlement allow Mode B |
| Same journey feel | PARTIAL — card CTA «محادثة عن الإطلالة» / experimental guest |
| Suggested concept | «اسألي ميرا عن هذه الإطلالة» already near copy — refine placement as **one** primary after summary |

**ADVISOR HANDOFF: PARTIAL**

---

## 23 — RTL / Arabic

Most screens Arabic-first. Issues: back/chevron directions mixed; English CIEDE2000/technical fragments; `%` placement; long lines wrapping inside dense cards.

**RTL: NEEDS_REFINEMENT**

---

## 24 — Accessibility

Touch targets generally OK for primary buttons; swatches ~50px OK. Gaps: color-only circle meaning; snackbar-only name disclosure; limited Semantics labels on custom painted overlays; loading button text change OK.

**ACCESSIBILITY: NEEDS_REFINEMENT**

---

## 25 — Loading / processing

F-04: `AsyncLoading` disables/replaces CTA with «جاري التحليل...». No truthful percent of Perfect/Vision stages on this screen. Recolor panel has separate spinner. Chapter progress is **discovery UI**, not network truth.

Risk: decorative motion elsewhere must not imply unsupported AI work (Face Soft Laser lesson applies by analogy — Fashion recolor should stay honest).

---

## 26 — Empty / error / partial

Untrusted result view, trust degraded banner, history empty/cloud-off icons — present.  
**Color partial:** missing/unmatched names → **identical gray swatches** — **FAIL graceful degradation** (exactly the owner symptom).

---

## 27 — Premium female-fashion experience scores (evidence-based)

| Attribute | /10 | Evidence |
|-----------|-----|----------|
| ELEGANT | 5 | Soft palette exists; score chrome dominates |
| PREMIUM | 5 | PremiumCard/gold accents; Material generic icons |
| MODERN | 6 | Story chapters modern; density dated-dashboard |
| FASHION-LED | 4 | Garment not consistent hero; lab color copy |
| VISUALLY CALM | 3 | Card/CTA overload |
| CONFIDENT | 5 | Strong CTAs; score anxiety risk |
| PERSONAL | 6 | Occasion + skin smart mode |
| WARM | 6 | Pink/lavender brand warmth |
| REFINED | 4 | Inconsistent icon weights |
| EDITORIAL | 3 | Not magazine composition |
| TRUSTWORTHY | 5 | Trust gate good; gray colors undermine trust |

**PREMIUM FASHION EXPERIENCE SCORE: 4.7/10 ≈ 5/10**

---

## 28 — Design system reuse

Reusable: `AppColors`, `AppTypography`, `PremiumButton`, `PremiumCard`, `MiraAppBar`, `FloatingGradientBackground`, `BeautyScoreRing`, `EmptyState`.

Fashion-local: `_PremiumInsightCard`, many `_Chip` variants, story shell — **parallel styling**. Prefer consolidation over new pink system.

---

## 29 — Component inventory (disposition)

| Component | File | Disposition |
|-----------|------|-------------|
| OutfitResultStoryShell | engagement/… | REFINE (CTA/chapter load) |
| OutfitLookResultHero | outfit_look_result_hero.dart | RESTRUCTURE hierarchy |
| BeautyScoreRing (usage) | shared + hero | REFINE semantics/label |
| OutfitColorHarmonyPanel | … | KEEP + prefer hex |
| OutfitInsightBuilder.palette | … | FIX binding/separation |
| OutfitInsightCards | … | SIMPLIFY / MERGE |
| OutfitLuxuryPieceCard | … | REFINE merchandising |
| OutfitGarmentRecolorPanel | … | KEEP (honest loading) |
| AskOutfitMiraSection | advisor/… | REFINE placement |
| Occasion chips | occasion_select | KEEP |
| Taxonomy icons | outfit_fashion_taxonomy.dart | REPLACE map (fashion set) |
| Body silhouette labels | capture overlays | REVIEW vs Law #37 presentation |

---

## 30 — Density map

| Screen | Density |
|--------|---------|
| F-01 | BALANCED |
| F-02/F-03 | HIGH |
| F-04 | BALANCED |
| F-05 look | EXCESSIVE |
| F-05 colors | HIGH |
| F-05 play | HIGH |
| F-05 wardrobe | EXCESSIVE |
| F-06 | BALANCED |
| F-07 | HIGH |

---

## 31 — Recommended IA (evidence-based)

1. GARMENT HERO / RESULT SUMMARY (photo dominant; one-line stylist insight)  
2. PRIMARY COLOR + KEY ATTRIBUTES  
3. STYLING INSIGHT («لماذا تناسب»)  
4. COLORS — extracted vs recommended **separated**  
5. CUT / FABRIC / DETAILS (progressive)  
6. HOW TO STYLE  
7. OCCASIONS  
8. ACCESSORIES  
9. SIMILAR / COMPLEMENTARY  
10. ASK MIRA  
11. TECHNICAL / WHY (CIEDE2000, confidences)  

Score ring: demote or relabel to non-judgmental outfit-fit language — **do not** change engine math in a pure visual task.

---

## 32 — Explicit rejects

No: more pink, sparkles, hearts everywhere, beauty clichés, rounding everything, fake progress. Premium from hierarchy, imagery, typography, color truth, icon quality, restraint.

---

## 33 — Defect register

| ID | Screen | Component | Cat | Sev | Root cause | Symptom | Direction | Complexity |
|----|--------|-----------|-----|-----|------------|---------|-----------|------------|
| FX-01 | F-05 colors/wardrobe | Palette circles | COLOR | **P0** | displayNameAr exact-fail → `#9E9E9E` + ignore hex | Identical gray/silver circles | Bind hex; fuzzy name; stop universal grey | M |
| FX-02 | F-05 wardrobe | «ألوان تناسبك» | SEMANTICS | **P0** | Mix detected+recommended | Wrong color story | Split sections | S |
| FX-03 | F-05 look | BeautyScoreRing | SEMANTICS | **P0** | Ambiguous «درجة» + beauty ring | Attractiveness misread | Relabel/demote; clarify outfit-fit | M |
| FX-04 | F-05 look | Hero layout | HIERARCHY | **P1** | Score column ≈ photo | Garment not hero | Photo-first composition | M |
| FX-05 | F-05 * | Cards | CARD | **P1** | Nested surfaces | Dashboard feel | Flatten / progressive | M |
| FX-06 | F-05 * | CTAs | CTA | **P1** | Many equal actions | Decision fatigue | One primary per state | M |
| FX-07 | Journey | Icons.* | ICON | **P1** | Material generic + wrong map | Non-fashion look | Canonical fashion icon set | L |
| FX-08 | F-05 colors | Lab copy | CONTENT | **P2** | CIEDE2000 marketing | Technical report feel | Move to details | S |
| FX-09 | F-02 | Silhouette labels | SEMANTICS | **P1** | Body size wording | Law #37 presentation risk | Garment-frame language | M |
| FX-10 | Swatches | Circles | A11Y | **P1** | Color-only + snackbar | Weak a11y | Always show name | S |
| FX-11 | Accent | Theme use | DESIGN_SYSTEM | **P2** | Accent everywhere | Flat hierarchy | Neutral surfaces | M |
| FX-12 | RTL | Chevrons | RTL | **P2** | Non-mirrored intents | Direction confusion | Directional icons audit | S |
| FX-13 | Advisor | Ask section | ADVISOR | **P2** | Buried in wardrobe | Disconnected feel | Elevate after summary | S |
| FX-14 | Partial colors | Fallback | ERROR_STATE | **P0** | Silent grey collection | False “all grey outfit” | Empty/partial honest UI | M |
| FX-15 | F-03 | Legacy camera | INTERACTION | **P3** | Duplicate path | Split attention | Soft-deprecate UX | S |
| FX-16 | Typography | Titles | TYPOGRAPHY | **P2** | Equal weights | No hierarchy | Scale tokens | S |
| FX-17 | Spacing | Magic nums | SPACING | **P3** | Local constants | Rhythm drift | Shared scale | S |
| FX-18 | Recolor chips | Name binding | COLOR | **P1** | Same toDisplayColor path | Grey chips | Hex/id bind | M |

**Counts:** P0 **4** · P1 **7** · P2 **5** · P3 **2** (register above; P0 = FX-01,02,03,14)

---

## 34 — Remediation waves (PLAN ONLY)

**WAVE 1 — TRUTH + SEMANTICS**  
Color hex binding; stop `#9E9E9E` silent mass fallback; separate color roles; score labeling; partial-color honesty; Law #37 presentation review for body labels.

**WAVE 2 — VISUAL HIERARCHY**  
Garment hero; demote ring; reduce cards; one primary CTA; IA order.

**WAVE 3 — ICONOGRAPHY + DESIGN SYSTEM**  
Canonical fashion icon family; optical sizes; consolidate chips/cards to premium tokens.

**WAVE 4 — FASHION MERCHANDISING**  
Editorial recommendations; occasions/accessories imagery; similar looks.

**WAVE 5 — POLISH**  
Spacing/type rhythm; Advisor transition; microinteraction restraint.

---

## 35 — Before / proposed (textual)

### F-05 Look
**BEFORE:** Photo shares row with large BeautyScoreRing; tags + bars inside same card; garment not hero.  
**PROPOSED:** Full-width garment hero; one-line insight; fit metric secondary; details below.

### F-05 Colors / wardrobe palette
**BEFORE:** Circles identical grey; «ألوان تناسبك» mixes extracted+recommended.  
**PROPOSED:** Primary swatch from hex; extracted row; recommended row; names always visible; no silent grey set.

### F-05 CTAs
**BEFORE:** Compare / refresh / recommendations / Ask Mira / wishlist compete.  
**PROPOSED:** One sticky primary (Ask Mira or Style next); others tertiary.

---

## 36 — Compliance

No Dart/backend/assets/theme/layout/text/package/deploy/commit/flag changes in this task.

---

## Appendix A — Unique Material icon identifiers (65)

```
Icons.add_a_photo_outlined
Icons.air_rounded
Icons.arrow_back_ios_new_rounded
Icons.arrow_back_rounded
Icons.arrow_forward_rounded
Icons.auto_awesome_outlined
Icons.auto_awesome_rounded
Icons.auto_fix_high_outlined
Icons.auto_fix_high_rounded
Icons.brush_rounded
Icons.cameraswitch_rounded
Icons.celebration_outlined
Icons.chat_bubble_outline_rounded
Icons.check_circle
Icons.check_circle_outline
Icons.check_circle_outline_rounded
Icons.check_rounded
Icons.checkroom_outlined
Icons.checkroom_rounded
Icons.chevron_left
Icons.circle
Icons.close_rounded
Icons.cloud_off_outlined
Icons.compare_arrows_rounded
Icons.compare_rounded
Icons.diamond_outlined
Icons.directions_walk_rounded
Icons.error_outline_rounded
Icons.event_available_rounded
Icons.event_rounded
Icons.face_retouching_natural_outlined
Icons.face_retouching_natural_rounded
Icons.favorite_border_rounded
Icons.favorite_rounded
Icons.flash_on_rounded
Icons.image_not_supported_outlined
Icons.info_outline_rounded
Icons.keyboard_arrow_up_rounded
Icons.line_style_rounded
Icons.linear_scale_rounded
Icons.link_rounded
Icons.lock_outline_rounded
Icons.nightlife_outlined
Icons.palette_outlined
Icons.palette_rounded
Icons.photo_camera_rounded
Icons.photo_library_outlined
Icons.record_voice_over_outlined
Icons.refresh_rounded
Icons.school_outlined
Icons.shield_outlined
Icons.shopping_bag_outlined
Icons.straighten_rounded
Icons.style_outlined
Icons.swipe_left_rounded
Icons.swipe_rounded
Icons.touch_app_outlined
Icons.verified_user_rounded
Icons.videocam_off_rounded
Icons.visibility_off_outlined
Icons.visibility_outlined
Icons.watch_outlined
Icons.weekend_outlined
Icons.woman_rounded
Icons.work_outline_rounded
```

Plus luxury `Image.asset` catalog PNGs (not Material) on piece cards.

---

## Appendix B — Color pipeline evidence summary

| Stage | Value type | Example |
|-------|------------|---------|
| Provider/GI | ontology ID | `gray_soft`, `beige_linen` |
| Pixel matcher | hex + shaded AR label | hex `#1A1A1A`, displayNameAr `أسود متوسط` |
| OutfitAnalysis list | String names | `أسود متوسط` |
| Harmony UI | Color from **hex** when present | correct |
| Palette UI | Color from **name** | → `#9E9E9E` |

---

## Final matrix

| Field | Value |
|-------|-------|
| AUDIT | COMPLETE (source forensic; device recording used as owner symptom input) |
| IMPLEMENTATION | NO |
| SCREENS AUDITED | 10 |
| COMPONENTS AUDITED | 42 (screens+widgets+builders+mappers in journey) |
| ICONS AUDITED | 65 unique Material IDs |
| COLOR SWATCH ROOT CAUSE | FLUTTER_PARSING + FALLBACK `#9E9E9E` + UI_BINDING ignore hex |
| COLOR DATA CORRECT | PARTIAL |
| COLOR UI BINDING | NO |
| COLOR ROLES SEPARATED | NO |
| ICON SYSTEM | INCONSISTENT |
| VISUAL HIERARCHY | POOR |
| GARMENT HERO | PARTIAL / NO |
| CARD OVERLOAD | YES |
| CTA HIERARCHY | FAIL |
| DENSITY | EXCESSIVE |
| SCORE SEMANTICS | PROBLEMATIC |
| LAW #37 | AT RISK |
| LAW #38 | PASS |
| LAW #39 | AT RISK |
| ADVISOR | PARTIAL |
| RTL | NEEDS_REFINEMENT |
| A11Y | NEEDS_REFINEMENT |
| PREMIUM SCORE | 5/10 |
| P0 / P1 / P2 / P3 | 4 / 7 / 5 / 2 |
| RECOMMENDATION | MODERATE RESTRUCTURE |
| PHASE 6 | LOCKED |
| GO-LIVE | NOT APPROVED |
