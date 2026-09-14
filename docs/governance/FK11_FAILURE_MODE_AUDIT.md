# FK-11 — Failure / Fail-Closed Audit

## Library
Provider failure / malformed draft / Claim Lock BLOCK → no suggestion projection (verified in tests).

## Production Advisor
Does not call provider; fails into unavailable when flag ON.

## MCE
When flag OFF, LLM failures follow MCE validator — may still produce parse_fallback prose (**fail-open for fashion content** relative to FK policy).

## Telemetry failure
Bridge catches telemetry errors; does not block projection (`telemetryRecorded` false). OK.
