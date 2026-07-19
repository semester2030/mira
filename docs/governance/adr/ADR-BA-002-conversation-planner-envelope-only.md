# ADR-BA-002 — Conversation Planner consumes Envelope only

**Status:** Accepted · Frozen in AI Beauty Advisor v1.0.0  
**Date:** 2026-07-19

## Context

Planning must not couple to frozen engines.

## Decision

`planConversation` consumes sealed envelope + capability route only. Stale envelopes never produce grounded plans. Missing evidence → clarify + action route.

## Consequences

- No subsystem internals in planner.  
- Stale → clarify / waiting — never grounded narration.
