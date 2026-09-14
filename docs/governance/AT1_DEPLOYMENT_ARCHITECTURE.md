# AT-1 — Actual Deployment Architecture

**Date:** 2026-08-10

## Production graph (evidence-based)

| Node | Status |
|------|--------|
| Flutter app | LIVE |
| Firebase Auth | LIVE (Render `AUTH_SKIP=false`) |
| Nest API (`mira-api` on Render) | LIVE |
| `POST /advisor/chat` | WIRED_BUT_DISABLED (FKL flags off; optional LLM port missing) |
| `AdvisorService` → FKL bridge | WIRED_BUT_DISABLED |
| Fashion Knowledge Platform v1.0.0 | FROZEN / IMPLEMENTED |
| Nest `FASHION_KNOWLEDGE_LLM_PORT` | MISSING (token optional; no provider) |
| Mock FKL provider | TEST_ONLY |
| MCE Consultation + SSE | LIVE (fashion quarantined Option A) |
| OpenAI via `LLM_API_KEY` | LIVE for MCE / vision / legacy OI LLM |
| Claim Lock → Envelope → BeautyAdvisor | WIRED on `/advisor/chat` path |
| Flutter → `/advisor/chat` | IMPLEMENTED_NOT_WIRED (datasource unused) |
| Flutter → consultation | LIVE (primary Ask Mira) |
| Recommendations | LEGACY / LIVE routes |
| Client FashionKnowledgeGraph / compatibility.json | LEGACY local engines |

## Intended activation path (not live today)
Flutter fashion context → `POST /advisor/chat` → AdvisorService → bridge → Mode B provider → Claim Lock → Envelope → grounded response
