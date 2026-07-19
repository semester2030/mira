# Provider Configuration

**Law #20:** Activation is configuration, not coding.

## Model fields

- API Key → **env var name only** (e.g. `PERFECT_API_KEY`) — never store secrets in code  
- Environment: sandbox / production / unknown  
- Endpoints (base URL env + default)  
- SDK Version / REST Version  
- Feature Flags  
- Timeout  
- Quota  
- Region  
- Health Check (`allowLiveProbe: false` in readiness platform)

## Mira Perfect (current)

| Field | Value |
|-------|--------|
| apiKeyEnvVar | `PERFECT_API_KEY` |
| restBaseUrlDefault | `https://yce-api-01.makeupar.com/s2s/v2.0` |
| Flags | `BEAUTY_TRYON_ENABLED=false`, `BEAUTY_REAL_TRYON_ENABLED=false`, `BEAUTY_LIP_LICENSE_VERIFIED=false` |
| status | **partial** |
