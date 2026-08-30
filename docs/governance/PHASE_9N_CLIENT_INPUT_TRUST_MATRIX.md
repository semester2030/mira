# Client Input Trust Matrix

| Field | Class |
|---|---|
| contextType | ENUM / IDENTIFIER |
| analysisId (nested) | IDENTIFIER / SECURITY_SENSITIVE (cross-check only; not load key) |
| reportRef | IDENTIFIER (client hint; load uses chat.analysisId) |
| selectedResultId / InsightId / DetailRef / GuidanceId / Region | SELECTION_REF |
| frozenRecommendationRef | SELECTION_REF |
| evidenceRefs / limitationRefs | SELECTION_REF / DISPLAY_HINT |
| confidenceQualifier | DISPLAY_HINT (may lower confidence) |
| personalizationLevel | DISPLAY_HINT (wording prefix only) |
| contextLabelAr | UNTRUSTED_FREE_TEXT / DISPLAY_HINT (not sealed) |
| publicFactAr | LEGACY_IGNORED / UNTRUSTED_FREE_TEXT |
| reasonAr | LEGACY_IGNORED / UNTRUSTED_FREE_TEXT |
| evidenceStale | SECURITY_SENSITIVE hint — client-controlled stale bit (see freshness finding) |
| resultVersion | DISPLAY_HINT |
