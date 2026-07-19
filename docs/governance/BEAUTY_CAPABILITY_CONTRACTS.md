# Beauty Capability Contracts (Design Freeze)

These contracts are normative for Phase 5B+. No provider SDK in this phase.

| Contract | Locks |
|----------|-------|
| CapabilityCatalogContract | Frozen ID set, catalog version 1.0.0 |
| CapabilityMetadataContract | Metadata fields; no provider fields |
| CapabilityDependencyContract | Explicit dependency lists |
| CapabilityCompatibilityContract | Compatible / exclusive / sequential / parallel |
| CapabilityRuntimeContract | Status matrix + explainability fields |
| CapabilityVersionContract | Semver + deprecation / removal rules |
| CapabilityCostContract | LOW / MEDIUM / HIGH / VERY_HIGH |

SSOT implementation: `BEAUTY_CAPABILITY_CATALOG.json` + TypeScript modules under `beauty-experience/capability/`.
