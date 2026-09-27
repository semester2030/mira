# MIRA-IOS-STARTUP-CRASH-AFTER-MATTING-POC-2026-09-13

## STATUS: PASS (startup restored)

## Root cause (exact, from device)
Home-screen launch of a **DEBUG** install (`Runner.debug.dylib`) without Flutter tooling / Xcode.

### Device console
```
Cannot create a FlutterEngine instance in debug mode without Flutter tooling or Xcode.
...
Alternatively profile and release mode apps can be launched from the home screen.
App terminated due to signal 11.
```

### IPS (Runner-2026-09-13-185004.ips)
- Exception: `EXC_BAD_ACCESS` / `SIGSEGV` / `KERN_INVALID_ADDRESS at 0x0`
- Termination: `SIGNAL` / `Segmentation fault: 11`
- First failing frames:
  1. `libswiftCore.dylib :: swift_getObjectType`
  2. `camera_avfoundation :: static CameraPlugin.register(with:)`
  3. `GeneratedPluginRegistrant registerWithRegistry:`
  4. `AppDelegate.application(_:didFinishLaunchingWithOptions:)`

### Classification
| Field | Value |
|---|---|
| CRASH STAGE | PLUGIN REGISTRATION |
| BEFORE FIRST FLUTTER FRAME | YES |
| APPLE POC CAUSED CRASH | NO |
| Vision frames in stack | NONE |

Crash happens inside stock `GeneratedPluginRegistrant` → Camera plugin while Debug FlutterEngine cannot be created. Apple matting channel registration was **after** this call and never reached on failing launches.

## Surgical fix
1. Reinstall **profile** build (home-screen capable).
2. Defer Apple MethodChannel registration to `DispatchQueue.main.async` **after** `super.application(...)` — channel only, **no** `VNGeneratePersonSegmentationRequest` until POC screen calls it.

## Launch matrix (profile, physical iPhone)
- COLD: 3/3 PASS
- WARM: 3/3 PASS
- RESUME/activate: 3/3 PASS
- WHITE SCREEN crashes: 0
- STARTUP CRASH: 0
- Profile console shows Flutter/MediaPipe init + `ApplePersonMattingChannel registered (post-launch, lazy Vision)` — no Debug-engine fatal.

## POC isolation
- NORMAL STARTUP ≠ Apple matting execution
- Vision person segmentation runs only when internal POC is opened
- Channel register ≠ Vision request

## Analyze
`flutter analyze` on POC-touched Dart paths: **No issues found** (0 errors / 0 warnings / 0 infos)
