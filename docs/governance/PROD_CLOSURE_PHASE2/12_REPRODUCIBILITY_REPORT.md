# Phase 2 — Reproducibility Report

## Verdict

`PARTIALLY_REPRODUCIBLE`

## Proven locally

- dependency locks were unchanged by `npm ci` and `flutter pub get`;
- Prisma Client regenerates from the committed schema;
- Nest output regenerates and the backend builds/types successfully;
- Flutter dependencies resolve and targeted suites pass;
- all declared assets are tracked;
- no runtime source is hidden by ignore rules;
- runtime/test/config candidate is inventoried and content-hashed.

## Current clean-machine blocker

A clean machine checking out
`dca189cdd42f73d63ac3a4ac3ee00471151c6e98` does not receive:

- 342 production-critical untracked files;
- untracked Phase 1 tests and governance;
- 47 tracked-file modifications.

Therefore HEAD does not reproduce the tested working tree.

## Machine-local dependencies excluded

- `.env` and production secrets;
- signing configuration;
- caches, virtual environments, dependencies, and build output;
- local LAN-forward helper;
- failed-golden artifacts;
- Desktop audit package.

Production secrets are expected deployment inputs, not source. Their values are
not required to reproduce compilation.

## Closure condition

After explicit owner-approved staging, commit, fresh checkout, dependency
restore, asset verification, and rerun of the documented gates, the candidate
can be promoted to `REPRODUCIBLE`.

Until that commit/clean-checkout proof:

`REPRODUCIBILITY = PARTIAL`
