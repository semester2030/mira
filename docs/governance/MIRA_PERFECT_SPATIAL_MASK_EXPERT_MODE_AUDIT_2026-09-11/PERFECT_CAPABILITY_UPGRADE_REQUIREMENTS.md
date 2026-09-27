# PERFECT_CAPABILITY_UPGRADE_REQUIREMENTS.md

**Audience:** MIRA owner → Perfect Corp sales/solutions  
**Rule:** Do **not** purchase until answers + optional acceptance prove entitlement.

---

## MUST HAVE (for pixel/mask Skin Map)

1. **Confirm product SKU** that returns spatial evidence for Skin Analysis on **our** S2S account (not marketing page alone).
2. **Exact API version** we should call (keep `s2s/v2.0` vs move to V2.1 / other) for mask/overlay outputs.
3. **Exact request fields** required, e.g. whether `enable_mask_overlay=true` (or equivalent) is valid on our plan; sample request JSON.
4. **Per-concern output table:** which of `wrinkle, pore, texture, acne, moisture, oiliness, redness, age_spot` return:
   - score only  
   - region scores  
   - mask image URL  
   - overlay image URL  
   - per-pixel raw data  
5. **Coordinate/geometry contract:** mask aligned to uploaded image pixel size? EXIF/orientation rules?
6. **Server-to-Server access** confirmation for production API key already used by MIRA.
7. **Retention & deletion:** file + result + mask URL TTL; API to delete immediately after MIRA finishes ephemeral render.
8. **Pricing / billing unit** for mask/Expert/HD (credit per analysis? per concern? per mask?).
9. **Rate limits** for production skin-analysis with spatial output.

## OPTIONAL / ADVANCED

1. **Expert Mode API** — entitlement status for MIRA account; per-pixel raw Skin data; custom mapping docs.
2. **HD Skin concerns** (`hd_age_spot`, `hd_pore`, `hd_wrinkle`, `hd_texture`, `hd_acne`, HD redness) — availability, pricing, SD/HD mix rules.
3. **180° Full Face Mapping** — entitlement; whether front+left+right required; S2S support.
4. **Sandbox / playground** with spatial outputs for unpaid/low-cost validation.
5. Written DPA / retention policy URL for masks and uploaded faces.

## Explicitly out of scope for this ask

- Buying anything in this audit  
- Mixing unverified HD+SD actions without Perfect guidance  
- Asking MIRA to invent localization without provider fields
