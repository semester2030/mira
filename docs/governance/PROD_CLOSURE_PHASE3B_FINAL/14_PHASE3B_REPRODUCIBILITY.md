# Phase 3B Final — Reproducibility

## Inputs

- exact source: `4b2c78ac42fef38dc0012a35ba6879ae4d6a4a74`
- normal Git worktree checkout
- repository lockfiles
- `npm ci`, Prisma generate, normal Nest build
- `flutter pub get`, normal analyzer/test commands
- documented environment contract; local emulator config for rules proof

## Independence checks

The verified result did not depend on untracked/ignored production source,
Desktop files, absolute source paths, manually copied model weights, local-only
provider adapters, machine cache, production secrets or uncommitted runtime
configuration. The BlazeFace contract intentionally uses its documented,
versioned TFHub source at production startup; adversarial tests replace the
loader locally and do not make a provider request.

The clean checkout stayed source-clean after all verification.

## Verdict

`PASS — NEW_HEAD ALONE REPRODUCES PHASE 3B SOURCE SAFETY`
