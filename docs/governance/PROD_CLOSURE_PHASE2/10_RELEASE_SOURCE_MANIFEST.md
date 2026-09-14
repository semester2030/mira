# Phase 2 — Release Source Manifest

## Candidate identity

This is a working-tree candidate, not a commit:

- base HEAD: `dca189cdd42f73d63ac3a4ac3ee00471151c6e98`;
- branch: `cursor/phase2-platform-docs-9309`;
- staged files: `0`;
- runtime/test/config path count: `1,767`;
- sorted path-inventory SHA-256:
  `d692b0e241a8b30d701439762716b9d9c8426466446e1c525ffa4ef3cce9feb9`;
- ordered Git blob-stream identity:
  `8343449ba494d15755fa3418633a86e94a299bc9`.

The hashes deliberately exclude governance/reference docs to avoid a
self-referential manifest. They include tracked and non-ignored untracked
runtime, test, platform, and configuration files.

## Include

- root Flutter/configuration source and dependency locks;
- all reviewed `lib/**` runtime source;
- all 124 tracked `assets/**`;
- required iOS/Android project source and tracked lock/configuration;
- `render.yaml`;
- `mira-api/package*.json`, Nest/TypeScript config, Prisma schema and
  migrations;
- all reviewed `mira-api/src/**`, including untracked Fashion Knowledge,
  production entitlements, Phase 1 security, and closure test harnesses;
- required Nest runtime JSON assets;
- all reviewed tests and approved golden baselines;
- static portal source changed by Phase 1;
- reviewed governance documentation, including Phase 1 and Phase 2.

## Exclude

- `.env*` except reviewed `.example` templates;
- local signing configuration and any credential/signing material;
- dependency directories, Nest `dist`, Flutter/platform build output;
- `.dart_tool`, caches, virtual environments, logs, `.DS_Store`;
- `test/face_analysis_experience/failures/**`;
- `mira-api/scripts/lan-forward.py`;
- external audit ZIP binaries.

## Migration state

No Phase 2 Prisma schema or migration change exists. Render's start command
still performs `prisma migrate deploy`.

## Manifest status

`EXACT WORKING-TREE CANDIDATE ACCOUNTED / NOT COMMITTED`

The candidate can be re-hashed locally. It cannot yet be obtained from Git by
another machine because 342 production files remain untracked pending
owner-approved commit.
