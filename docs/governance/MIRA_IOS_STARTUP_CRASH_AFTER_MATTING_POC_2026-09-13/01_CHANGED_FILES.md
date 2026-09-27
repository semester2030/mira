# Changed files / exact fix

## Diff intent
1. AppDelegate: remove mid-bootstrap `registrar(forPlugin:)` Apple channel register.
2. AppDelegate: register Apple MethodChannel post-`super.application`, async on main — no Vision request.
3. Install flavor: DEBUG (home-screen illegal on iOS 14+) → PROFILE (home-screen OK).

## Files
- ios/Runner/AppDelegate.swift — surgical register timing
- ios/Runner/ApplePersonMattingChannel.swift — unchanged behavior (on-demand process only)
- POC Dart files — info lint cleanup only (string interpolation)

## Not changed
- Perfect API/parser
- Capture
- Architecture / new services
- camera_avfoundation itself (not guilty beyond Debug-engine precondition)
