# Skin Intelligence Report (Phase 3)

## DTO

`SkinIntelligenceReportDto` — versioned, bilingual (AR/EN), no provider payload leakage.

### Metadata (every report)

| Field | Meaning |
|-------|---------|
| `analysisId` | Analysis record id |
| `provider` / `providerVersion` | Adapter identity |
| `formulaVersion` | SVI formula id |
| `captureVersion` | Capture threshold pack |
| `qualityVersion` | Image quality stack |
| `skinVersion` | Canonical skin model |
| `intelligenceVersion` | Intel engine pack |
| `reportVersion` | Report schema |
| `generatedAt` | ISO timestamp |
| `confidence` | Aggregate confidence |
| `limitations` | Explicit limits |
| `language` | `ar+en` |

### Sections

1. Executive summary (AR/EN)
2. Positive findings
3. Priority findings
4. Metric table (each with explanation + provenance)
5. SVI block
6. Recommendations
7. Progress
8. Retake guidance
9. Metadata

## Client

- Entity: `lib/features/intelligence/domain/entities/skin_intelligence_report.dart`
- UI: `SkinIntelligenceSection` on beauty report screen
- Tone: professional cosmetic, positive language, no scary medical framing

## Compatibility

Older stored reports without `skinIntelligence` remain readable; UI section is omitted.
