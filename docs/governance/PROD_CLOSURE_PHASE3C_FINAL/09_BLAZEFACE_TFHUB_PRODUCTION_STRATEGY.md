# Phase 3C Final — BlazeFace/TFHub Production Strategy

## Current architecture

- model: `@tensorflow-models/blazeface` version locked by the committed npm
  lockfile;
- source: the package's TFHub model URL;
- timing: production startup preload, not uncontrolled first-request load;
- cache: process memory;
- timeout: bounded by `BLAZEFACE_MODEL_LOAD_TIMEOUT_MS`;
- startup: preload failure rejects initialization;
- health: runtime state is available in the candidate health contract;
- failure: explicit error, never a synthetic face result.

The prior real local/clean preload reached TFHub but failed/timed out. This is
not promoted to a Render failure.

## Approved candidate strategy

`A — deterministic production startup preload from the lockfile-pinned
BlazeFace/TFHub dependency, with the existing bounded timeout, process cache,
startup failure and runtime health reporting.`

No new architecture or product-source modification is required before Phase
4. Phase 4 must prove candidate Render egress, cold-start load, memory,
inference and health. If that fails, stop and open a separately authorized
code-remediation decision (for example, integrity-reviewed bundling); do not
silently fall back.

- LOCAL/CLEAN REAL RUNTIME: `FAIL`
- FAILURE SAFETY CONTRACT: `PASS`
- RENDER RUNTIME PROOF: `RESERVED FOR PHASE 4`
- PRODUCTION DELIVERY STRATEGY: `EXPLICIT`
