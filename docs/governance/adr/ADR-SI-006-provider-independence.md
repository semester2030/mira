# ADR-SI-006 — Provider Independence of Styling Intelligence

**Status:** Accepted · Frozen in Styling Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Provider ≠ Capability. Styling reasons over Mira canonical artifacts.

## Decision

Styling Intelligence does not call provider SDKs and does not embed provider payloads on public DTOs. Provider leakage asserts remain mandatory.

## Consequences

- Provider work stays in Vision / adapters.  
- Injecting providers into Styling requires MAJOR CR.
