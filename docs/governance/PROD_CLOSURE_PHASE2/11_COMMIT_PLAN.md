# Phase 2 — Owner-Approval Commit Plan

## Status

`COMMIT REQUIRED — AWAITING OWNER APPROVAL`

No file is staged and no commit was created.

## Proposed reviewed series

Because the candidate contains 47 tracked modifications and 1,940 baseline
untracked files, a blind single commit is not reviewable. Prepare an explicit
series whose final tip becomes the release source identity:

1. `feat: preserve the frozen Face, Results, Fashion, and Advisor runtime`
   - production Dart/TypeScript and required runtime assets/config;
   - Render/Nest/Flutter platform configuration;
   - Phase 1 production remediation.
2. `test: preserve closure and frozen-contract verification`
   - test source and approved golden baselines;
   - excludes generated `failures/**`.
3. `docs: record product architecture and closure evidence`
   - reviewed governance/reference documents;
   - Phase 1 and Phase 2 source-identity evidence.

The final commit SHA after the reviewed series, not the current base HEAD, is
the production-candidate identity.

## Explicit include groups

Use path allowlists from `10_RELEASE_SOURCE_MANIFEST.md`. Review `git diff
--cached` after each group. Never use `git add .` or `git add -A`.

## Explicit exclusions

- ignored secrets and local signing;
- `.env`;
- build/dependency/generated cache output;
- failed-golden output;
- local LAN-forward helper;
- audit ZIP artifacts.

## Approval boundary

Owner approval must identify whether to:

- create the reviewed commit series as proposed; or
- revise grouping/message/scope first.

Until then:

`AWAITING_OWNER_COMMIT_APPROVAL`
