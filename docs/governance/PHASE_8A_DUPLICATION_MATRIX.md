# PHASE 8A — Duplication Matrix

| Concept | Sources in UI | Personalized? | Conflict risk | Single source of truth (target) |
|---------|---------------|---------------|---------------|----------------------------------|
| Hydration / moisture | Skin intel metrics; ConcernNarrative moisture; Journey priorities; Treatment plan; Tips; Map oiliness/moisture | Partial (score→severity) | High if tip says “acceptable” while concern mild | Priority Engine Presentation from frozen metric + one action |
| Sunscreen | Tips / educational recs / weekly | Often general | Low | Personal Plan only if evidence or profile UV context; else label «نصيحة عامة» |
| Gentle cleanser | Routine / tips | Often general | Low | Daily Routine module |
| Moisturizer | Concerns + treatment + tips | Score-derived severity | Medium | Personal Plan today action |
| Acne | Concerns + map + products + intel | Score-derived | Medium | Priority ≤3 + Map mode badge |
| Redness | Same | Score-derived | Medium | Same |
| Pigmentation | Same | Score-derived | Medium | Same |
| Pores | Same | Score-derived | Medium | Same |
| Sleep / water | Tips / educational | Usually general | High if shown as AI-personal | Educational Content only + label |
| Routine | TreatmentPlan + Weekly + CTA skinRoutine + Journey plan | Mixed | High repetition | Daily Routine entry once on summary |
| Progress | ProgressForecast + Journey goal + SkinAge | Mixed; English “Trends” leak | High | Progress module + Comparability Contract |
| Confidence | ConfidenceLayer + per-metric confidence + SVI confidence | Yes | Visual confusion with condition | ResultConfidenceVM separate visual language |
| Disclaimers | Banner + hero + map + cosmetic fields | N/A | Fatigue | One sticky trust strip + expand details |
| Retake | Quality failure flows (pre-result) + limitations copy | Context | Medium | Retake and Recovery Flow module |
| Product advice | Products section + routine partners + tips | matchScore | Medium | Product Presentation Contract |

**Rule:** No recommendation repeated without UX reason (e.g. today action chip mirroring plan detail).
