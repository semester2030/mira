# Provider Health Model

**Version:** `provider-health-model-v1`

| Status | Meaning |
|--------|---------|
| available | Safe to negotiate execution |
| unavailable | Intentionally off |
| maintenance | Temporary |
| quota_exhausted | No units |
| authentication_failed | Auth rejected |
| license_missing | Not verified / missing |
| configuration_invalid | Bad/incomplete config |
| unknown | Not assessed |

Current seed: Perfect → `license_missing`; Banuba → `license_missing`; Disabled → `unavailable`.
