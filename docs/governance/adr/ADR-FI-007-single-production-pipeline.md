# ADR-FI-007 — Single production Face Report pipeline (API)

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Flutter mirrors existed for tests/offline; audit found parallel pipeline risk.

## Decision

Production report generation is **only** `runFaceReportPipeline` on the API, invoked once from `IntelligenceService`. Flutter Face*Pipeline mirrors are gated (`FaceClientMirrorGate`) for Testing/Future offline.

## Consequences

- Engineering Law audit asserts single call site.  
- Offline productization needs a CR before enabling mirrors in production.
