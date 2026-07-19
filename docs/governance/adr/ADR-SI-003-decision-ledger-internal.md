# ADR-SI-003 — Internal Decision Ledger

**Status:** Accepted · Frozen in Styling Intelligence v1.0.0  
**Date:** 2026-07-19

## Context

Audit, Advisor, and compliance need immutable decision records without exposing them as a public API.

## Decision

Every Style Decision appends an internal Decision Ledger entry (decisionId, evidenceIds, policy/decision versions, confidence, outcome, historyRef). Ledger is not a public contract; stripped from public profile. Decision ↔ ledger bijection is validated.

## Consequences

- Gateways must not serialize ledger by default.  
- Making ledger a required public DTO is a breaking change.
