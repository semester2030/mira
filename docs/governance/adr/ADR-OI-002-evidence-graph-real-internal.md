# ADR-OI-002 — Outfit Evidence Graph is real and internal

**Status:** Accepted · Frozen in Outfit Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Law #31 requires structured evidence. Early 6D risked a fake “graph” (records without edges).

## Decision

Outfit Evidence Graph is a real graph: records **and** edges, with `link` and `finalizeLaw31`. It is **internal**. Public surfaces cite evidence IDs via metrics / fieldConfidence / explainability only.

## Consequences

- Capability paths must validate graph integrity.  
- Exposing full graph as required public DTO is a breaking change.
