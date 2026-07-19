# ADR-SI-001 — Canonical Styling Profile is the sole public styling model

**Status:** Accepted · Frozen in Styling Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Styling reasoning must not leak provider models or parallel DTOs.

## Decision

`CanonicalStylingProfile` (`style-schema-v1`) is the only public styling model. Decision Ledger bodies are internal. `toPublicCanonicalStylingProfile` strips `decisionLedgerRef`.

## Consequences

- Advisor/Reco/clients consume Canonical Styling Profile only.  
- Parallel public styling schemas require MAJOR + CR.
