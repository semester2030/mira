# Ownership Matrix — Perfect-Mask Face Explorer

| Responsibility | Canonical owner | Action | Duplicate count | Verdict |
|---|---|---:|---:|---|
| Perfect API client | `perfect-corp.service.ts` | REUSE | 0 | PASS |
| HD Skin analysis | `PerfectCorpSkinProvider` → `analyzeSkinHdMasks` | EXTEND | 0 | PASS |
| Parser | `perfect-hd-mask.parser.ts` + `mapYouCamResults` | EXTEND | 0 | PASS |
| Mask download | `materialize-hd-masks.ts` | NEW shared helper | 0 | PASS |
| Mask lifecycle | `PerfectMaskSession` | NEW | 0 | PASS |
| Selected metric | `_focusedConcernId` | EXTEND | 0 | PASS |
| Face Explorer UI | `ResultsSkinMapPanel` | REPLACE spatial layer | 0 | PASS |
| Mask renderer | `PerfectMaskOverlay` | NEW shared primitive | 0 | PASS |
| Claim truth | `SkinClaimPolicy` → `PROVIDER_PIXEL_MASK` | EXTEND | 0 | PASS |
| Landmark concern chips | consumer path | DEPRECATED | 0 | PASS |

Forbidden parallel owners (PremiumSkinRepository / FaceExplorerProvider / PerfectMaskService2): **none created**.
