# Beauty Experience — Engineering Laws

1. **Provider ≠ Capability** — Flutter requests capability ids only.  
2. **One capability → many providers** — matrix + priority; no single-vendor capability.  
3. **Capability → Policy → Provider Manager → Canonical DTO** — never skip policy.  
4. **Provider never owns session** — Mira `BeautySessionStore` only.  
5. **Vendor output never reaches Flutter** — adapters map to canonical DTOs; public DTOs strip provider ids.  
6. **Adapters: auth / call / map / errors only** — no business logic.  
7. **Capability never owns data** — session owns attempts/looks/history.  
8. **Every provider replaceable in one sprint without Flutter changes.**

Face Intelligence and Skin Intelligence remain frozen and untouched.
