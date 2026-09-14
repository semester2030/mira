# PHASE 8A — Product Recommendation Audit

## Current
- `_ProductsSection` in `mira_beauty_report_screen.dart` shows `تطابق ${p.matchScore}%` when `matchScore > 0`.  
- Entity: `MiraBeautyReport` product fields include `matchScore`.  
- Confidence aggregation references product match scores in `local_confidence_layer_builder.dart`.

## Gaps
- No public eligibility floor (50% / 59% unclear).  
- Partner/sponsored/affiliate disclosure not consistently enforced in report UI.  
- Concern/ingredient linkage not always visible to user.

## Product Recommendation Presentation Contract (proposal)
| Rule | Value |
|------|-------|
| Min public match | **≥70%** to show percentage; 60–69 qualitative only; <60 hide or “قد لا تناسبك” |
| Always show | Why linked (concern ids public labels) + confidence state |
| Disclosure | partner / sponsored flags if present |
| Low inventory | Empty state, no fabricated alternatives |
| No commerce platform redesign | Presentation only |

**Pre-implementation decision required:** exact threshold (default proposal 70).
