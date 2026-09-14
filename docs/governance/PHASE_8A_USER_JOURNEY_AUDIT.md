# PHASE 8A — User Journey Friction Report

## Path
Capture → Confirm → Request → Quality → Loading → Long result scroll → Routine / Progress / Advisor

## Structure metrics
| Metric | Finding | Evidence |
|--------|---------|----------|
| Primary screens | 1 + secondary | routes + screen |
| Scroll sections | 15–19 | `mira_beauty_report_screen.dart` children |
| Priority repeats | ≥3 | SkinIntelligence, BeautyJourney, Concerns |
| Competing CTAs | Routine, Dashboard, Ask Mira, products | screen bottom + mid |
| Interaction model | Passive long document | SingleChildScrollView |

## Friction verdict
Fails the 10 primary user questions in the first viewport. Must collapse to executive surface.
