# Phase 1 — Fashion Activation Matrix

## Authorities

1. Flutter backend selection: `USE_MIRA_API` (default true).
2. Flutter Fashion Advisor build flag: `MIRA_FASHION_ADVISOR_V1`.
3. Runtime entitlement: `fashionAdvisorModeB`.
4. Server master: `MIRA_FASHION_MODE_B_MASTER_ENABLED`.
5. Fashion Knowledge integration and Mode B flags.
6. Provider readiness: Vision/FASHN for image analysis; LLM for Mode B.
7. Claim Lock: mandatory final publication gate.

Image analysis and Fashion Advisor activation are separate capabilities.

## Truth table

| Backend | Canonical provider | Canonical response | Advisor build + entitlement | FK/LLM ready | Result |
|---|---|---|---|---|---|
| OFF | any | any | any | any | BLOCKED |
| ON | unavailable | any | any | any | DEGRADED / explicit unavailable |
| ON | ready | malformed/blocked | any | any | BLOCKED |
| ON | ready | valid garments | OFF | any | ANALYSIS AVAILABLE; ADVISOR DISABLED |
| ON | ready | valid garments | ON | not ready | ANALYSIS AVAILABLE; ADVISOR DEGRADED |
| ON | ready | valid garments | ON | ready + Claim Lock PASS | AVAILABLE |
| ON | ready | valid garments | ON | draft fails Claim Lock | ADVISOR BLOCKED |

## Misconfiguration rules

- Client Fashion Advisor build flag ON while runtime entitlement is OFF:
  UI must show unavailable and must not call a synthetic fallback.
- Entitlement ON while FK integration/LLM is OFF:
  `MISCONFIGURED`; no prescriptive answer may escape.
- `OUTFIT_PROVIDER=mock` does not make canonical Fashion ready. It applies to a
  legacy endpoint that rejects mock production execution.
- An absent/invalid entitlement fails closed.
- Provider failure remains explicit unavailable/degraded.

## Phase 1 posture

- Canonical image analysis: enabled by code, corrected contract, requires real
  provider/runtime proof.
- Server Outfit Intelligence: `NOT_WIRED`.
- Fashion Knowledge Modes A/B: `DISABLED`.
- Claim Lock: unchanged and mandatory if Fashion Knowledge is later activated.
- No new flag framework or production activation was introduced.
