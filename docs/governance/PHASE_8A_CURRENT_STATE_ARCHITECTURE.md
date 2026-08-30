# PHASE 8A — Current-State Architecture Map

```mermaid
flowchart TB
  CAM[Capture] --> Q[Quality] --> API[Analyze] --> CR[SkinReport]
  CR --> SI[Skin Intelligence Frozen]
  CR --> FI[Face Intelligence Frozen]
  CR --> MBR[Local MiraBeauty builders]
  SI --> UI[MiraBeautyReportScreen]
  FI --> UI
  MBR --> UI
  UI --> ROUT[Skin Routine]
  UI --> PROG[Progress]
  UI --> ADV[Advisor]
```

## Structural defects
1. No Result Projection Layer — UI binds intelligence + local builders directly.  
2. Single scroll mixes IA categories A–J.  
3. Multiple priority sources (Skin, Journey, Concerns).  
4. Map is illustrative association (`ReportFaceMapSpec`), not pixel evidence.  
5. Advisor entry at end of fatigue path.
