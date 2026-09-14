# Fashion LLM Dependency Audit

| Path | LLM? | Grounding | Can invent “replace yellow with beige”? |
|---|---|---|---|
| Beauty Advisor | NO | Law #34 claim list | NO |
| MCE Consultation | YES | Soft prompt + citation ID filter; **no answerAr fact check** | YES |
| LlmOutfitReasoningService | YES | schema scores/recommendations | YES |
| Vision OpenAI semantic | YES | attribute extractor; no recommendations | N/A (attributes) |
| StylingReasoningEngine | NO | Law #32 frozen evidence | NO invention of principles |

**Production fashion chat UX (Ask Outfit Mira) uses MCE** — invent risk is real.
