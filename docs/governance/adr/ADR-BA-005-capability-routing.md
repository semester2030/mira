# ADR-BA-005 — Capability Routing without engine bypass

**Status:** Accepted · Frozen in AI Beauty Advisor v1.0.0  
**Date:** 2026-07-19

## Context

Advisor must route intents to frozen peers without owning execution.

## Decision

Capability Router maps intent → target subsystems / action routes only. It never invokes frozen evaluation engines and never fabricates capability outputs.

## Consequences

- Shopping/marketplace remain unsupported.  
- Beauty Experience is Activation Ready routing only.
