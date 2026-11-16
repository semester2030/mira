# Consultant Discovery — study ↔ live mapping

**Rules version:** `consultant-discovery.v1` (`rules.v1.json`, 81 rules)  
**Feature flag:** `MIRA_CONSULTANT_DISCOVERY_V1` (server) + Flutter `MIRA_CONSULTANT_DISCOVERY_V1`  
**Path:** Flutter `MiraAdvisorScreen` → `POST /consultant-discovery/turn` → `MarketplaceService.browse` → offer cards → `CatalogRecordScope.page(kind,id)`

## Live path (proven in code)

| Layer | File | Note |
|---|---|---|
| Study HTML | Desktop `MIRA_Consultant_Relationship_Study_AR.html` | 78 branches / 81 rules / 20 acceptance |
| Rules JSON | `mira-api/src/consultant-discovery/rules.v1.json` | R001–R081 |
| Intent | `intent.ts` | Deterministic Arabic signals |
| Service | `consultant-discovery.service.ts` | Flag + browse ≤3 + optional 1 side |
| Controller | `consultant-discovery.controller.ts` | Firebase auth |
| Flutter open | `CatalogRecordScope` | Refetch by id — no stale invent |

## Taxonomy status (partners portal / app)

| Study id | Live id | Status |
|---|---|---|
| clothes.wedding_dress | clothes.wedding_dress | live_exact |
| bags.hand / bags.clutch | bags.* | live_exact |
| beauty / service.salon_* | beauty.* (compat map) | mapped |
| occasions.styling | occasions.styling | public_candidate — **0 published offers** observed in prior prod probe |
| children.newborn | children.* / gifts | public_candidate — **scarce / zero** published newborn offers in prior probe |
| Preview-only study branches | — | documented as preview; not inventable |

Approx from prior catalog probe: ~70 `live_exact`, ~2 mapped (`service.*`→`beauty.*`), ~9 missing/preview.

## Journeys

1. **Guest bag under 300** → product browse `q=شنطة` `priceMax` halalas — opens product cards if published.
2. **Organizer stylist Riyadh** → service browse; asks date if needed; empty catalog → honest «لا عرض منشور» (no invent).
3. **Face image alone** → advice_only; never clinic.
4. **Baby gift** → product search; `saveAsPersonalPreference=false`.

## Acceptance

Intent layer: **20/20** via `acceptance.schema-tests.ts`.  
Live offer open + partner withdraw / size OOS: requires env with flag + published rows — marked separately in readiness journey.
