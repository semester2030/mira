# ADR-FI-004 — Geometry is provider-independent

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Landmarks may come from MediaPipe today and other providers later.

## Decision

Engines consume only `GeometryAnchors` + `PoseSignals` DTOs. No MediaPipe, Perfect, or ML Kit types inside geometry/shape/reco/report engines.

## Consequences

- On-device extractor owns MediaPipe indices.  
- Provider swap = adapter to anchors, not engine rewrite (if DTO stable).
