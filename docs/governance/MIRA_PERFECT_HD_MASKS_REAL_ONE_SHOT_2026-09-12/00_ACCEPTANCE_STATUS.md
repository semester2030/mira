# MIRA — Perfect HD Skin Masks Real One-Shot Acceptance

**Task:** `MIRA-PERFECT-HD-MASKS-REAL-ONE-SHOT-2026-09-12`  
**Date:** 2026-09-12  
**STATUS:** **PASS**

## Verdict

`PERFECT SPATIAL MASK FOUNDATION = PROVEN`  
All four core HD actions returned real detection masks aligned to the exact Perfect input image (1200×1680, offset 0, no landmark warp).

## Environment

| Field | Value |
|-------|-------|
| Backend path | Authorized local Nest tooling with Perfect S2S credentials present; `NODE_OPTIONS=--dns-result-order=ipv4first` (avoids local IPv6 S3 ConnectTimeout) |
| Deploy required | **NO** — standalone one-shot script; HD endpoint not redeployed |
| Source SHA | `248e7ccfd3a5a13001964d788c63703776c98f3f` |
| Perfect API | `s2s/v2.0` `POST .../task/skin-analysis` |
| HD only | YES — `hd_age_spot`, `hd_pore`, `hd_wrinkle`, `hd_redness` |
| `enable_mask_overlay` | `false` (independent masks) |
| Units consumed | unknown (Perfect tooling did not expose); **2** justified HD tasks (proof + ephemeral viewer materialization) |
| Task id prefixes | first proof + `LrLKjuSmfkde` (viewer session) |

## Core masks

| Action | Result | Dimensions | Alpha | Aligned |
|--------|--------|------------|-------|---------|
| hd_age_spot | MASK | 1200×1680 | YES | YES |
| hd_pore (+ forehead/nose/cheek/whole) | MASK | 1200×1680 | YES | YES |
| hd_wrinkle (+ forehead/glabellar/crowfeet/periocular/nasolabial/marionette/whole) | MASK | 1200×1680 | YES | YES |
| hd_redness | MASK | 1200×1680 | YES | YES |

## Hard gates

- MANUAL X/Y OFFSET = **0**
- LANDMARK WARP = **0**
- LANDMARK CONCERN POLYGONS = **0**
- RAW_SCORE / UI_SCORE = **PRESERVED** separately
- PERSISTENT FACE STORAGE = **0**
- PERSISTENT MASK STORAGE = **0**
- Physical iPhone technical viewer = **PASS** (LAN HTML at `http://172.20.10.6:8765/` — Safari launched; owner visual approval still PENDING)
- CameraKit / premium UI / Phase 6 = **NOT STARTED / LOCKED**

## Privacy

Face + mask bytes live only in `/tmp/mira_hd_ephemeral_session.json` (session-scoped). **Not** in ZIP. Not written to History.

## Legacy

`LEGACY LANDMARK CONCERN MAP = DEPRECATED_PENDING_OWNER_APPROVAL` (code not deleted).
