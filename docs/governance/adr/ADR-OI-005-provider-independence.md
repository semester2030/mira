# ADR-OI-005 — Provider Independence of Outfit Intelligence

**Status:** Accepted · Frozen in Outfit Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Provider ≠ Capability. Outfit evaluates Mira-owned CanonicalGarments.

## Decision

Outfit Intelligence does not call provider SDKs. It does not embed provider payloads on public DTOs. Input is CanonicalGarment[]; output is CanonicalOutfit (+ internal evidence). Provider leakage asserts remain mandatory.

## Consequences

- Vision/provider work stays in Vision / GI adapters.  
- Injecting providers into Outfit engines requires MAJOR CR and likely architecture lock violation review.
