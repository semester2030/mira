# Entitlement Intersection and Cache Isolation

The deployed source computes effective entitlement as:

`authenticated UID ∩ internal allowlist ∩ runtime master`

Current production state has an empty allowlist and OFF masters. Two distinct
valid users independently received the same OFF contract, with no extra
fields and no cross-user privileged result.

- Face effective access: OFF
- Fashion Advisor Mode B effective access: OFF
- Advisor provider injection under current entitlement: OFF
- `ENTITLEMENT_INTERSECTION_MODEL = PASS`
- `CROSS_USER_PRIVILEGE_LEAK = 0`

Flutter source clears its process-local entitlement store on both auth and
profile logout paths. The server endpoint is stateless per token.

However, privileged-user-to-unprivileged-user cache isolation could not be
tested because no privileged/allowlisted production identity exists.

`ENTITLEMENT_CACHE_ISOLATION = NOT PROVEN`
