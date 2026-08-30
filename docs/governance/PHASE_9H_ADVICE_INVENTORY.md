# PHASE 9H — Advice Inventory

| advice key | current text source | screen | owner class | actual source | personalization | duplicates | safety | future owner |
|---|---|---|---|---|---|---|---|---|
| fi_hairstyle_* | FaceIntelRecommendation title/body | Legacy FaceIntelligenceSection + 9H | FACE_INTELLIGENCE_OWNED | frozen FI recommendations | PERSONALIZED iff primary+eligible | category dedup | cosmetic only | Face Guidance projection |
| fi_makeup_contour_* | same | same | FACE_INTELLIGENCE_OWNED | frozen FI | PERSONALIZED | category dedup | cosmetic | Face Guidance |
| fi_eyewear_* | same | same | FACE_INTELLIGENCE_OWNED | frozen FI | PERSONALIZED | category dedup | cosmetic / fashion-boundary noted | Face Guidance (compat) |
| fi_accessories_* | same | same | FACE_INTELLIGENCE_OWNED | frozen FI | PERSONALIZED | per-id | fashion-boundary noted | Face Guidance (compat) |
| fi_educational_* | same | same | FACE_INTELLIGENCE_OWNED | frozen FI | EDUCATIONAL | category | safe explain | Face Guidance educational |
| legacy_beauty_tips | SkinReport.advice / tips lists | MiraBeautyReportScreen | GENERIC_STATIC / LEGACY | static/legacy | GENERAL | high | do not label personalized | Legacy debt |
| skin_intel_recs | SkinIntelRecommendation | Skin surfaces | SKIN_OWNED | Skin Intelligence | n/a for Face Guidance | n/a | medical risk if absorbed | Skin |
| fashion_styling | Fashion Knowledge | Fashion/Advisor | FASHION_OWNED | Fashion Knowledge | n/a | n/a | cross-domain | Fashion |
| advisor_suggested_q | Advisor prompts | Advisor | ADVISOR_OWNED | Advisor | conversational | possible overlap | narration only | Advisor (9I) |
| brow_guidance | none found as FI category | — | UNSUPPORTED | — | HIDE | — | — | future if owned |
| local_recommendation_engine UI | Face recommendation engine (server/local) | gated | FACE_INTELLIGENCE_OWNED production path | FI output | via wire DTO | — | client DTO strips reason/confidence | keep FI owner |

## Notes
- Client DTO `FaceIntelRecommendation` exposes id/category/title/body only (reasonAr/evidence/confidence stripped on client) — documented debt; 9H synthesizes public reason from projected primary shape when category supports it, without inventing new engine rules.
