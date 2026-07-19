# FaceHealthMap ↔ Face Intelligence Relationship (Phase 4.5)

## Decision (canonical)

**C — Sibling outputs.**

```
Skin Analysis (Perfect / mock) ──► Skin Intelligence + FaceHealthMap (skin concerns)
On-device landmarks + pose     ──► Face Intelligence (geometry / shape / styling)
                └── both attach to MiraBeautyReport as separate fields
```

Exactly one relationship is true:

| Option | Verdict |
|--------|---------|
| A) Face Intelligence produces FaceHealthMap | **False** |
| B) FaceHealthMap feeds Face Intelligence | **False** |
| C) They are sibling outputs | **True** |

## Field mapping

| Field | Domain | Schema owner |
|-------|--------|--------------|
| `miraReport.faceHealthMap` | Skin concern spatial / narrative heatmap | Skin / zone mapping |
| `miraReport.faceIntelligence` | Geometry · shape · styling recommendations | Face Intelligence 4A–4E |

## Rules

- Never overload `FaceHealthMap` with Face Intelligence metrics.
- Never write Face Intel ratios/shape into FaceHealthMap overlays.
- UI shows both sections independently when each is enabled/present.
- `LocalFaceMapBuilder` remains a **deprecated offline skin-map fallback** only — not Face Intel.

## Ambiguity removed

Phase 4.5 production wiring does **not** merge these concepts. Integration only populates `faceIntelligence` from the Face Report pipeline; FaceHealthMap continues to come from the skin zone path inside `buildBeautyReport`.
