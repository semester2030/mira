# FK-11 — Registry Audit

## Production registry.json
- `rules: []`
- `metadata.fk5ActiveRuleCount: 0`
- review inventory `productionActiveRuleCount: 0`

**ACTIVE curated = 0 — VERIFIED.**

## Loader
`loadProductionFashionKnowledgeRegistry` fail-closed against TEST_ONLY leakage.

## Mode A first
Bridge `tryModeA` then Mode B — verified in `bridge.ts`. Vacuous today because ACTIVE=0.
