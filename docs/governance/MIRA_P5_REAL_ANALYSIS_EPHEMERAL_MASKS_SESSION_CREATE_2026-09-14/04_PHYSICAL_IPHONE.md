# Physical iPhone

Device: `00008110-00191986268BA01E`

## Before API deploy (proven)
HUD: `NO_SESSION bytes=0`
Create proof after Flutter instrumentation expects:
`CREATE skipped=ephemeralMasks_missing_from_response` when talking to **main**/old Render.

## After API deploy (required gate)
Fresh signed-in Skin analysis → Face Explorer → المسام:
- `CREATE raw=<N> bytesKeys=<N> session=YES`
- `SESSION_READY bytes>0`

Until Render serves the surgical `/ai/skin-analysis` response:
**PHYSICAL IPHONE = BLOCKED** (cannot invent masks on device).
