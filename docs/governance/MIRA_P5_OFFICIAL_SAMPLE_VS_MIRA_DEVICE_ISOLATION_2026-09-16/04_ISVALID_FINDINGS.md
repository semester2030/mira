# 04 — ISVALID FINDINGS

| Fact | Evidence |
|---|---|
| Official header text | “Indicating if the information is valid.” (`PFCameraKitData.h`) — no capture semantics |
| Official sample `canCapture` | uses only lighting/area/pose `.isOk` — **does not use `isValid`** |
| Sample runtime | canCapture=1 with **isValid=0** (65× normal + 18× good); capture SUCCESS with isValid=0 |
| Mira runtime | ready=1 with isValid=0 (4×); isValid never 1 in 675 events |

## Distinction (required)

- **Proven:** sample does not require `isValid` for acceptance; field stays false even when capture succeeds.
- **Not proven:** that `isValid` is meaningless or safe to ignore for all Perfect APIs beyond this capture gate.
- Do not infer “field unused in sample ⇒ field unused by SDK.”
