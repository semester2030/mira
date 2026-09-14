# AT-4R — Telemetry Off Verification

## Required
`FASHION_KNOWLEDGE_TELEMETRY_ENABLED=false`

## Enforcement
`scripts/at4r-export-qa-env.sh` refuses export if telemetry is `true`.
`scripts/at4r-run-live.sh` forces telemetry false in process env.

## Live confirmation
Pending live run — confirm no FKL telemetry events emitted.
Operational provider cost metrics may remain.
