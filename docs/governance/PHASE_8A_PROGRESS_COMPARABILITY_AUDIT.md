# PHASE 8A — Progress Comparability Audit

## Current builder
`LocalProgressBuilder.fromReports`:
- Sorts by createdAt  
- Needs ≥2 scans for trends  
- Compares overallBeautyScore + selected concerns  
- Projects 30-day score from timeline  
- Arabic copy includes English **Trends** when needsMoreScans  

## Missing gates
Lighting, camera, model version, metric version, interval minimum, confidence floor — **not enforced** in presentation builder.

## Progress Comparability Contract (proposal)
Show improvement/decline only if:
1. ≥2 comparable analyses  
2. Same metric/score semantics version  
3. Capture quality both ≥ threshold  
4. Time interval within policy window  
5. Confidence both ≥ threshold  
Else: «قارني بعد تحليل إضافي» / hide deltas / never fabricate.

Projection must use scoreType=`projection` visual language.
