# Cross-User Cache Isolation

Controlled runtime sequence:

1. authenticate `OWNER_CANARY`
2. retrieve privileged runtime entitlement
3. authenticate `NON_OWNER_CANARY`
4. retrieve runtime entitlement
5. repeat NON_OWNER and then OWNER

Results:

- OWNER: Fashion entitlement ON
- NON_OWNER: Fashion entitlement OFF
- repeated NON_OWNER: OFF
- reverse transition to OWNER: ON
- shared response privilege inheritance: none
- `CROSS_USER_PRIVILEGE_LEAK = 0`
- `ENTITLEMENT_CACHE_ISOLATION = PASS`

No raw UID or token is retained in evidence.
