# FK-4 — Snapshot Architecture

## FashionKnowledgeRegistrySnapshot
snapshotId, schemaVersion, registryVersion, contentHash, activeRuleIds, provenanceIds, generatedAt (explicit), schemaVersions, releaseId.

Same registry + same clock context → same contentHash / deterministic snapshot identity inputs.
