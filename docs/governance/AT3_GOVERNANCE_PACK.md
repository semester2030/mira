# AT-3 — Remaining Governance Pack

Companion notes for AT-3 (see also AT3_EXECUTIVE_SUMMARY.md).

## Current → New flow
**Old:** Ask Outfit Mira → MCE SSE only.  
**New:** Outfit + `MIRA_FASHION_ADVISOR_V1` → `/advisor/chat` + fashion DTO; flag OFF → unavailable; skin/atelier → MCE.

## Advisor DTO / Fashion context
Public fields only via `AdvisorFashionContext.toJson()`. See mapper + `AdvisorApiDataSource`.

## Garment / Outfit / Occasion / Dress / Preference / Accessories / Form
- Garments from region colors; no fabricated silhouette/material
- Outfit id from snapshot when present
- Occasion from analysis or explicit follow-up
- Dress code only when explicit label/clarification
- Preferences accumulated from explicit tokens
- Accessories: PRESENT only with evidence; else UNKNOWN
- Form/silhouette omitted when unknown

## Freshness
`analysisGate` degraded/blocked/stale → `evidenceStale=true`

## API wiring / MCE separation / Session
Existing Dio + auth; mutually exclusive routes; sticky Advisor for follow-ups; backend owns `adv_{userId}` session.

## Legacy Ask Outfit Mira
**REPOINT_TO_ADVISOR** through MiraAdvisorScreen.

## Error UX / Privacy
No offline fashion advice; no images/GPS/religion; preserve qualified language.

## Red/Yellow/Wedding
Covered by mapper + API POST tests (mocked).

## Frozen boundary / Risks / Debt
No FKL semantic changes; risk if client flag ON before AT-4 backend flags (fail-closed Mode B); debt: richer vision garment ids later.
