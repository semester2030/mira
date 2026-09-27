# Phase 3 — E2E Provider Validation

| Journey | Code/unit proof | Live entry proof | Real provider proof | Full user E2E | Verdict |
|---|---|---|---|---|---|
| Face capture → skin analysis → result | PASS | route/auth/live Perfect selection PASS | NOT_PROVEN; TFHub unproven | NOT_PROVEN | BLOCKED_BY_PROVIDER_AND_DEPLOYMENT |
| Fashion capture → FASHN/OpenAI → canonical garments → scoring | PASS | route/auth PASS | NOT_PROVEN | NOT_PROVEN | BLOCKED_BY_CONFIG_PROVIDER_DEPLOYMENT |
| Advisor → evidence → LLM/Claim Lock → response | PASS | route/auth PASS | NOT_PROVEN; Mode B off | NOT_PROVEN | BLOCKED_BY_CONFIG_AND_ENTITLEMENTS |
| Phone OTP → API identity → Prisma user | static/unit proof | guard reachable | real OTP/token not used | NOT_PROVEN | BLOCKED_BY_OWNER_AUTH_TEST |
| Redis-enforced rate limit | unit behavior known | no infrastructure proof | N/A | NOT_PROVEN | BLOCKED_BY_INFRASTRUCTURE |
| Subscription purchase/restore | no real integration | webhook 501 | N/A | N/A | NOT_REQUIRED / DISABLED |
| Beauty live try-on | disabled adapter | disabled | N/A | N/A | NOT_REQUIRED / DISABLED |

“HTTP 200 health”, credential-name presence, 401 from a vendor, route
reachability and passing mocks do not count as REAL_RESPONSE or E2E.

No provider journey qualifies as `E2E_PROVEN`. Controlled E2E would require an
owner-designated Firebase test user/image, confirmed vendor quotas and a
candidate deployment. Those permissions were not granted in this phase.
