# Phase 3B — BlazeFace Runtime Verification

## Implemented contract

- production lifecycle preloads BlazeFace in `onModuleInit`;
- exact TFHub model source/version and lockfile package version are reported;
- load timeout defaults to 20 seconds and is bounded to 120 seconds;
- model is cached in process memory and disposed on shutdown;
- startup throws on timeout/offline/corrupt load, so the app cannot claim
  production readiness without the detector;
- a request-time load failure maps to explicit safe HTTP 503;
- detector version corrected from `0.0.7` to installed `0.1.0`;
- `/health` reports source, model/package versions, state, strategy, timeout and
  cache policy without credentials.

No model binary, generated weights or large artifact was added.

## Adversarial evidence

`phase3b-blazeface-runtime`: PASS:

- controlled production preload succeeds once and reports `AVAILABLE`;
- offline/corrupt load fails startup and later requests explicitly;
- never-resolving load times out at the configured bound;
- test/non-production startup performs no remote load.

Nest application-context construction also passed. Existing Face operational,
activation and Flutter experience regressions passed.

## Verdict

`PASS — EXPLICITLY BOUNDED STARTUP DEPENDENCY`

This is not an offline/bundled model claim. Actual Render egress, cold-start
latency and memory measurements remain Phase 3C. A reviewed, checksum-pinned
bundle is the preferred future hardening if cold-start evidence fails.
