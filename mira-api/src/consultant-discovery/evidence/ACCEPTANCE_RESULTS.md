# Acceptance results — Consultant Discovery v1

| Case | Request | Expected | Actual (intent) | Offer id | Open proof / abstain |
|---|---|---|---|---|---|
| A01 | ضيفة + شنطة تحت 300 | product search | pass | live bags e.g. `49d6042f…` / `9bf9336d…` | catalog probe 2026-11-15; open via CatalogRecordScope |
| A02 | منسّقة زواج الرياض | service search | pass | — | **0** published `تنسيق` — honest empty |
| A03 | عندي زواج | clarify | pass | — | no search |
| A04 | فستان زفاف بس | dress only | pass | wedding dress ids if published | no side suggestion |
| A05 | رفض منظمة | refuse | pass | — | |
| A06 | صورة وجه فقط | advice_only | pass | — | no clinic |
| A07 | حجز ليزر | service | pass | depends on beauty laser publish | |
| A08 | جلسة مكياج | service | pass | e.g. service `0094e403…` in probe | |
| A09 | هدية مولود | product | pass | — | **0** `مولود` — session-only preference |
| A10–A20 | matrix | see tests | **20/20 intent** | — | `acceptance.schema-tests.ts` |

## Not exercised on device yet

- Size out-of-stock after card shown (needs partner withdraw while session open)
- Booking slot absent after suggest
- Server flag off → client sees disabled message

## Public enablement

Separate step after Fayez iPhone review. Client dart-define may be on for QA; prod server `MIRA_CONSULTANT_DISCOVERY_V1` remains operator-controlled.
