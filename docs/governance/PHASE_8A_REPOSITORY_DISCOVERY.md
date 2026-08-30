# PHASE 8A — Repository Discovery

## Routes
Evidence: `lib/core/navigation/app_routes.dart`

| Route | Purpose |
|-------|---------|
| `/mira-beauty-report` | Primary beauty/skin result experience |
| `/skin-result` | Alias → same Mira beauty report |
| `/skin-routine` | Routine + partners deep page |
| `/beauty-progress` | Progress / history surface |
| `/mira-advisor` | AI Beauty Advisor entry |

## Primary screen composition order
Evidence: `mira_beauty_report_screen.dart`:

1. PersonalizedGreetingHeader  
2. Intro + disclaimer banner  
3. BeautyScoreHero  
4. SkinIntelligenceSection  
5. FaceIntelligenceSection / FaceIntelRuntimeNotice  
6. BeautyJourneySection  
7. SkinAgeComparisonCard  
8. SummaryCard  
9. MiraTipsSection  
10. ConcernNarrativeSection  
11. FaceHealthMapSection or ConcernZonesNarrativeSection  
12. TreatmentPlanSection  
13. WeeklyPlanSection  
14. _ProductsSection  
15. ProgressForecastSection  
16. ConfidenceLayerSection  
17. AskMiraSection  
18. CTA skinRoutine / dashboard  

## Leakage confirmed
`skin_intelligence_section.dart` shows SVI version and `المصدر: ${m.source}` (`provider_measured` / `locally_calculated` via `result_provenance.dart`).

## State
`AnalysisSession.setSkin(report)` on open; no Result Projection Layer today.
