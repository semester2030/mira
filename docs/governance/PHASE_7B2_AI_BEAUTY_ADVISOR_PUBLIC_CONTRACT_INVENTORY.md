# AI Beauty Advisor v1.0.0 — Public Contract Inventory

**Status:** Frozen  
**Date:** 2026-07-19

## 1. Advisor Session

| Item | Contract |
|------|----------|
| Session id | `adv_{userId}` (HTTP) or caller-supplied `sessionId` |
| Continuity | In-process session map on `BeautyAdvisorService` (accepted debt) |
| Version | `advisor-session-v1` |

## 2. Advisor Runtime

| Item | Contract |
|------|----------|
| Type | `AdvisorRuntime` |
| Version | `advisor-runtime-v1` |
| Statuses | conversation · clarification · blocked · waiting · completed · unsupported · degraded |
| Fields | status, reasonCode, stage, traceId, envelopeId, sessionId, retryable |

## 3. Conversation State

| Item | Contract |
|------|----------|
| Type | `ConversationState` |
| Version | `advisor-conversation-v1` |
| Fields | turnIndex, lastIntent, pendingClarifications, openActions, lastEnvelopeId |

## 4. Advisor Memory

| Item | Contract |
|------|----------|
| ConversationMemory | Turns + optional rolling summary ref |
| SessionMemory | Bound evidence/subsystem refs only |
| AdvisorMemoryRefs | Preference / goal / history / long-term **refs only** |
| Version | `advisor-memory-v1` |

## 5. Planner Contracts

| Item | Contract |
|------|----------|
| Type | `ConversationPlan` |
| Version | `advisor-planner-v1` |
| Strategies | grounded · clarify · refuse · unsupported |
| Input | **Advisor Evidence Envelope only** |

## 6. Envelope Projection

| Item | Contract |
|------|----------|
| Type | `AdvisorEvidenceEnvelope` (sealed) |
| Version | `advisor-envelope-v1` |
| Public rule | Envelope is **internal** to Advisor reasoning; not a client-required DTO |
| Projection | Public summaries → evidence units with honest provenance |

## 7. Public APIs

| API | Notes |
|-----|-------|
| `POST /advisor/chat` | Facade → Beauty Advisor turn |
| `BeautyAdvisorService.turn` | Programmatic orchestration entry |

**Not public:** Decision Ledger, Canonical*, provider payloads, full envelope body on HTTP response.
