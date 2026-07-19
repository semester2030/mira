# Phase 7B — Runtime Report

**Runtime version:** `advisor-runtime-v1`

| Status | When |
|--------|------|
| `conversation` | Active grounded dialogue |
| `clarification` | Missing evidence / need bind |
| `blocked` | Safety block |
| `waiting` | Non-ok primary without terminal clarify |
| `completed` | Grounded answer `advisor_ok` |
| `unsupported` | Shopping / marketplace / out of scope |
| `degraded` | Low confidence path |

Stages: `ingress` → `route` → `envelope` → `plan` → `respond` → `terminal`  
Traceability via `traceId` + `envelopeId` + `sessionId`.
