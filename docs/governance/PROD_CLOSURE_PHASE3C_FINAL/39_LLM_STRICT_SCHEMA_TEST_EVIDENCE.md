# 39 — LLM Strict Schema Test Evidence

## Static/build

- TypeScript/Nest build: PASS;
- provider request emits `json_schema`: PASS;
- provider request emits `strict: true`: PASS;
- no application linter diagnostics introduced: PASS.

## Contract tests

| Case | Result |
|---|---|
| valid complete canonical fixture | ACCEPTED |
| `subjectivity = SUBJECTIVE` | REJECTED |
| conflict `unknown` | REJECTED |
| conflict `UNKNOWN` | ACCEPTED |
| missing required field | REJECTED |
| invalid nested alternative | REJECTED |
| invalid change action | REJECTED |
| unexpected property | REJECTED |
| complete draft parser | PASS |
| complete draft validator | PASS |
| complete draft Claim Lock | REACHABLE / PASS_WITH_QUALIFICATION |

## Fail-closed controls

- missing key: no provider call;
- malformed output: no candidate;
- unsupported enum parser path: validator blocks;
- HTTP 401/429/500: no candidate;
- timeout/network failure: no candidate;
- false provenance/body/cultural violations: blocked;
- mock fallback in production module: absent.

`LLM_REJECTED_OUTPUT_TRUSTED_SUCCESS = 0`
