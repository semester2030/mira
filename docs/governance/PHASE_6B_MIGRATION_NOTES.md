# Migration Notes — Phase 6B

## Entity alias (Architecture Addendum)

- Wardrobe items store `garmentId`.
- Optional `entityClass` defaults to `garment`.
- Future Entity root: treat `garmentId` as `entityId` where `entityClass = garment` — **no 6B rewrite required**.

## Persistence

- 6B ships `WardrobeRepository` / `FashionSessionRepository` with **in-memory** adapters (same foundation pattern as Beauty Session).
- Durable Postgres (Prisma JSON documents) can replace adapters **without** canonical schema changes.

## Non-migrations

- Do not migrate `FashionVisionDocument` into Wardrobe.
- Do not migrate Flutter `CapsuleWardrobeEngine` into server ownership in 6B (client engines remain client until later consume-API work).
- Legacy `OUTFIT_PROVIDER` path untouched.
