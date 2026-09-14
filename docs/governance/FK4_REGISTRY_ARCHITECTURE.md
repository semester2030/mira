# FK-4 — Registry Architecture

## Ownership
The Fashion Knowledge Registry owns curated rule storage, versioning, lifecycle, provenance refs, indexes, snapshots, supersession/conflict metadata, audit history, and integrity validation.

## Non-ownership
No authoring UI, no LLM candidate generation, no GI/OI/SI analysis, no Advisor narration, no shopping rank.

## Layout
```
fashion-knowledge/
  registry/          # FK-4 foundation
  assets/fashion-knowledge/registry.json  # empty prod
  llm/               # FK-3 (read-only vs registry)
  knowledge/         # FK-2 rule contracts
```

## Flow
Load JSON → validate → build indexes → cache by (version, hash) → lookup returns rules (not advice).
