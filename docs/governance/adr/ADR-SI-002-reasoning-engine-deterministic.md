# ADR-SI-002 — Deterministic Reasoning Engine (no LLM required)

**Status:** Accepted · Frozen in Styling Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Styling must produce explainable decisions without provider or LLM dependency for correctness.

## Decision

Production Reasoning Engine is deterministic: conflict, priority bands, goals, preferences, long-term continuity, consistency. LLM may narrate later (Advisor) but must not create uncitable decisions.

## Consequences

- No LLM-required path for freeze correctness.  
- Changing reasoning policy version requires CR and golden updates.
