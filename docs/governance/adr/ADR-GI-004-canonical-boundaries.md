# ADR-GI-004 — Canonical-only boundaries

**Status:** Accepted · Frozen in v1.0.0  
**Date:** 2026-07-19

## Context

Engineering Laws #6 / #27 / #28 require canonical models across subsystem boundaries.

## Decision

Public GI boundaries carry only Canonical Fashion DTOs (`CanonicalGarment` + public runtime). Vendor documents and parallel garment schemas are forbidden on those boundaries.

## Consequences

- Port and HTTP contracts are protected freeze surfaces.  
- Dual public schemas require MAJOR CR (discouraged).
