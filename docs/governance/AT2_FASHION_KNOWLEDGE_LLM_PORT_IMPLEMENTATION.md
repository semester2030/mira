# AT-2 — Port Implementation

## Interface (frozen FK-3)
`FashionKnowledgeLlmPort`:
- `providerId: string`
- `generateStructuredDraft({ request, prompt }) → Promise<FashionLlmProviderResult>`

## Production class
`OpenAiFashionKnowledgeLlmProvider` implements the port exactly.
Uses `buildFashionLlmPrompt` output (system + userPayloadJson) — no parallel prompt architecture.

## Result statuses
`ok` | `malformed` | `timeout` | `failed` | `blocked`
