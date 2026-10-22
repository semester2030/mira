# RC10 Outfit Recovery — verification run

- **Release id:** CONSULT_DIALOGUE_RC10
- **Verified at:** 2026-10-22
- **API:** https://mira-api-n4p3.onrender.com
- **Deploy:** dep-dbcmckss728c73aof56g (commit 207871b) LIVE
- **Prior failed:** dep-dbcmafjbc2fs738k3k0g (ba5e34b) build_failed TS2367

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| RC10 schema tests | 12/12 | `audit-out/rc10-outfit-recovery/rc10-schema-tests.txt` |
| RC9 schema tests | 4/4 | `audit-out/rc10-outfit-recovery/rc9-schema-tests.txt` |
| Flutter color retention | 4/4 | flutter test |
| Redis health LIVE | AVAILABLE | `audit-out/rc10-outfit-recovery/health-after-rc10.json` |
| Device install RC10 | restored via `flutter run --release` | `flutter-run-release.txt` |
| Live dress journey | NOT_RUN | no account photos this round |
| Scope live bird→shoe | NOT_RUN | awaiting authenticated session |

## Notes

- `flutter install` uninstalled then failed codesign; local app data may have been lost.
- Outfit camera capture remains paused (`MIRA_OUTFIT_CAMERA_CAPTURE`).
- No secrets or personal photos in evidence.
