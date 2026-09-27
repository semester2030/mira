# Phase 5 — Physical iPhone identity and launch attempt

Task: `MIRA-P5-PHYSICAL-IPHONE-E2E-2026-08-31`

Mac-detected USB device (no serial/UDID recorded):

- Device name: `fayez’s iPhone`
- Model: iPhone 14 Plus
- iOS: 26.6
- Connection: USB (not simulator; not wireless-only)

## Install/run

`flutter run` on that device with production dart-defines:

- `USE_MIRA_API=true`
- `MIRA_API_BASE_URL=https://mira-api-n4p3.onrender.com/api/v1`
- Fashion Advisor + Face experience client inclusion flags true
  (server masters remain OFF until a later canary)

First attempt failed: Mac disk full (`No space left on device`). Build
caches were reclaimed (not source). Retry: Xcode build succeeded; app
installed; `Runner` process was observed running on the device.

Flutter debug VM attach timed out. Visible cold-launch UX is **not**
proven without owner observation.

`PHYSICAL_IPHONE = PROVEN` (Mac USB detection)
`IOS_PRODUCTION_CONFIGURATION` of this launch command = recorded production
`APP_COLD_LAUNCH = NOT RUN` pending owner screen evidence
