# ADR-FI-002 — FaceHealthMap is a sibling, not Face Intelligence

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

`FaceHealthMap` encodes skin concern spatial/narrative overlays.

## Decision

Relationship **C — siblings**. Face Intelligence does not produce FaceHealthMap; FaceHealthMap does not feed Face Intel engines.

## Consequences

- Two sections on MiraBeautyReport.  
- Schema note required on Face Report.  
- LocalFaceMapBuilder remains skin-oriented (deprecated path), not Face Intel.
