# Beauty Capability Runtime Matrix

**Version:** `beauty-cap-runtime-matrix-v1`

| Status | Meaning | Terminal | Retry |
|--------|---------|----------|-------|
| NOT_REQUESTED | Not asked this session | No | Yes |
| AVAILABLE | May execute after negotiation | No | Yes |
| UNAVAILABLE | Registered but not executable | Yes | Yes |
| FAILED | Execution failed | Yes | Yes |
| SKIPPED | Intentionally skipped | Yes | No |
| BLOCKED_BY_POLICY | Generic / multi-rule policy | Yes | Yes |
| BLOCKED_BY_LICENSE | License / entitlement | Yes | Yes |
| BLOCKED_BY_COST | Quota / cost class | Yes | Yes |
| BLOCKED_BY_PLATFORM | Platform unsupported | Yes | No |
| BLOCKED_BY_PROVIDER | No healthy selectable provider | Yes | Yes |
| BLOCKED_BY_ASSETS | Missing mask/mesh/image | Yes | Yes |
| BLOCKED_BY_QUALITY | Capture quality gate | Yes | Yes |
| BLOCKED_BY_CONFIGURATION | Config / readiness incomplete | Yes | Yes |

## Explainability (Law #16)

Every runtime state includes:

- Reason (`reasonCode` / EN / AR)  
- Stage (`idle` \| `registry` \| `policy` \| `configuration` \| `provider_selection` \| …)  
- Policy (`policyRuleId` when applicable)  
- Version (`capabilityVersion`)  
- Retry policy (`retryable` from catalog)  
- Provider (`providerId`) — **server audit only**; stripped from public DTOs  

Allowed transitions: see `RUNTIME_STATUS_CATALOG` in `beauty-runtime-state.ts`.
