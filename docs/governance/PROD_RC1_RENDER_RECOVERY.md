# PROD-RC-1 — Render Recovery

**Date:** 2026-08-11

## Observation

| Probe | Result |
|---|---|
| `https://mira-api-n4p3.onrender.com/api/v1/health` | **HTTP 503** HTML **Service Suspended** |
| Render MCP (`plugin-render-render`) | **NOT AVAILABLE** in this Cursor session |
| Render CLI | **NOT INSTALLED** |
| Blueprint `render.yaml` | Present — service name `mira-api` (free plan) |

## Suspension reason

**UNKNOWN from this environment** — cannot query Dashboard billing/events without API key / human.

Possible classes (unverified): free-plan spin-down vs manual suspend vs billing vs crash loop. Current response is Suspended page, not a Nest stack trace.

## Safe recovery policy

1. Human unsuspend / restore **existing** production behavior only.
2. Confirm health `/api/v1/health` returns app JSON (not Suspended HTML).
3. Confirm DB connectivity and existing safe flags remain OFF for Face/Fashion activation.
4. **Do not** enable Face/Fashion flags merely by unsuspending.

## HUMAN ACTION REQUIRED

1. Open Render Dashboard for `mira-api` / `mira-api-n4p3`.
2. Report suspension reason (billing / manual / free tier).
3. Explicitly approve unsuspend for **safe baseline only**.
4. Optionally provide Render API key so MCP/CLI can verify without Dashboard screenshots.
