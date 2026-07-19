# Progress Contract

**Version:** `progress-contract-v1`  
**Engine version:** `progress-v1`

## Trends

`improved` · `stable` · `declined` · `unknown`

## Comparability gates

Comparison is allowed only when:

1. A previous analysis exists  
2. Capture quality versions are compatible (`captureVersion` + `qualityVersion`)  
3. Providers are compatible (same family; mock never comparable)

Otherwise:

- `comparable: false`
- `overallTrend: unknown`
- `unavailableReasonAr` / `unavailableReasonEn` set
- No invented metric deltas

## Stable band

Absolute SVI delta ≤ 3 points ⇒ `stable`.
