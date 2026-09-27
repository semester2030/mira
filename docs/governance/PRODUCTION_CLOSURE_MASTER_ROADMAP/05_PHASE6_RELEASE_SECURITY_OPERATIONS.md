# Phase 6 — Release Build, Security & Operations Closure

Status: `PENDING` · Complexity: `HIGH`

## Purpose

Prove MIRA is reproducibly shippable, observable, recoverable and operable,
and disposition all release-blocking technical debt.

## Entry conditions

Phase 5 PASS; stable production runtime; all critical journeys E2E-proven.

## Workstreams and evidence

- iOS: signed production archive, bundle/entitlements/config/dart-defines,
  installation and TestFlight-ready artifact proof.
- Android: true release signing, no debug signing, production config, verified
  AAB/version/installability.
- Security: every npm advisory marked FIXED, MITIGATED, NOT_EXPLOITABLE,
  ACCEPTED_RISK or BLOCKER; auth, Storage, webhooks, tokens, rate limits,
  secrets, logs, PII and headers reviewed.
- Code quality: historical analyzer warnings classified; zero release-critical
  warning without explicit disposition; zero new errors.
- Observability: operational crash/error, provider, Redis, rate-limit, startup,
  latency, health and alert visibility—debug logs alone do not qualify.
- Recovery: database backup truth, restore ownership, deployment rollback and
  provider-outage response.
- Performance: controlled startup/cold-start/API/provider/memory/crash evidence;
  no SLA inferred from one sample.

## PASS / BLOCK / STOP

PASS requires both mobile artifacts, advisory disposition, operational
observability, documented recovery, reproducible release configuration and no
release-blocking debt. Missing artifact, P0 security issue, unowned recovery or
unobservable critical failure blocks Phase 7.

Responsibility: Shared. Owner controls signing credentials/risk acceptance;
Cursor performs approved builds/reviews; platforms/vendors provide services.

Next gate after owner-approved PASS: `PHASE 7`.
