# AT-2 — Technical Debt

- Optional live smoke harness (opt-in env) not added — deferred to AT-4
- json_schema strict mode not used (json_object + parser) — acceptable; may tighten later without contract change
- Timeout floor 1000ms may exceed ultra-short test intents — intentional safety floor
