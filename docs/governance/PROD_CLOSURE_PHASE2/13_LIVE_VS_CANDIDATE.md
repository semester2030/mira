# Phase 2 — Live Production vs Candidate

## Classification

`DIFFERENT`

The exact live Git commit is `UNKNOWN`, but behavior proves that live
production is not the current local candidate.

## Candidate

- base HEAD:
  `dca189cdd42f73d63ac3a4ac3ee00471151c6e98`;
- plus 47 baseline tracked modifications;
- plus 1,940 baseline untracked files;
- production/runtime subset includes the authenticated
  `GET /api/v1/entitlements/runtime` route.

## Live read-only probe

2026-08-30:

- `/api/v1/health`: HTTP 200;
- service: `mira-api`;
- health metadata has no Git SHA;
- Fashion provider execution reports disabled;
- `/api/v1/entitlements/runtime`: HTTP 404.

In the candidate the controller/module exists and an unauthenticated request
would reach the route/guard boundary rather than an absent-route 404. This
behavioral mismatch is sufficient to classify `DIFFERENT`, but not to infer the
live commit SHA.

Render MCP workspace metadata was unavailable due authorization and no
workspace selection. No authentication remediation, deploy, or configuration
change was attempted.

The mismatch is expected to remain until an owner-approved source commit and a
separate Phase 3 deployment.
