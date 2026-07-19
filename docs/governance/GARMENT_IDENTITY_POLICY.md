# Garment Identity Policy (Phase 6C.1)

**Version:** `garment-identity-v1`

## Rule

`CanonicalGarment.garmentId` is **content-addressed** and **deterministic**.

Same Vision observation evidence ⇒ same `garmentId`.

## Forbidden

- `Date.now()`
- `Math.random()`
- UUID / `newTraceId` for garment identity

## Formula

```
sha256(
  mappingVersion |
  schemaVersion |
  garment-identity-v1 |
  slot |
  categoryId |
  typeId |
  sorted(colors) |
  material |
  fit |
  segmentId
)[0..24] → garm_<hex>
```

`slot` is a stable observation index key (`g0`, `g1`, … garments; `a0`, … accessories) after robust pairing.

## Wardrobe

Wardrobe stores `garmentId` refs only. Remapping the same evidence yields the same ref.

## Timestamps

Pure mapping uses epoch `1970-01-01T00:00:00.000Z` so Canonical bodies are comparable without wall-clock noise. Live session attach may record separate event times in Session history (out of garment identity).
