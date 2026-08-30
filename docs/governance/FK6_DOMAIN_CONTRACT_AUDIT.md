# FK-6 — Domain Contract Audit

## Audited domains
shoes, bags, jewelry, belts, scarves, watches, eyewear, headwear, general accessories, metallic accents, statement pieces

## Finding
Prefer existing FK-2 advice/candidate/claim-lock contracts. Additive accessory models live under `accessories/` without modifying `CanonicalGarment`.

## Additive only
- Accessory presence / role / dominance / metallic enums
- Accessory fact projection for LLM context
- Advice types for supporting-element direction

No frozen canonical schema changes.
