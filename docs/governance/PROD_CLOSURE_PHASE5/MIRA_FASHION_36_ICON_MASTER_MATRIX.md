# MIRA Fashion 36-Icon Master Matrix

**Task:** `MIRA-P5-FASHION-ICON-SYSTEM-STUDY-2026-09-07`  
**Mode:** STUDY ONLY — NO IMPLEMENTATION  
**Rows:** EXACTLY 36

| # | Group | Arabic Concept | English Semantic ID | Current Icon(s) | Current Problem | Recommended Source | Exact Phosphor Candidate | Custom SVG Required | Default Weight | Selected State | Optical Size | RTL Rule | Accessibility Label | Confidence | Notes |
|---|-------|----------------|---------------------|-----------------|-----------------|--------------------|---------------------------|---------------------|----------------|----------------|--------------|----------|---------------------|------------|-------|
| 01 | Garment | فستان | `dress` | `checkroom_*`, generic | Generic hanger/room | PHOSPHOR | `dress` | NO | Light/Regular | Fill | MD | NEUTRAL | فستان | HIGH | Exact catalog match; anchor for garment family |
| 02 | Garment | بلوزة | `blouse` | `checkroom_*` | No blouse semantics | CUSTOM_MIRA_SVG | — (weak: `t-shirt`) | YES | Light/Regular | Fill outline+container | MD | NEUTRAL | بلوزة | HIGH | No Phosphor blouse |
| 03 | Garment | قميص | `shirt` | `checkroom_*` | Generic | PHOSPHOR | `shirt-folded` | NO | Light/Regular | Fill | MD | NEUTRAL | قميص | HIGH | Prefer folded shirt over tee |
| 04 | Garment | تنورة | `skirt` | `checkroom_*`, `woman_rounded` | Missing / gender glyph | CUSTOM_MIRA_SVG | — | YES | Light/Regular | Fill | MD | NEUTRAL | تنورة | HIGH | No Phosphor skirt |
| 05 | Garment | بنطال | `pants` | `checkroom_*`, `directions_walk` | Wrong/generic | PHOSPHOR | `pants` | NO | Light/Regular | Fill | MD | NEUTRAL | بنطال | HIGH | Exact match |
| 06 | Garment | جاكيت | `jacket` | `checkroom_*` | Missing | CUSTOM_MIRA_SVG | — (weak: `hoodie`) | YES | Light/Regular | Fill | MD | NEUTRAL | جاكيت | HIGH | Hoodie ≠ jacket |
| 07 | Garment | معطف | `coat` | `checkroom_*` | Missing | CUSTOM_MIRA_SVG | — | YES | Light/Regular | Fill | MD | NEUTRAL | معطف | HIGH | No Phosphor coat |
| 08 | Garment | عباية | `abaya` | `checkroom_*` | Misrepresentation risk | CUSTOM_MIRA_SVG | — | YES | Light/Regular | Fill | MD | NEUTRAL | عباية | HIGH | Law #38: garment category, not identity |
| 09 | Garment | طقم / بدلة | `suit_set` | `checkroom_*` | Missing | CUSTOM_MIRA_SVG | — | YES | Light/Regular | Fill | MD | NEUTRAL | طقم أو بدلة | HIGH | No tuxedo/suit glyph |
| 10 | Attribute | اللون | `color_palette` | `palette_*` | OK concept; not swatch | PHOSPHOR | `palette` | NO | Regular | Fill | MD | NEUTRAL | اللون | HIGH | Concept only — real HEX swatches separate |
| 11 | Attribute | القماش | `fabric` | `line_style`, `straighten` | Weak fabric metaphor | CUSTOM_MIRA_SVG | — (weak: `swatches`/`needle`) | YES | Light/Regular | Fill | MD | NEUTRAL | القماش | MED | Prefer fabric drape silhouette |
| 12 | Attribute | القصة | `silhouette_cut` | `straighten`, `woman` | Body/tool confusion | CUSTOM_MIRA_SVG | — (weak: `scissors`) | YES | Light/Regular | Fill | MD | NEUTRAL | القصة / القصّة | MED | Scissors = craft, not silhouette |
| 13 | Attribute | المقاس / الملاءمة | `fit` | `straighten`, `linear_scale` | Ambiguous | PHOSPHOR | `ruler` | NO | Regular | Fill | MD | NEUTRAL | المقاس أو الملاءمة | MED | Fit ≠ body judgment (Law #37) |
| 14 | Accessory | حقيبة | `handbag` | `shopping_bag_outlined` | Retail bag ≠ handbag | PHOSPHOR | `handbag` | NO | Light/Regular | Fill | MD | NEUTRAL | حقيبة | HIGH | Exact fashion match |
| 15 | Accessory | حذاء / كعب | `shoe_heel` | `directions_walk` | Wrong metaphor | PHOSPHOR | `high-heel` | NO | Light/Regular | Fill | MD | NEUTRAL | حذاء | HIGH | Fashion-quality heel |
| 16 | Accessory | مجوهرات | `jewelry` | `diamond_outlined`, `watch` | Gem/watch collision | CUSTOM_MIRA_SVG | — (weak: `diamond`) | YES | Light/Regular | Fill | MD | NEUTRAL | مجوهرات | HIGH | Diamond alone too narrow |
| 17 | Accessory | حزام | `belt` | `linear_scale_rounded` | Semantically wrong | PHOSPHOR | `belt` | NO | Light/Regular | Fill | MD | NEUTRAL | حزام | HIGH | Exact match |
| 18 | Accessory | وشاح | `scarf` | `air_rounded` | **SEMANTICALLY_WRONG** | CUSTOM_MIRA_SVG | — | YES | Light/Regular | Fill | MD | NEUTRAL | وشاح | HIGH | Must not use wind/air |
| 19 | Accessory | قبعة | `hat` | — / generic | Weak/missing | CUSTOM_MIRA_SVG | — (weak: `beanie`) | YES | Light/Regular | Fill | MD | NEUTRAL | قبعة | MED | Beanie too specific |
| 20 | Occasion | يومي | `everyday` | `weekend_outlined` | Sofa/weekend collision | PHOSPHOR | `house-simple` | NO | Regular | Fill | MD | NEUTRAL | يومي | MED | Clear everyday home metaphor |
| 21 | Occasion | عمل | `work` | `work_outline_rounded` | OK but Material | PHOSPHOR | `briefcase` | NO | Regular | Fill | MD | NEUTRAL | عمل | HIGH | Exact |
| 22 | Occasion | رسمي | `formal` | `school_outlined`, diamond | Weak/wrong | CUSTOM_MIRA_SVG | — | YES | Regular | Fill | MD | NEUTRAL | رسمي | HIGH | No necktie/tuxedo |
| 23 | Occasion | سهرة | `evening` | `nightlife_outlined` | OK-ish Material | PHOSPHOR | `moon-stars` | NO | Regular | Fill | MD | NEUTRAL | سهرة | HIGH | Coherent evening |
| 24 | Occasion | مناسبة خاصة | `special_occasion` | `favorite_border`, `celebration` | Heart≠wedding clarity | CUSTOM_MIRA_SVG | — (reject heart-only) | YES | Regular | Fill | MD | NEUTRAL | مناسبة خاصة | HIGH | Avoid stereotype heart |
| 25 | Season | ربيع | `spring` | — | Not systematically used | PHOSPHOR | `flower` | NO | Regular | Fill | SM/MD | NEUTRAL | ربيع | HIGH | Season mini-family |
| 26 | Season | صيف | `summer` | — | — | PHOSPHOR | `sun` | NO | Regular | Fill | SM/MD | NEUTRAL | صيف | HIGH | Season mini-family |
| 27 | Season | خريف | `autumn` | — | — | PHOSPHOR | `leaf` | NO | Regular | Fill | SM/MD | NEUTRAL | خريف | HIGH | Season mini-family |
| 28 | Season | شتاء | `winter` | — | — | PHOSPHOR | `snowflake` | NO | Regular | Fill | SM/MD | NEUTRAL | شتاء | HIGH | Season mini-family |
| 29 | Style | كاجوال | `casual` | `weekend_outlined`, flash | Weak | PHOSPHOR | `sneaker` | NO | Regular | Fill | MD | NEUTRAL | كاجوال | MED | Fashion-legible casual |
| 30 | Style | أنيق | `elegant` | `diamond_outlined`, auto_awesome | Cliché sparkle/gem | CUSTOM_MIRA_SVG | — (reject sparkle-default) | YES | Light/Regular | Fill | MD | NEUTRAL | أنيق | MED | Refined silhouette, not glitter |
| 31 | Intelligence | تنسيق الإطلالة | `outfit_styling` | `style_outlined`, checkroom | Generic | PHOSPHOR | `coat-hanger` | NO | Regular | Fill | MD | NEUTRAL | تنسيق الإطلالة | HIGH | Styling metaphor |
| 32 | Intelligence | ألوان متناسقة | `color_harmony` | `palette_*` | Collides with #10 | PHOSPHOR | `swatches` | NO | Regular | Fill | MD | NEUTRAL | ألوان متناسقة | HIGH | Distinct from palette concept |
| 33 | Intelligence | اقتراحات | `recommendations` | `auto_awesome_*` | Overused sparkle | PHOSPHOR | `star-four` | NO | Regular | Fill | MD | NEUTRAL | اقتراحات | MED | Not magic-wand/chatbot |
| 34 | Intelligence | إطلالات مشابهة | `similar_looks` | `compare_*` | System compare | PHOSPHOR | `images` | NO | Regular | Fill | MD | NEUTRAL | إطلالات مشابهة | MED | Visual similarity |
| 35 | Intelligence | خزانة الملابس | `wardrobe` | `checkroom_*` | Same as garment | PHOSPHOR | `dresser` | NO | Regular | Fill | MD | NEUTRAL | خزانة الملابس | HIGH | Distinct from hanger |
| 36 | Intelligence | اسألي ميرا | `ask_mira` | `style_outlined`, `chat_bubble_*`, auto_awesome | Chatbot/sparkle risk | CUSTOM_MIRA_SVG | — (reject chat-circle / robot) | YES | Regular | Soft fill + brand accent | LG | NEUTRAL | اسألي ميرا | HIGH | Brand-derived personal stylist mark |

## Split totals

| Source | Count |
|--------|------:|
| PHOSPHOR | **21** |
| CUSTOM_MIRA_SVG | **15** |
| **TOTAL** | **36** |

`21 + 15 = 36` ✓
