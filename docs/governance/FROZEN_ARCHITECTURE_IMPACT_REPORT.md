# Frozen Architecture Impact Report

| Subsystem | Must reopen? | Notes |
|---|---|---|
| Garment Intelligence | NO | Consume CanonicalGarment |
| Outfit Intelligence | NO | Optional consume CanonicalOutfit if/when exposed |
| Styling Intelligence | NO | May cite SI decisions as prefs; don’t rewrite reasoning |
| AI Beauty Advisor | NO | Extend envelope claims only |
| Evidence Envelope | EXTEND allowlists carefully | Don’t fake outfit_intelligence provenance for MCE |

**Additive Fashion Knowledge Layer is compatible with freeze** if it sits *after* detection/evaluation and *before*/alongside Advisor speech.
