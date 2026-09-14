# Phase 3B — BlazeFace Runtime Dependency Audit

| Property | Verified state at baseline |
|---|---|
| package | `@tensorflow-models/blazeface@0.1.0`, Apache-2.0, lockfile-pinned |
| model | TFHub `tensorflow/tfjs-model/blazeface/1/default/1` |
| resolved manifest | `model.json?tfjs-format=file` |
| app-reported version | incorrectly `blazeface@0.0.7+tfjs` |
| load timing | lazy in first `detect()` |
| startup blocked | NO |
| first request blocked | YES |
| application timeout | none |
| cache | process memory only |
| Render persistence | none across restart/spin-down |
| offline behavior | load throws/hangs; raw failure may become 500 |
| fake fallback | none |
| health readiness | not exposed |
| model weights in repo/build | none |
| measured warm inference | prior local evidence only; cold memory/latency unmeasured |

The package supports an explicit `modelUrl`, but no artifact is currently
reviewed or bundled. Model weight size/checksums are unavailable locally, and
adding/fetching a large binary during this phase without artifact review would
violate the narrow-change policy.

## Minimal decision

Use the existing exact versioned TFHub model, but move loading to production
startup, bound it with a configurable timeout, retain only in-process cache,
expose non-secret runtime state, and fail startup/request explicitly when the
model is unavailable. This removes uncontrolled network download from the
first critical request path without adding an unreviewed binary or changing
detection thresholds.

This is an explicitly bounded contract, not proof of Render reachability.
Bundling with per-file checksums remains a future option after model artifact,
size and license review. Migration to the deprecated package's successor is
outside this minimal remediation.
