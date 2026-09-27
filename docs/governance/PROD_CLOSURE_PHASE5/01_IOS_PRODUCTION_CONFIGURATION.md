# Phase 5 — iOS Production Configuration

Inspected Flutter/iOS source at `d6a316be6aabaee8123d94584866d23e3cfd5187`.

| Item | Value |
|---|---|
| Flutter/app version | `1.0.0` (`pubspec.yaml`) |
| Build number | `1` |
| Bundle identifier | `app.mira.beauty` |
| Default API base URL | `https://mira-api-n4p3.onrender.com/api/v1` |
| `USE_MIRA_API` default | `true` |
| Firebase project | `mirra-14b0e` |
| `MIRA_FASHION_ADVISOR_V1` default | `false` |
| Face capture/motion/result dart-defines | default `false` |
| Local entitlement QA override | release-inert (`kReleaseMode` blocks it) |

## Production-path proof from source (not from an installed binary)

- No localhost/staging default API.
- Signed-in Skin and Fashion use backend when `useBackend` is true.
- Fashion backend path throws if backend is off (no production outfit mock).
- Guest Skin still has a local mock path — Phase 5 must use a signed-in
  technical identity, never guest analysis.

## Not yet proven

The currently installed iPhone binary (if any) is **not** proven to match
this SHA or these dart-defines. Devices are offline. A later owner action
will install/run the intended build.

`IOS_PRODUCTION_CONFIGURATION` for an installed device binary: **NOT PROVEN**
Source-intended production defaults: **RECORDED**
