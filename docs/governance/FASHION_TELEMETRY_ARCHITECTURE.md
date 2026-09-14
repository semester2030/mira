# FK-1 — Telemetry Architecture

Events: advice_generated/presented/opened/accepted/rejected/saved, alternative_selected, advisor_followup, user_preference_override, rule_used, llm_fallback_used, curated_rule_used, clarification_requested, outfit_reanalyzed.

Payload: adviceCandidateId, ruleIds?, sourceType, occasion, anonymized garment/color features, userAction, model/rule versions.

No unnecessary image storage.
