# FK-4 — Registry Versioning

## Layers
1. Registry schema version (contract pin)
2. Registry content version (registryVersion)
3. Release identifier (releaseId)
4. Rule schema + rule version (FK-2)
5. Snapshot content hash

## Mutation policy
Changes to rule content, lifecycle, provenance, conflict graph, applicability, or trend validity must change registryVersion and/or snapshotHash. No silent mutation.
