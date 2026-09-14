# FK-1 — FashionAdviceCandidate Contract

Intermediate object **before** user speech.

Core fields:
- candidateId, adviceType, targetRefs
- currentObservation, suggestion (structured), rationale
- knowledgeRuleIds[], sourceType, provenanceState
- evidenceRefs[], confidence, subjectivity
- occasionFit?, preferenceConflict?, culturalContext?
- limitations[], alternatives[], presentationEligibility, status

`sourceType` includes `mira_curated` | `llm_general_knowledge` | `hybrid`.  
`provenanceState` includes `approved` | `reviewed` | `uncurated` | `unknown`.

LLM may only emit this schema — never final user prose as truth.
