# Provider Activation Guide

**Law #19–#22**

## Wizard (architecture only — no UI)

```
Choose Provider
  → Verify License
  → Verify Capabilities
  → Configure Keys (env)
  → Health Check
  → Activate
  → Smoke Test
  → Ready
```

Code: `PROVIDER_CONFIGURATION_WIZARD` in `configuration-wizard.ts`.

## Capability activation states

Disabled · Pending Verification · Ready · Activated · Suspended · Deprecated · Removed

## Rule

Capability stays **Disabled** unless:

1. Provider verified  
2. License verified  
3. Capability verified  
4. Configuration complete  
5. Full activation checklist Pass  

Otherwise: remain Disabled.
