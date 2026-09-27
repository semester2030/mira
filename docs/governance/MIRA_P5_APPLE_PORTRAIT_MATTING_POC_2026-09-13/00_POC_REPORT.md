# MIRA-P5-APPLE-PORTRAIT-MATTING-POC-2026-09-13

## STATUS
**BLOCKED** — POC installed and runnable on physical iPhone; **owner visual judgment required** for hair / halo / Beauty-grade pass. No production integration.

## Apple API
- `VNGeneratePersonSegmentationRequest`
- `qualityLevel = .accurate`
- `outputPixelFormat = kCVPixelFormatType_OneComponent8`
- On-device only (Vision). No Perfect SOD. No cloud.

## POC files (temporary / isolated)
| Path | Role |
|---|---|
| `ios/Runner/ApplePersonMattingChannel.swift` | MethodChannel `mira/apple_person_matting` |
| `ios/Runner/AppDelegate.swift` | Channel registration only |
| `lib/.../poc/apple_person_matting_poc_bridge.dart` | Thin Dart bridge (not a service owner) |
| `lib/.../poc/apple_portrait_matting_poc_screen.dart` | Internal 4-mode viewer |
| `lib/core/navigation/app_routes.dart` | `/dev/apple-portrait-matting-poc` |
| `lib/main.dart` | Route wire |
| `lib/.../skin_interactive_report_screen.dart` | Temporary entry: **POC Apple Matte (داخلي)** after Skin analysis |

## Modes
1. ORIGINAL  
2. APPLE MATTE (grayscale alpha as returned / upsampled — no fake feather paint)  
3. BLACK BACKGROUND (`#000000` hard composite)  
4. BLACK + PERFECT MASK (existing `AnalysisSession.lastPerfectMasks` — no new Perfect call)

## Alignment contract
- Same ephemeral capture path used for Skin / Perfect HD.
- Matte upsampled to oriented source `W×H`.
- No manual X/Y offset (`MANUAL_OFFSET = 0`).
- No face warp after Perfect analysis.
- On-screen metrics report `dimsMatch` for source / matte / black / Perfect mask decoded sizes.

## Post-process policy
- Hard alpha×RGB over black only.
- **No** hair reconstruction, oval crop, geometric clip, or aggressive feathering to hide defects.

## How to review on iPhone
1. Open installed `app.mira.beauty`.
2. Run a real Skin analysis (same flow as today).
3. On Skin report, tap **POC Apple Matte (داخلي)**.
4. Switch: ORIGINAL → APPLE MATTE → BLACK BG → BLACK + PERFECT.
5. Pinch-zoom hair / ears / jaw / chin.
6. Read metrics bar: processing ms, dimensions, halo/leak probes.
7. Owner records one continuous video (not stored in this ZIP).

## Physical iPhone
- Device: fayez’s iPhone `00008110-00191986268BA01E`
- Install: `xcrun devicectl device install app` → **PASS**
- Launch: `app.mira.beauty` → **PASS**
- Wireless `flutter run` VM discovery was flaky; install via build + `devicectl` used.

## Measured values
| Field | Value |
|---|---|
| INPUT / MATTE / OUTPUT dims | **Shown on POC metrics bar after owner opens POC** (not captured here — no private face export) |
| PROCESSING TIME | **Shown on POC metrics bar** (`processingMs` from native) |
| HALO_RING_MEAN / BG_LEAK_% | On-device probes (soft-band luminance / non-black in alpha≈0) — advisory only |
| MANUAL OFFSET | `0` |

## Pass / fail (owner gates)
PASS only if Beauty-grade on pure black with curly/fine hair preserved, no obvious halo, no sofa leak, Perfect mask pixel-aligned.  
If hair FAIL or halo VISIBLE → **do not patch Apple** → next POC = **Perfect SOD**.

## Production
- **NOT STARTED**
- Perfect API / parser / capture: **unchanged**
- No new production service / repository / state owner

## Recommendation (pending owner eyes)
- If owner PASS → prefer **APPLE** for presentation matte.
- If owner FAIL hair/halo → **TEST PERFECT SOD** next (no Apple production integrate).
