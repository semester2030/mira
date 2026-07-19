# Phase 5B — Provider Verification (lip)

**Date:** 2026-07-19  
**Capability:** `lip` (frozen catalog id — no aliases)  
**Recommended provider:** Perfect Corp (YouCam Makeup VTO)  
**Verdict:** **NOT VERIFIED — IMPLEMENTATION STOPPED**

---

## 1 Mission gate

Before any provider adapter code:

| Check | Result |
|-------|--------|
| Provider account | **Unknown** — no console access in this session; skin S2S key may exist on Render (`PERFECT_API_KEY` sync:false) but account makeup entitlements not inspected |
| Capability license (lip / Makeup VTO) | **Unknown** — not confirmed in Perfect Corp API Console units/subscription |
| SDK/API availability (product exists) | **Supported** (public docs) — `POST /s2s/v2.0/file/makeup-vto`, `POST /s2s/v2.0/task/makeup-vto`, effects include `lip_color` / `lip_liner` |
| Mira env licensed for lip | **Not Supported** — `BEAUTY_TRYON_ENABLED=false` in `render.yaml`; no `BEAUTY_REAL_TRYON_ENABLED`; no makeup-specific env; foundation `executionEnabled=false` for `lip` |
| Supported platforms (API) | Image S2S: server-side (ios/android clients via Mira API). Realtime AR SDK: **not verified** for this phase |
| Commercial limitations | Credit/unit based (Perfect pricing); Mira has **no** try-on quota plan wired |
| Rate limits | **Unknown** for makeup-vto on this account |
| Image retention policy | Skin path: in-memory only (documented). Makeup VTO retention: **Unknown** until Perfect DPA/console reviewed |
| Pricing model | Credits per session/task (docs); Mira cost class for `lip` = `MEDIUM` (catalog) |

**Never assume:** Skin analysis API key ≠ verified Makeup VTO entitlement.

---

## 2 Evidence

### Product (Perfect Corp public)

- Docs: https://docs.perfectcorp.com/reference/makeup_vto  
- Lip effects: `lip_color`, `lip_liner`  
- Auth: Bearer API key (same console family as skin)  
- File API path differs from skin: `/file/makeup-vto` vs `/file/skin-analysis`

### Mira repository / deploy

| Item | State |
|------|--------|
| `PerfectCorpService` | Skin analysis only |
| `PerfectBeautyAdapter` | **Does not exist** |
| `BEAUTY_TRYON_ENABLED` | `false` (blueprint) |
| `BEAUTY_REAL_TRYON_ENABLED` | unset / false (foundation) |
| Catalog `lip.executionEnabled` | `false` |
| Program docs (`perfect-services.js`) | Makeup VTO scheduled as future Playground POC |

### Probe

No live call to Perfect Makeup VTO was made (would require secrets + may consume credits without confirmed entitlement).

---

## 3 Classification (Step 1)

| Question | Answer |
|----------|--------|
| Does Perfect Corp product support lip? | **Supported** (API product) |
| Is Mira’s current account licensed for lip? | **Unknown** |
| Is Mira production configured to run lip? | **Not Supported** |
| Overall Phase 5B go/no-go | **NO-GO** |

---

## 4 Actions taken

1. **Stopped** PerfectBeautyAdapter implementation.  
2. Left `FoundationBeautyExperienceAdapter` / disabled try-on path active.  
3. Did **not** set `BEAUTY_REAL_TRYON_ENABLED=true`.  
4. Did **not** enable `lip.executionEnabled` in catalog.  
5. Did **not** call Perfect / Banuba.  
6. Did **not** modify Face or Skin Intelligence.

---

## 5 Required before Phase 5B may resume

Human operator must complete and record:

1. Log into https://yce.makeupar.com/api-console/  
2. Confirm **Makeup Virtual Try-On** (or equivalent) units/subscription active.  
3. Confirm API key can create `file/makeup-vto` + `task/makeup-vto` with `lip_color` (Playground or one paid probe).  
4. Document: rate limits, image retention, price per credit, commercial territory limits.  
5. Set explicit Mira flags only after evidence attached to a Change Request, e.g.:
   - `BEAUTY_LIP_LICENSE_VERIFIED=true`
   - `BEAUTY_REAL_TRYON_ENABLED=true`
   - `BEAUTY_TRYON_PROVIDER=perfect_beauty` (or equivalent)
6. Re-run Phase 5B implementation under a new approval.

---

## 6 Honesty rule

Fabricating a “successful” PerfectBeautyAdapter without license verification would violate Phase 5B non-negotiables and Engineering Laws (never invent success / never fake provider support).
