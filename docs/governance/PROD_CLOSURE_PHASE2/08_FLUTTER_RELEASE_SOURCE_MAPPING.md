# Phase 2 — Flutter Release Source Mapping

## Release input

iOS and Android builds consume the repository root Flutter project:

- Dart source: `lib/**`;
- dependency source/lock: `pubspec.yaml`, `pubspec.lock`;
- declared assets/fonts: `assets/**`;
- platform configuration: `ios/**`, `android/**`;
- generated Firebase client options: `lib/firebase_options.dart` plus platform
  client configuration;
- compile-time values supplied through `--dart-define`.

Ignored `build/**`, `.dart_tool/**`, local signing configuration, and caches are
not release source.

## API/runtime configuration

- `USE_MIRA_API` defaults to `true`.
- `MIRA_API_BASE_URL` defaults to
  `https://mira-api-n4p3.onrender.com/api/v1`.
- Production provider secrets do not enter Flutter.
- Runtime entitlement snapshots are loaded from the backend and cleared on
  logout/invalid load.

## Activation defaults

| Capability | Compile-time default | Runtime requirement |
|---|---:|---|
| Fashion Advisor | OFF | `fashionAdvisorModeB` entitlement also required |
| Face Capture Mirror | OFF | `faceExperienceV1` also required |
| Face Analysis Motion | OFF | `faceExperienceV1` also required |
| Face Result Mirror | OFF | `faceExperienceV1` also required |
| subscriptions | OFF | backend controls still apply |
| StoreKit/IAP | OFF | no production purchase path |
| packages | OFF | local credit UI hidden |
| marketplace | OFF | hidden |

The current repository does not encode release dart-defines that turn these
flags on. A release built without explicit defines stays fail-closed.

## Debug-only behavior

- dev premium UI/API calls are gated by `kDebugMode`;
- backend independently rejects dev premium in production;
- debug analytics/log surfaces do not constitute production telemetry.

## Platform release gaps

- Android `release` currently uses the debug signing configuration. This is
  not acceptable as a Play release identity.
- iOS release signing depends on ignored
  `ios/Flutter/Signing.xcconfig.local`; signing identity is intentionally
  machine/owner controlled.
- There is no checked-in release build script that pins the production
  dart-define matrix.
- CI runs analysis/tests but does not build iOS or Android release artifacts.
- generated `Generated.xcconfig`, Android `local.properties`, plugin
  registrants, Pods, and build directories are machine-generated and excluded.

## Runtime refresh caveat

Runtime entitlements refresh on the authenticated splash path. A direct login
navigation does not independently refresh them, so Face/Fashion stay
fail-closed until splash/manual refresh. This is safe but remains release-flow
debt.

## Source-identity consequence

Flutter currently imports untracked Face, Results, Entitlement, Advisor, and
canonical Fashion files. Local builds can succeed, but a clean checkout at
HEAD cannot reproduce this tree until those files are committed.

Asset integrity is separately verified in
`09_ASSET_INTEGRITY_VERIFICATION.md`.
