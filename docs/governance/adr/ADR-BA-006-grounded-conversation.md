# ADR-BA-006 — Grounded Conversation (deterministic narration)

**Status:** Accepted · Frozen in AI Beauty Advisor v1.0.0  
**Date:** 2026-07-19

## Context

Production correctness requires deterministic, citeable answers.

## Decision

Grounded Response Engine narrates only selected envelope claim statements. LLM narration (if used later) must remain constrained to the same sealed envelope and Law #34 validators. Production 7B path is deterministic template grounding.

## Consequences

- Same sealed envelope + plan → same response (given fixed `now`).  
- Parallel uncitable LLM paths are forbidden for frozen Advisor correctness.
