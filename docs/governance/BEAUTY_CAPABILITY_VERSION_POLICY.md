# Beauty Capability Version Policy

**Policy id:** `beauty-cap-semver-v1`  
**Catalog:** v1.0.0 frozen

## Semver for each capability (`version` field)

| Change | Bump | Example |
|--------|------|---------|
| Bugfix / docs / reason text | PATCH | 1.0.0 → 1.0.1 |
| Additive optional params, new mode flag (non-breaking) | MINOR | 1.0.0 → 1.1.0 |
| Remove required field, change id semantics, break DTO | MAJOR | 1.0.0 → 2.0.0 |

## Catalog-level version

`BEAUTY_CAPABILITY_CATALOG_VERSION` bumps when the frozen set of IDs or metadata contract changes.

- **Additive new capability ID** → Catalog MINOR (requires CR)  
- **Deprecate capability** → Catalog MINOR + capability `status=deprecated`  
- **Remove capability** → Catalog MAJOR (after deprecation window)  
- **Rename capability ID** → **FORBIDDEN** (Law #13)

## States

| State | Meaning |
|-------|---------|
| draft | Not in frozen catalog |
| active | Production catalog entry |
| deprecated | Callable but discouraged; prefer replacements |
| removed | Must not execute; id retained historically only after MAJOR |

## Migration

1. File Change Request.  
2. Update catalog JSON + registry tests.  
3. Never invent alias IDs that rename (`eyewear` ≠ `glasses`).  
4. Clients continue using permanent IDs.
