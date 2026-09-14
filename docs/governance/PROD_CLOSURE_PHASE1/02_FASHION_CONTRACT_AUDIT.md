# Phase 1 — Fashion Contract Audit

## Current-source finding

The request contract was aligned. The response contract was not.

Canonical backend response:

```text
POST /api/v1/ai/vision/outfit/analyze
garments: CanonicalGarment[]
analysis: object|null
warnings: string[]
limitations: string[]
runtime: CanonicalFashionRuntime
meta.analysisGate: proceed|degraded|blocked
meta.confidence: number
```

The pre-closure Flutter client parsed `fashionVision` and read its
`analysisGate`. Because the backend intentionally does not expose the internal
`FashionVisionDocument`, the client created an empty blocked document and
stopped before scoring.

## Field comparison

| Flutter before | Backend canonical | Status |
|---|---|---|
| `fashionVision` | not public | LEGACY / MISMATCH |
| ignored | `garments` | SERVER_ONLY / MISMATCH |
| `fashionVision.analysisGate` | `meta.analysisGate` | MISMATCH |
| `fashionVision.fusion.overallConfidence` | `meta.confidence` | MISMATCH |
| `analysis` | `analysis` | MATCH |
| `meta.userMessageAr` | `meta.userMessageAr` | MATCH |
| ignored | `warnings`, `limitations`, `runtime` | SERVER_ONLY |

Request fields `image`, `occasionId`, `mode`, optional JSON `skinSnapshot`, and
`locale` are aligned.

## Remediation

- Flutter now parses `garments` and canonical `meta`.
- A bounded `CanonicalGarment` client projection and
  `CanonicalGarmentToEngineAdapter` feed the existing deterministic engine.
- Non-blocked responses with no garments fail closed.
- Legacy `fashionVision` wire responses fail closed.
- No backend HTTP shape, Garment Intelligence engine, or frozen schema changed.

## Compatibility

The internal `FashionVisionDocument` remains an internal/local model only. It
is no longer a competing HTTP response contract. Reintroducing it on the wire
would violate ADR-GI-001 and the GI v1.0.0 freeze.

## Verification

Focused Flutter tests cover:

- canonical JSON deserialization;
- `meta.analysisGate` and confidence propagation;
- canonical garment-to-engine projection;
- rejection of legacy and malformed response shapes;
- service analysis using canonical garments.
