# QA-1 — Real iPhone Bootstrap Status

**Date:** 2026-08-11  
**Mode:** Discover / Configure / Build / Run · NO production flag changes · NO silent fixes  
**Live phase:** **F01 ONLY** (awaiting human interaction)

## Machine
| Item | Actual |
|---|---|
| macOS | 26.4.1 |
| Flutter | 3.38.9 stable |
| Dart | 3.10.8 |
| Xcode | 26.6 (17F113) |
| CocoaPods | 1.16.2 |
| Doctor | Android adb noise only; iOS tooling OK |

## Physical iPhone
**PHYSICAL_IPHONE_DETECTED**

| Item | Value |
|---|---|
| Name | fayez’s iPhone |
| Connection | USB mobile |
| iOS | 26.6 |
| Simulator used as success? | **NO** |

Device UDID omitted from governance per privacy rule.

## Signing / permissions
| Item | Status |
|---|---|
| DEVELOPMENT_TEAM | A97F7227YM |
| Bundle ID | app.mira.beauty |
| CODE_SIGN | iPhone Developer / Automatic |
| NSCameraUsageDescription | Present |
| NSPhotoLibraryUsageDescription | Present |

## Source / freeze identity
| Item | Status |
|---|---|
| Branch | `cursor/phase2-platform-docs-9309` |
| HEAD | `dca189c` |
| Face package | **UNTRACKED** (`lib/features/face_analysis_experience/`) — AD-FACE-05 residual |
| Face version pin | `1.0.0` / `1.0.0-face-analysis-experience` / `MIRA-FACE-EXPERIENCE-FREEZE-1.0.0` present |
| Fashion freeze | `1.0.0-fashion-knowledge` / `MIRA-FK-FREEZE-1.0.0` (governance) |
| SOURCE IDENTITY | **WORKING_TREE_QA** — testing working-tree Face Experience matching freeze pins; not a tagged release commit |

## Backend environments
| Target | Status | Notes |
|---|---|---|
| PRODUCTION Render | **NOT_AVAILABLE** | HTTP 503 **Service Suspended** |
| LOCAL mira-api | **PARTIAL** | DB + Perfect Corp key present; Firebase project empty; LLM keys missing |
| QA/STAGING dedicated | **NOT_AVAILABLE** | no `.env.qa` |

## Face QA build (current session — relaunched)
| Flag | This DEBUG session | Source default |
|---|---|---|
| MIRA_FACE_CAPTURE_MIRROR_V1 | true (dart-define) | false |
| MIRA_FACE_ANALYSIS_MOTION_V1 | true (dart-define) | false |
| MIRA_FACE_RESULT_MIRROR_V1 | true (dart-define) | false |
| USE_MIRA_API | true | true |
| API URL | production HTTPS default | currently suspended |

### Launch evidence (restart after DEBUG_SESSION_INTERRUPTED)
- Auto signing OK (team A97F7227YM)
- Xcode build done (~15.4s incremental)
- Installing and launching (~253.3s; VM service delayed then recovered — QA1-ENV-02)
- Syncing files to device fayez’s iPhone
- **BUILD SUCCESS · INSTALL SUCCESS · APP LAUNCHED**
- Flutter run key commands + Dart VM Service attached
- Prior background disconnect = **DEBUG_SESSION_INTERRUPTED**, not crash

## Fashion readiness
| Item | Status |
|---|---|
| Nest `FASHION_KNOWLEDGE_LLM_PORT` | Registered (OpenAI adapter) |
| Local LLM API key | **MISSING** |
| Backend Fashion flags | Not in local `.env` (default OFF) |
| Client `MIRA_FASHION_ADVISOR_V1` | default false; **not enabled** |
| Decision | **FASHION LIVE QA BLOCKED BY ENVIRONMENT** |

## Defects logged (no code fixes in QA-1)
| ID | Class | Severity | Note |
|---|---|---|---|
| QA1-ENV-01 | ENVIRONMENT | BLOCKER (server E2E) | Production API Service Suspended |
| QA1-ENV-02 | ENVIRONMENT | MINOR (debug) | Dart VM Service delayed then attached; background may interrupt session |
| QA1-ENV-03 | ENVIRONMENT | MAJOR (fashion) | Fashion Mode B blocked — missing LLM keys / no QA backend |
| QA1-SRC-01 | ENVIRONMENT | OBSERVATION | Face Experience uncommitted (AD-FACE-05) |
| QA1-RT-01 | RUNTIME | MAJOR | `LiveFaceOverlayController` used after dispose (`live_face_overlay_controller.dart:115`) during live session; unhandled exception — not fixed in QA-1 |
| QA1-ENV-04 | ENVIRONMENT | MAJOR (debug attach) | Wireless-only iPhone: `flutter run` failed to attach VM Service / Error launching; need USB + unlocked foreground for F01 |

### Session notes
- Prior attach ended: **DEBUG_SESSION_INTERRUPTED** (iOS terminated debug connection for background inactivity). Flutter explicitly: "There are no errors with your Flutter application." Not classified as crash.
- Relaunch attempt: build OK, then **Error launching application on fayez’s iPhone (wireless)** after ~618s (VM Service never discovered). Device currently **wireless-only** — USB not detected. F01 still pending.

## Human actions — F01 ONLY
1. Keep iPhone **unlocked**, Mira **in foreground**, debug session alive.
2. Run **F01 NORMAL IDEAL CAPTURE** only (do not start F02).
3. If camera/motion looks wrong visually even if logs look OK: screenshot or record video.
4. Unsuspend Render **or** provide safe local/QA API (without changing production Fashion flags) for analysis/Ask Mira/history proof.
5. Server analysis / Ask Mira / history remain blocked while API is suspended (capture UI can still be observed).

## Next
Await F01 completion from human. Do not start F02 until F01 recorded. Do not enable Fashion on production. Do not silently fix defects.
