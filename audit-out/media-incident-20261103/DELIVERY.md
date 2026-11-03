# MIRA catalog media incident — 2026-11-03 (updated)

## Verdict (not closed)

Public catalog media still fails. Streaming Range on `9f8f61c` was **incomplete**: `open()` destroyed the S3 client before the Body finished → truncated reads (`206` + partial bytes + `ECONNRESET`). That premature **PASS** is **revoked**.

`38f83110-…` still returns failure until keys are applied **and** this client-lifetime fix is live. Incomplete credentials currently surface as storage misconfig (now **503**, not «غير منشور»).

## Fixes in this follow-up (on top of Range — not a re-apply)

| Issue | Fix |
|---|---|
| `execute()` `client.destroy()` around `open()` return | `open()` keeps client until stream `end`/`error`/`close` or `abort()` |
| Short `requestTimeout` on stream body | Stream client uses `STREAM_BODY_TIMEOUT_MS` (600s) |
| Abort on `req.close` | Abort only on **response** `close` before `finish` |
| Storage failures → 404 «غير منشور» | Permission / connection / unconfigured / read → **503** with distinct messages; missing object / unpublished owner → **404** |

Regression: `catalog-media.s3.open-lifetime-tests.ts` — slow 65 536-byte Range must fully arrive (status 206 + full length). Wired into `npm run test:catalog-media-recovery` → **PASS** locally.

## Baseline (unchanged counts; re-affirmed)

| Layer | Count |
|---|---|
| Public catalog | 23 items / 42 media (12 video + 30 image) → all failing |
| DB | 72 published |
| R2 `mira-catalog-media` | 11 objects |
| DB∩R2 | 10 present (size match); 62 absent |
| Public-capable among present | **1** (`38f83110-…`); 9 present but owner withdrawn |

## Missing-object search (before re-upload)

| Source | Result |
|---|---|
| Cloudflare account R2 buckets | **Only** `mira-catalog-media` — sample public missing keys **not** found elsewhere |
| Local `mira-api/var/catalog-media` | Tiny placeholders only; missing production keys **absent** |
| Authorized backups on disk | **Not found** in repo paths searched |

→ Re-upload remains required for the 42 public IDs / 62 absent keys after playback path is proven. Do not delete DB rows.

## Problem table

| Problem | Proven cause | Change | Evidence | Status |
|---|---|---|---|---|
| Truncated Range body | `client.destroy()` in `execute()` finally before Body drain | Lifetime tied to stream | Local slow-server test 65536B full | **PASS** local / **NOT_RUN** prod |
| False 404 on storage outage | catch → NotFoundException | 503 for storage classes | controller mapping | **PASS** code / **NOT_RUN** prod |
| Abort mid-play | `req.close` | response close-before-finish | Node req vs connection semantics | **PASS** code / **NOT_RUN** prod |
| Keys missing on Render | ACCESS/SECRET unset; Save-only without deploy | Owner must set + **deploy** | logs incomplete; probe fails | **BLOCKED** |
| 42 public media | Objects not in bucket (not wrong-bucket) | Re-upload after search | R2 list + local search empty | **BLOCKED** (needs re-upload) |
| Full playback / seek / iPhone | — | after keys + this deploy | — | **NOT_RUN** |
| Base64 upload / OOM | — | still open | prior report | **NOT_RUN** |

## Owner action (still required)

1. Cloudflare R2 API token (Object Read & Write) for private `mira-catalog-media`.
2. Render → `mira-api` → set `MIRA_MEDIA_S3_ACCESS_KEY_ID` + `MIRA_MEDIA_S3_SECRET_ACCESS_KEY`.
3. **Deploy** (Save only does not apply). Confirm this follow-up commit is live.
4. Prove **full** read of `38f83110-…` (not just 2 bytes): e.g. download full Content-Length for a multi‑MB Range and seek.
5. Re-upload only IDs in `RESTORE_MAP.json` that remain missing.

## Closure

Requires: keys deployed + full stream of present public media + restored/re-uploaded required public clips playing on production and iPhone. Incident stays **open**.
