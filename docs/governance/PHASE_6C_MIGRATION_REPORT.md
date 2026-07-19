# Migration Report — Phase 6C

## Adapter bridge

`VisionFashionAdapter` now maps vision documents through `GarmentMappingEngine` into port `DetectedGarment[]` (bridge). Fixes historical top-level `resolvedGarments` miss by reading `fusion.resolvedGarments`.

## ID policy

| Space | Role |
|-------|------|
| `CanonicalGarment.garmentId` | Mira-stable id for Wardrobe refs |
| `identity.typeId` / `categoryId` | Taxonomy |
| `identity.catalogPieceId` | Optional catalog link |

## Non-migrations

- Wardrobe / Session / Runtime models unchanged  
- Flutter capsule engines unchanged  
- No FashionVisionDocument stored in Wardrobe  
- Provider SDKs unchanged  
