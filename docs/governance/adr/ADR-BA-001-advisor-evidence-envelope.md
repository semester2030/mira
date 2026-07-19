# ADR-BA-001 — Advisor Evidence Envelope is the sole Advisor reasoning input

**Status:** Accepted · Frozen in AI Beauty Advisor v1.0.0  
**Date:** 2026-07-19

## Context

Advisor must not read frozen subsystem internals or invent facts.

## Decision

Sealed `AdvisorEvidenceEnvelope` (`advisor-envelope-v1`) is the only input to Conversation Planner and grounded narration. Immutable after seal. Provenance-gated subsystem attribution.

## Consequences

- Planner/response must not inspect Canonical* / Decision Ledger / BE internals.  
- Changing envelope speech boundary requires MAJOR + CR.
