# PHASE 8A — ARCHITECTURE LOCK

**Status:** APPROVED WITH REQUIRED PRE-IMPLEMENTATION DECISIONS  
**Date:** 2026-07-20  
**Decision code:** **B**

## 1. Problem statement
Frozen Mira intelligence is not the bottleneck. The Skin/Beauty result experience is a long, repetitive, mixed-category scroll that leaks internal terms, confuses score semantics, over-claims map localization, and delays clear next actions and Advisor entry.

## 2. Scope
Presentation, orchestration, IA, UX contracts, projection models, analytics/testing/migration plans for Skin Analysis Result / Report / Map / Care Plan / Advice / Progress / Products / Advisor entry points.

## 3. Non-goals
No changes to Skin/Face/Fashion/Advisor intelligence calculations, canonical contracts, providers, confidence algorithms, Engineering Laws #1–#34 implementations, or Commerce platform.

## 4. Ownership boundaries
| Layer | Owner |
|-------|-------|
| Frozen intelligence | Existing frozen subsystems |
| Result Projection Layer | Results Experience (new) |
| Public copy | Results Experience + i18n |
| Advisor speech | Beauty Advisor (Laws #33/#34) |
| UI modules | Flutter Results Experience |

## 5. Target user journey
Capture → Quality → Loading → **Executive Summary surface** → optional Metrics/Map/Plan/Progress/Products sheets → Advisor/Retake as needed.

## 6. Target IA
Option **D** Hybrid. First surface hard caps (summary, ≤3 priorities, 1 action, routine/progress/advisor entries).

## 7–13. Contracts
Score Semantics · Confidence separate · Progress Comparability · Product Presentation · Skin Map Mode B (current) · Personalization labels · Public Language Policy — see sibling PHASE_8A_* docs.

## 14. Advisor integration
Explain frozen evidence only; early entry; no public MCE; no second intelligence engine.

## 15. Analytics / testing / migration
See PHASE_8A_ANALYTICS_CONTRACT, TESTING_STRATEGY, MIGRATION_STRATEGY.

## 16. Protected frozen boundaries
Skin Intelligence, Face Intelligence, Wardrobe/Garment/Outfit/Styling freezes, AI Beauty Advisor freeze, Laws #1–#34.

## 17. Engineering Laws assessment
### Law #35 (proposed)
“Every result presented to the user must have one clear meaning, one evidence source, one confidence state, one recommended action, and one presentation owner.”

**Assessment:** Necessary and correctly scoped to **presentation**. Compatible with #33/#34 (Advisor remains non-owner of intelligence).  
**Recommendation:** **APPROVE** as presentation law.

### Law #36 (proposed)
“The Results Experience must never expose internal provider, canonical, mapping, raw-score, trace, or implementation terminology to public users.”

**Assessment:** Necessary; closes confirmed leakage (`m.source`, SVI version, MCE, Trends). Compatible with #5 (vendor never reaches Flutter) by extending to user-visible strings.  
**Recommendation:** **APPROVE** as presentation law.

Formal ADR adoption deferred to Phase 8B kickoff.

## 18. Pre-implementation decisions (required)
1. **Product match public floor** — default proposal ≥70% numeric; confirm.  
2. **Map mode badge copy** — final AR/EN strings for Mode B.  
3. **Feature flag name & default cohort** — confirm.  
4. **Whether SkinAge appears on first surface** — default: secondary unless confidence high.  
5. **LocalAdvisorEngine presets** — replace with envelope-seeded questions only in 8H.

## 19. Implementation phases
8B→8L as in ROADMAP. **Do not start 8B UI until decisions accepted or explicitly waived.**

## 20. Release gates
Projection tests · no forbidden tokens · first-surface caps · map honesty · comparability · Law #33/#34 · independent audit A · freeze certificate.

## FINAL DECISION
**B) ARCHITECTURE LOCK APPROVED WITH REQUIRED PRE-IMPLEMENTATION DECISIONS**

Evidence basis: repository inspection of `mira_beauty_report_screen.dart`, `skin_intelligence_section.dart`, `report_face_map_spec.dart`, `local_face_map_builder.dart`, `local_progress_builder.dart`, `ask_mira_section.dart`, routes, and frozen Advisor governance.


## Appendix — Module ownership matrix (Step 15)

| Module | Purpose | Input | Output | Visibility | Forbidden |
|--------|---------|-------|--------|------------|-----------|
| Result Summary | Answer Q1–Q2 in one viewport | Frozen SVI + skin type + headline | ResultSummaryVM | Always if report displayable | Recalculate score |
| Priority Engine Presentation | ≤3 priorities | priorityFindings / concerns (policy pick) | ResultPriorityVM[] | If ≥1 actionable | Invent findings |
| Metric Overview | Progressive metrics | Skin/Face metrics | ResultMetricVM[] | Tab/sheet | Raw source enums |
| Skin Map | Spatial education | Map mode B data | ResultMapVM | If map enabled | Claim Mode A |
| Personal Plan | Today / avoid / why | Priorities + routine seeds | ResultActionVM | Always on summary | Unsupported certainty |
| Daily Routine | AM/PM steps entry | dailyRoutine | ResultRoutineVM | Entry on summary; detail secondary | Duplicate full plan on summary |
| Weekly Adjustments | 7-day tweaks | weeklyPlan | sheet | If present | Overwhelm summary |
| Progress | Comparable deltas | history + gates | ResultProgressVM | Entry; detail if comparable | Fake trends |
| Product Recommendations | Eligible products | products + floor | ResultProductVM[] | If eligible ≥1 | Show low match spam |
| Trust and Confidence | Separate confidence UX | confidence layer | ResultConfidenceVM | Chip + details | Same ring as vitality |
| Advisor Entry | Envelope discuss | report ids | ResultAdvisorContextVM | On summary | MCE public / 2nd engine |
| Educational Content | General advice labeled | educational recs | labeled list | Opt-in / collapsed | As personalized AI |
| Retake and Recovery | Quality failure path | quality errors | recovery CTA | On failure / low confidence | Blame user harshly |
