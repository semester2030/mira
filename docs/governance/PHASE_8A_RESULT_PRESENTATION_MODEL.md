# PHASE 8A — Result Presentation Model

## Data flow
Frozen Intelligence Outputs → **Result Projection Layer** → Result Presentation Model → Priority/Visibility Policy → Localized Public Copy → UI Modules → Advisor Evidence Envelope (on request)

## VMs (public-safe only)
| VM | Exposes | Forbids |
|----|---------|---------|
| ResultSummaryVM | vitality, skinType, headline, oneSentence | raw provider, versions |
| ResultPriorityVM | id, title, why, actionId, confidenceState | engine ownership |
| ResultMetricVM | displayName, statusLabel, scoreView, direction, explainKey | source enums |
| ResultActionVM | today action, avoid list | unsupported claims |
| ResultRoutineVM | morning/evening steps entry | invent actives |
| ResultMapVM | mode enum A/B/C, badge, regions presentation | Mode A claim without evidence |
| ResultProgressVM | comparable?, deltas, projectionTagged | fake history |
| ResultProductVM | eligible?, matchDisplay, disclosures | low match % spam |
| ResultConfidenceVM | overall + item states | confusion with condition colors |
| ResultAdvisorContextVM | envelope refs / question seeds | second intelligence |

## Projection Layer ownership
Flutter presentation package (new in 8B) — deterministic, versioned, unit-tested. Does not alter intelligence meaning.
