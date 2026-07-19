# ADR-GI-005 — Deterministic garment identity

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Nondeterministic ids broke wardrobe stability and golden pins (Audit Critical #1).

## Decision

`garmentId` is content-addressed per `garment-identity-v1` (sha256 over mapping/schema/policy/slot/category/type/colors/material/fit/segmentId). No `Date.now` / `Math.random` / `newTraceId` for identity. Pure mapping timestamps use epoch.

## Consequences

- Same Vision evidence ⇒ same wardrobe ref.  
- Formula changes are MAJOR + CR.
