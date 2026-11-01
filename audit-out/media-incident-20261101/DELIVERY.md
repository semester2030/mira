# MIRA catalog media incident — 2026-11-01

## Verdict (not closed)

Public catalog media still returns HTTP 404. **Root cause is durable object storage access**, not Flutter UI and not “unpublished” catalog rows alone.

| Layer | Count | Notes |
|---|---|---|
| Public catalog (page 1, limit default 8) | 8 items / 21 media links | All probed links → **404** |
| DB `catalog_media` | **72** (34 video, 38 image), all `publication=published` | |
| R2 bucket `mira-catalog-media` | **11 objects** (~89.5 MB) | Objects **exist** (Oct 19 era) |
| Join | **11 keys present in R2**, **~61 DB keys absent** | Absent keys are mostly Oct 24–30 uploads |

Cloudflare Stream was not used as proof of R2 loss (separate product).

## Commit comparison

| Ref | SHA |
|---|---|
| Reviewed | `fc762b2dde31f4daa62037323e85c31adf371433` |
| `origin/main` (published) | same `fc762b2` |
| Local feature tip | `436ddb2` (CORS + password; ancestor path of main) |

No reset performed. Streaming recovery code is local (see below) — **not yet on main**.

## Attachments

| Expected | Status |
|---|---|
| `catalog-media-recovery.patch` | **NOT FOUND** on disk / Downloads / repo |
| `audit-catalog-media.cjs` | **Created** at `mira-api/scripts/audit-catalog-media.cjs` |

Streaming Range fix was implemented manually to match the prompt (native S3/R2 Range + abort on client close). Run `git apply --check` was **BLOCKED** (no patch file).

## Env / credentials blocker (critical)

After retargeting Render env to:

- `MIRA_MEDIA_STORE=s3`
- `MIRA_MEDIA_S3_BUCKET=mira-catalog-media`
- `MIRA_MEDIA_S3_REGION=auto`
- `MIRA_MEDIA_S3_ENDPOINT=https://23b91d3644ea2baa80d9ffcb6062d0d8.r2.cloudflarestorage.com`

Render logs show:

`catalog-media-provider-incomplete` / `catalog-media-durable-unconfigured incomplete`

Meaning **`MIRA_MEDIA_S3_ACCESS_KEY_ID` / `MIRA_MEDIA_S3_SECRET_ACCESS_KEY` are missing** on the service (merge update did not restore secrets; creating R2 tokens via API is not permitted from this session).

### Owner action required (Dashboard)

1. Cloudflare → R2 → **Manage R2 API Tokens** → create token with **Object Read & Write** scoped to `mira-catalog-media` (keep bucket private; do not enable public `r2.dev`).
2. Render → `mira-api` → Environment → set:
   - `MIRA_MEDIA_S3_ACCESS_KEY_ID`
   - `MIRA_MEDIA_S3_SECRET_ACCESS_KEY`
   - keep bucket/endpoint/region as above
3. Redeploy / restart `mira-api`.
4. Probe:  
   `GET /api/v1/marketplace/media/<id>` for a media whose `storage_key` is in the R2 list → expect **206** with `Range: bytes=0-1`.

## Restore map

### A — Recoverable without re-upload (once credentials work)

R2 keys present (11). Map DB rows whose `storage_key` equals these keys. Do **not** delete DB rows. Do **not** change product IDs.

### B — Needs re-upload (objects not in `mira-catalog-media`)

All other `catalog_media.storage_key` values (≈61), including Oct 29–30 large videos (e.g. `af27175f-…` for media `f363c35a-…`). Keep DB rows; replace media via partner portal on the **same** product/service.

### C — Not “missing file” alone

Some older media rows attach to products that are `withdrawn` / inactive — public GET correctly refuses even if the object exists.

## Streaming / OOM code (local)

| Item | Status |
|---|---|
| `storage.open()` with true S3 `Range` + stream body | Implemented |
| Abort upstream on request `close` | Implemented |
| Error classes preserved (permission / connection / missing) | Implemented |
| `npm run test:catalog-media-recovery` | **PASS** |
| Deployed to production | **NOT_RUN** (waiting for credentials + push) |
| Base64 upload streaming / multipart | **NOT_RUN** (separate from playback; still memory-heavy) |
| iPhone Release playback | **NOT_RUN** |
| Isolated load test | **NOT_RUN** |

## Problem table

| Problem | Proven cause | Change | Evidence | Status |
|---|---|---|---|---|
| Public media 404 | Object miss / incomplete store config | Retarget bucket+endpoint; need keys | Logs `catalog-media-missing` then `provider-incomplete`; R2 list=11 | **BLOCKED** (keys) |
| Full-buffer Range (OOM risk) | `storage.get()` then slice | Streaming `open()` in S3 adapter + controller | Local tests PASS | **PASS** local / **NOT_RUN** prod |
| Patch apply | Attachment missing | Manual port of described fix | Search filesystem empty | **BLOCKED** |
| Audit tool | Attachment missing | Added `scripts/audit-catalog-media.cjs` | File present | **PASS** (script) / **NOT_RUN** vs prod keys |
| Re-upload all | N/A | Explicit **no** — only missing keys | Join 11 vs 61 | **PASS** (policy) |

## Closure criteria (remaining)

1. ACCESS/SECRET set on Render for `mira-catalog-media`.
2. At least one Oct-19 key returns 206/200 from API.
3. Deploy streaming commit.
4. Partner re-upload list for missing keys only.
5. iPhone Release spot-check.
