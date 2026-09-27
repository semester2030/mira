# Feature Activation Preflight

## SOURCE / TEST / CONFIG evidence

The authoritative activation intersection remains:

`BUILD CAPABILITY ∩ RUNTIME ENTITLEMENT ∩ OWNER/ALLOWLIST CONTROL`

Verified:

- missing or invalid entitlement config fails closed
- empty allowlist returns all runtime capabilities OFF
- Face and Fashion masters default OFF
- unauthenticated/invalid Firebase identity is rejected
- Flutter entitlement cache clears on logout/account switch
- server-side Fashion gating remains authoritative
- Face Experience activation is presentation-only where designed
- production legacy outfit path cannot emit scored mock success
- Perfect fallback, auth skip, and partner auto-approve are forbidden

Production did not receive any broad activation change. Result:
`FEATURE_ACTIVATION = SAFE`; `UNSAFE_FEATURE_ACTIVATION = NO`.
