# Occasion & Dress Code Audit

## Canonical inputs
- `MiraOccasion` enum: wedding, work, casual, university, evening, eid, interview — `mira-occasion.ts`
- Ontology occasion keys include wedding, office, eid, beach, … — `ontology.json`
- HTTP analyze accepts `occasionId` — `ai-gateway.controller.ts` → orchestrator

## Suitability evaluation
- OI `ContextEngine` maps occasion and contributes `occasionFit` metric when OI service runs
- **Canonical vision analyze does not invoke OutfitIntelligenceService** — occasion may be accepted but not fully evaluated on that wire path

## Dress-code rules
- Ontology `formality` levels (casual…black_tie) — taxonomy scalars
- **No DressCode engine** evaluating “wedding guest must not upstage bride” etc.

## Can Mira evaluate “appropriate for a wedding?”
**PARTIAL:** can *receive* wedding; can *score* occasionFit inside OI service/tests; **cannot** cite curated dress-code knowledge with provenance on the canonical analyze→advice path.
