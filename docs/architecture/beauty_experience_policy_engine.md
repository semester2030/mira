# Capability Policy Engine

**Version:** `beauty-policy-v1`

Runs **before** Provider Manager. On failure → canonical `BLOCKED_BY_POLICY` — **never** call a provider.

## Rules (order)

1. Feature flag (`BEAUTY_EXPERIENCE_ENABLED`)  
2. Real try-on flag (`BEAUTY_REAL_TRYON_ENABLED` — false in 5A)  
3. Subscription (stub pass in 5A)  
4. License  
5. Country  
6. Platform  
7. Device  
8. Provider availability  
9. Cost  
10. Quota  
11. Consent  
12. Age (future-ready)  
13. Quality gate  

## Env

| Flag | 5A default |
|------|------------|
| `BEAUTY_EXPERIENCE_ENABLED` | `true` (subsystem on) |
| `BEAUTY_REAL_TRYON_ENABLED` | `false` (no SDK) |
