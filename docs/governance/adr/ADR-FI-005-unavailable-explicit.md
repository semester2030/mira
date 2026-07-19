# ADR-FI-005 — Unavailable is explicit; never invent metrics

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Ineligible pose or missing anchors must not fabricate ratios/shape.

## Decision

Metrics/findings use `availability: unavailable` with null normalized values. Operational Hardening adds explicit runtime states (`AVAILABLE`…`NOT_REQUESTED`) — no silent omit.

## Consequences

- Flutter shows section or runtime notice based on DTO/runtime.  
- Goldens cover ineligible cases.
