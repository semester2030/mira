# Phase 4 — Production Deployment Acceptance

Status: `PENDING` · Complexity: `HIGH`

## Purpose

Deploy the exact owner-approved candidate for the first time and prove that
the live runtime matches the audited source.

## Entry conditions

Phase 3C Final PASS; fixed HEAD; critical accounts and environment ready;
production Redis available; BlazeFace delivery strategy decided; rollback plan
documented; explicit owner deployment approval.

## Ordered workstreams

Pre-deploy source identity and redacted config snapshot → exact Render deploy →
deploy identity proof → health/routes/entitlements → database and Redis →
BlazeFace cold start → provider connectivity → startup/log/error review →
rollback readiness.

## Required evidence and tests

- live deployed HEAD equals approved HEAD;
- health PASS and `/entitlements/runtime` available/correct;
- Firebase integration, database and Redis operational;
- BlazeFace loads through approved strategy;
- providers reachable from production runtime;
- no startup fatal;
- rollback mechanism available and tested safely.

## PASS / BLOCK / STOP

PASS requires exact live identity and all core production-runtime checks.
Unknown identity, critical service failure, missing fail-closed dependency or
unsafe fallback stops rollout. Roll back when severity requires it. Do not
continue to Phase 5 on PARTIAL/BLOCKED.

Responsibility: Cursor executes only after owner approval; Owner controls
deployment authorization/secrets; Render and vendors supply infrastructure.

Next gate after owner-approved PASS: `PHASE 5`.
