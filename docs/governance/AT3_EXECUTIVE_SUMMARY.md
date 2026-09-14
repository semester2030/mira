# AT-3 — Executive Summary

## Decision
**A) AT-3 COMPLETED — FLUTTER FASHION ADVISOR PATH READY — READY FOR AT-4 CONTROLLED QA ACTIVATION**

## What shipped
- Client QA flag `MIRA_FASHION_ADVISOR_V1` (default **false**)
- Fashion context model + mapper from `OutfitAnalysis` → Advisor DTO
- `AdvisorApiDataSource.chat` sends optional `fashion`
- `MiraAdvisorScreen` routes outfit fashion turns to `POST /advisor/chat` when flag ON
- Flag OFF + outfit → **fashionUnavailable** (no legacy MCE fashion prescription)
- Skin / atelier remain on MCE
- Sticky fashion conversation keeps follow-ups on Advisor
- No backend flag enablement, no telemetry, no provider redesign

## QA enable
```
flutter run --dart-define=MIRA_FASHION_ADVISOR_V1=true
```
Backend still requires AT-4 to set `FASHION_KNOWLEDGE_*` flags in QA.
