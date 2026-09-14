# Phase 2 — Deployment Source Mapping

## Blueprint source

`render.yaml` defines four services. The production backend is:

- service: `mira-api`;
- runtime: Node;
- repository root: `mira-api`;
- build:
  `NPM_CONFIG_PRODUCTION=false npm install && npx prisma generate && npm run build`;
- start: `npx prisma migrate deploy && npm run start:prod`;
- health: `/api/v1/health`;
- API prefix: `api/v1`.

Static portal roots are `partners-portal/web`, `admin-portal/web`, and
`website`.

## Backend artifact

`nest build` compiles `mira-api/src/**` under `sourceRoot=src`.
`tsconfig.build.json` excludes dependency output, `dist`, `test`, and
`**/*spec.ts`. Nest copies declared runtime assets:

- Vision QEL fixtures;
- Beauty capability JSON;
- Fashion Knowledge assets.

`dist/**` is generated and ignored. Prisma Client is generated during build;
database migrations run before application start.

## Phase 1 / entitlement inclusion

- `AppModule` imports `ProductionEntitlementModule`.
- Production entitlement source therefore enters the artifact when the
  untracked directory is committed.
- Fashion canonical endpoint/controller and Phase 1 integrity/Commerce changes
  are under compiled `src/**`.
- schema-test files under `src/**` currently compile into `dist`; they are not
  runtime imports and execute only when explicitly invoked.

## Exclusions and risk

Render obtains repository content, not this local working tree. The current
untracked production directories cannot enter a Git-triggered clean deploy
until committed.

The Blueprint does not encode a deploy branch or commit. Render workspace
metadata could not be authenticated read-only in this session, so the actual
service's deploy commit is not proven from Render metadata.

## Live read-only evidence

On 2026-08-30:

- `GET https://mira-api-n4p3.onrender.com/api/v1/health` returned HTTP 200.
- The response proves a live `mira-api`, Perfect Corp configuration presence,
  frozen Face metadata, and disabled Fashion provider execution.
- `GET /api/v1/entitlements/runtime` returned HTTP 404.
- The health payload exposes no Git SHA/version identity.

Conclusion: deployment mechanics are known; live deployment source identity is
not.
