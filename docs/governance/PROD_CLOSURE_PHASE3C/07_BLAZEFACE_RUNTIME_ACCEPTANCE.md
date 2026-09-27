# Phase 3C — BlazeFace Runtime Acceptance

## Source contract

- package: `@tensorflow-models/blazeface@0.1.0`;
- npm package tarball integrity: lockfile-pinned SHA-512;
- model source/version: TFHub BlazeFace v1 default/1, hardcoded by the pinned
  package and mirrored by the runtime status contract;
- production strategy: bounded startup preload, process-memory cache, explicit
  startup/request failure;
- model-weight checksum: not available because weights are remote.

## Real cold-runtime attempt

From the clean detached checkout, a new Node process attempted production
startup preload with a 30-second application bound. The provider fetch failed
after approximately `10.8 s`. A secondary read-only TFHub fetch also timed out.

Because preload failed:

- successful real inference: `NOT PROVEN`;
- warm inference/cache timing: `NOT TESTED`;
- fake successful detection: `NO`;
- explicit failure: `PASS`;
- Render cold start: `NOT TESTED` (deployment prohibited).

The selected input was the tracked synthetic repository face artwork; it was
not transmitted because model preload failed first.

## Verdict

`BLOCKED_PROVIDER`

This is factual acceptance failure for the current local network, not proof
that Render will fail. The next deployment gate must test Render egress and
cold-start memory/latency. If it fails there, a bounded model-bundling change
with reviewed weight checksums will require separate source-remediation
approval.
