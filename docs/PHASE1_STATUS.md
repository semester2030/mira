# Phase 1 status

**Status:** `OPEN_DEFERRED_BY_OWNER`

Phase 1 is **not closed**. Owner deferred the remaining three items; they are not fixed in Phase 2/3 and must not be recorded as passing.

## Deferred items

1. **Lane isolation when a filter from another section is sent** — catalog/query may still leak or mis-scope across lanes when foreign filters arrive.
2. **Partner editor taxonomy reader on switch-and-back** — portal editor load path when switching lanes and returning needs stronger proof than current coverage.
3. **Editor draft reopen via server** — reopening a partner editor draft through a fresh server round-trip is not proven as a closed acceptance item.

Do not treat `PHASE_1_CLOSED_VERIFIED_LOCAL` as current for these three. Phase 2/3 proceed independently.
