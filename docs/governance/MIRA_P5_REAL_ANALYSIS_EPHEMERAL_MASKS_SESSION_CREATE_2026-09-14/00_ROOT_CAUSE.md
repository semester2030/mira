# ROOT CAUSE — Real analysis ephemeralMasks missing on deployed API

## Proven
Physical iPhone HUD after lifecycle fixes still:
`NO_SESSION bytes=0` for pore / oiliness / moisture / dark_circle.

## Real iPhone endpoint (Flutter production)
`POST {MiraApiConfig.baseUrl}/ai/skin-analysis`
= `POST https://mira-api-n4p3.onrender.com/api/v1/ai/skin-analysis`

NOT `/ai/skin-analysis-hd-masks` (technical acceptance only).

## Breakpoint
**BACKEND_RESPONSE / EPHEMERAL_MASKS**

`origin/main` (what Render deploys) Perfect Corp skin path returns **scores only**.
It does **not** include `ephemeralMasks` on the Skin analysis DTO.

Local surgical path (this task) wires the **same** `/ai/skin-analysis` to:
ONE Perfect HD task → materialize → `ephemeralMasks` → Flutter `PerfectMaskSession.fromApiPayload`.

## Evidence vs main
| Artifact | origin/main | Local surgical fix |
|---|---|---|
| `analyzeHdVariant` / `materializeHdMaskArtifacts` | ABSENT | PRESENT |
| `SkinAnalysisResponseDto.ephemeralMasks` | ABSENT | PRESENT |
| Flutter parse → `setPerfectMasks` | present (null input) | + always-on `MASK_SESSION_CREATE` proof |

## Forbidden paths not used
- Second Perfect analysis for masks = NO
- Parallel Perfect client = NO
- UI / ColorFilter / Apple Matte changes = NO
