# FK-4 — JSON Storage Decision

## Decision
**VERSIONED JSON FIRST** (FK-1 approved).

## Production path
`mira-api/src/fashion-knowledge/assets/fashion-knowledge/registry.json`

## Initial content
Empty rules/relations/provenance. Status EMPTY is valid.

## Nest assets
`nest-cli.json` copies `fashion-knowledge/assets/**/*` into dist.
