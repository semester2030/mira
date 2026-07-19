# Provider Verification Checklist

**Version:** `provider-verification-v1`

## Checks (Pass / Fail / Unknown)

| Check | Live probe in 5B.0? |
|-------|---------------------|
| License | No — operator evidence |
| Capabilities | Catalog / registry only |
| Quota | Config metadata only |
| Sandbox | Registry flag only |
| Health | Registry model only |
| Authentication | **No live call** → Unknown until smoke |
| API reachability | **No live call** → Unknown until smoke |
| Version compatibility | Config fields |
| Required assets | Catalog |
| Configuration | Config status |

## Activation

`buildActivationChecklist` requires **all** items **Pass**. Unknown counts as Fail for activation.

See `activation-checklist.ts`.
