# Phase 3B Final — Live vs Candidate

Read-only probe:
`GET https://mira-api-n4p3.onrender.com/api/v1/health`

- result: HTTP 200, `status=ok`, `service=mira-api`;
- live response lacks the Phase 3B `runtimeDependencies` Redis/BlazeFace
  contract;
- live still reports the historical legacy outfit warning;
- candidate HEAD:
  `4b2c78ac42fef38dc0012a35ba6879ae4d6a4a74`;
- deployed SHA remains unproven.

## Comparison

`DIFFERENT`

This is expected because Phase 3B Final did not authorize or perform a
deployment. The probe did not invoke a provider, consume credits, write data or
change Render.
