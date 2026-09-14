# AT-1 — Client Fashion Path Audit (CRITICAL)

## Finding
Primary Flutter Ask Mira UX (`MiraAdvisorScreen`) uses **Consultation SSE (MCE)**, not `POST /advisor/chat`.

Evidence:
- `mira_advisor_screen.dart` → `ConsultationStreamDataSource.sendMessageStream`
- `AdvisorApiDataSource.chat` posts `message` + optional `analysisId` only — **never `fashion`**
- `AdvisorApiDataSource` has **no callers** elsewhere in `lib/`

## Context at journey entry
| Entry | Context available | Sent to FKL path? |
|-------|-------------------|-------------------|
| Beauty report Ask Mira | Skin report | N/A — goes to MCE |
| Outfit result Ask Outfit Mira | OutfitAnalysis + optional skin | Snapshot to MCE via `OutfitConsultationMapper` (scores/verdict/colors) — **not** AdvisorFashionContextDto |
| Metrics hub Ask Mira | Metric/concern IDs | Navigates Advisor args — MCE |
| General Advisor route | Route args | MCE |

## AdvisorChatDto.fashion field status
| Field | Client status |
|-------|---------------|
| garments | AVAILABLE_CLIENT_SIDE_BUT_NOT_SENT (from OutfitAnalysis / GI) |
| accessories | PARTIAL / NOT_SENT |
| outfitId | AVAILABLE_BUT_NOT_SENT |
| occasion | AVAILABLE_BUT_NOT_SENT (occasion.id) |
| dressCode | NOT_AVAILABLE / NEEDS_MAPPING |
| preferenceTokens | NOT_AVAILABLE |
| culturalContext + explicit | NOT_AVAILABLE |
| evidenceRefs | NEEDS_MAPPING from analysis IDs |
| evidenceStale | NOT_SENT |

## Implication
AT-3 is **mandatory** for real users to receive Mode B: route fashion-prescriptive questions to `/advisor/chat` with mapped `fashion` payload. Enabling Nest provider alone will not change primary UX (still MCE quarantine replies).
