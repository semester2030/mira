# 5-region Skin Report landmark specification

Builder: `SkinReportRegionBuilder`  
Indices: `SkinReportLandmarkIndices`  
Draw/hit: `toLinearPath()` via `LandmarkAlignedFaceGeometry`

| Region | Arabic | Indices | Construction notes |
|--------|--------|---------|-------------------|
| forehead | الجبهة | browRidge + foreheadTopSupport (partial) | Upper Y = brow + 0.42×(top−brow); side inset 12% face width |
| cheeks_right | الخد الأيمن | rightCheek malar set | Anatomical right (`isLeftSide=false`); below brow, above lip; clear nose midline |
| cheeks_left | الخد الأيسر | leftCheek malar set | Independent loop; excludes under-eye indices |
| nose | الأنف | `MediapipeLandmarkIndices.nose` | 0.88 inset to centroid |
| chin | الذقن | lowerLip + chinArcTight | Upper edge below lip; no temple indices |

Truth: LANDMARK_TEMPLATE / illustrative. FAKE PIXEL PRECISION = 0.
