# FK-6 — Implementation Report

## Package
`mira-api/src/fashion-knowledge/accessories/`

| File | Role |
|------|------|
| `year1-mode-b-policy.ts` | Formal Year-1 Mode B policy |
| `models.ts` | Presence, role, dominance, metallic, qualification, goals |
| `fact-projection.ts` | Safe accessory facts; no unsupported inference |
| `eligibility.ts` | Mode B eligibility + FK6 advice types |
| `feature-flag.ts` | `FASHION_KNOWLEDGE_ACCESSORIES_ENABLED` |
| `orchestrator.ts` | Registry → Mode B → Claim Lock |
| `review-candidates.ts` | DRAFT/NEEDS_SOURCE only |
| `validation.ts` | Fail-closed validation + no-shopping |

## Additive extensions
- Advice types: REMOVE_ACCESSORY, CHANGE_ACCESSORY_DIRECTION, NEUTRALIZE/PRESERVE_SUPPORTING_ELEMENTS
- LLM request: `FashionLlmAccessoryFact` / `accessoryFacts`
- Tone safety: gender stereotype, cheap-looking, fake etiquette, absolute accessory phrases
- Mock scenarios: accessories_unknown/known, absolute, gender, brand_sku

## Frozen boundaries
Consumed only. No GI/OI/SI/Wardrobe/Advisor/Canonical* modifications.
