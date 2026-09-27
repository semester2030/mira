# Physical iPhone acceptance matrix

Device deployed: fayez's iPhone (iPhone 14 Plus, arm64) — `00008110-00191986268BA01E`
Flutter debug install: YES (Xcode build + install succeeded)

| Case | Expected | Result |
|---|---|---|
| A RIGHT TURN | REJECT / NO CAPTURE | PENDING_OWNER_VIDEO |
| B LEFT TURN | REJECT / NO CAPTURE | PENDING_OWNER_VIDEO |
| C HEAD TILT | REJECT when outside CameraKit | PENDING_OWNER_VIDEO |
| D TOO FAR | guidance / NO CAPTURE | PENDING_OWNER_VIDEO |
| E TOO CLOSE | guidance / NO CAPTURE | PENDING_OWNER_VIDEO |
| F POOR LIGHTING | guidance / NO CAPTURE | PENDING_OWNER_VIDEO |
| G STRAIGHT + NORMAL LIGHT | READY → AUTO CAPTURE | PENDING_OWNER_VIDEO |
| H HOLD VALID | one capture only | PENDING_OWNER_VIDEO |
| I AFTER CAPTURE | AUTO ANALYSIS | CODE_WIRED (NewAnalysisScreen) |
| J ANALYSIS SUCCESS | modern Result | CODE_WIRED (existing journey) |

Continuous no-cut video required by task: **NOT CAPTURED in this agent session**
(requires owner face poses in front of unlocked device camera).

PHYSICAL IPHONE CLOSURE = BLOCKED until continuous video evidence is attached.
ARM64 DEPLOY = PASS
