# AT-4R — Log Security

## Required after first live request
Inspect local Nest / test logs for absence of:
- API key
- full provider response body
- system prompt
- chain-of-thought
- excessive fashion context dumps

## Status
**PENDING** first live call.
AT-2 provider logging is designed to log model + latency, not secrets/payloads — re-verify on live run.
