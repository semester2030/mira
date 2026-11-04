# NEXT_PHASE_HANDOFF — after P1 owner acceptance

## Source references
- `MIRA_PARTNER_PORTAL_RC2/CURSOR_IMPLEMENTATION_BRIEF.md`
- `MIRA_PARTNER_PORTAL_RC2/specs/11-IMPLEMENTATION.md` (phase table)
- `MIRA_PARTNER_PORTAL_RC2/specs/07-MEDIA.md` (upload/media contracts)
- P1 accepted package: `MIRA_P1_PARTNER_EDITOR_CLOSURE_RC13_20261104T142814Z.zip`
- P1 `codeCommit`: `3254b19be96a2ff3c82a5fb9b422f16041dc615d`

## Next phase (from approved study)
**P2.1 — UploadSession + signed multipart + finalize worker**

Immediate follow-on in the same media track: **P2.2 — نشر الوسائط / cover / order / variant media**.

Desired product direction (aligned with study order): make image/video upload easier and bind media to the product or service — implemented as P2.1 then P2.2, not as an invented parallel phase.

## Scope (P2.1)
- `UploadSession` lifecycle: created → uploading → uploaded → verifying → ready | failed | aborted
- Partner browser uploads via short-lived **server-issued signed S3/R2 multipart** URLs after draft ownership checks
- Server-generated `objectKey`; no client-chosen random keys
- Part size 16MiB (except last), concurrency baseline 2, failed-part retries with backoff
- Finalize worker: size/HEAD/content verification; bounded-memory video duration/codec checks; **no Base64 video load in NestJS**
- READY only after verification; transactional bind to CatalogMedia on the same owner; idempotent retries (no duplicate rows)
- Abort + cleanup of incomplete sessions (proposed 24h); do not delete objects already linked to published media
- Limits per `07-MEDIA.md` (e.g. video ≤300s; image initial 20MiB; configurable large-object guard)

## Out of scope for P2.1 start
- Cloudflare Stream (explicitly not in this media track)
- Rewriting Product/Service identity or review cycle
- Treating P1 deferred verification items as closed
- Production deploy / iPhone Release (later gates in the study)

## Exit criteria (P2.1 from study table)
Duration ≤300s path, retries, metadata, dedupe, memory budget, R2 private — with command+output+time+commit evidence. Rollback: stop new uploads; finish in-flight sessions without deleting published media.

## P2.2 exit criteria (handoff awareness)
READY-only visibility; seek/full read; upload failure must not lose draft; keep proven reader.

## Approved code starting point
| Field | Value |
|---|---|
| Branch context | `mira/p1-partner-editor-v2-rc13` (or successor branch cut from this commit) |
| codeCommit | `3254b19be96a2ff3c82a5fb9b422f16041dc615d` |
| Reuse | Existing Product / Service / CatalogMedia / identity / review cycle / commerce locks |
| Flag | Partner editor V2 already in use for P1; do not invent a second editor stack |

## Dependencies to start P2.1
- P0 media-source baseline awareness and partner/R2 access for **implementation environments** (not implied production cutover)
- P1.2 draft/owner binding semantics (accepted P1 codebase)
- R2 private bucket + server credentials available to the **local/staging** implementation environment only when authorized
- Contracts/guidance in `specs/07-MEDIA.md` and implementation rules in `CURSOR_IMPLEMENTATION_BRIEF.md` / `specs/11-IMPLEMENTATION.md`
- Preserve registry as activity spine; optional descriptive fields remain optional

## Deferred P1 verification (not closed)
See `DEFERRED_VERIFICATION.md`:
- `P1-DV-01` field-save independent request/server/reopen (+ availability alone)
- `P1-DV-02` full variant exact expected + service answer add/edit/clear per step
- `P1-DV-03` real image load, owner-before-retry, no false zero media count, single-file → one media

These remain **DEFERRED_BY_OWNER**. They must not be silently marked resolved by starting P2.1.

## This handoff does not
- Start P2.1 implementation
- Change production settings
- Re-run P1 REVERIFY for documentation-only acceptance
