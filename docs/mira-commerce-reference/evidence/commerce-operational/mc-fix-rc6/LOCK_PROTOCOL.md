# RC6 schedule lock protocol

## Protocol (single path)

1. `pg_advisory_xact_lock(hashtext(commerce-schedule-partner:{partnerId}))` — partner coordination first.
2. Re-read that partner’s **active** services inside the same transaction (`loadServices`).
3. `expandScheduleScope(seedServiceIds, seedResourceIds)` — transitive sharing graph for **this partner only**.
4. Acquire the **full sorted** set from `scheduleLockKeys` once (`commerce-booking-service:{id}`, `commerce-booking-resource:{partnerId}:{resourceId}`).
5. `SELECT id FROM services WHERE id = $id FOR UPDATE` in sorted id order.
6. Optional test-only barrier `MIRA_TEST_SCHEDULE_GATE=hold` after locks (never in production).

**Forbidden:** acquiring additional resource/service advisories after holding a partial set (RC5 mid-tx expand caused T1⊗T2 circular wait).

Partner id always comes from the DB row (service/product owner), never from an unverified client field.

## Path coverage

| Path | Function | Lock order |
| --- | --- | --- |
| Create booking | `CommerceService.createBooking` | coord → expand(service+resources) → sorted advisories → FOR UPDATE services |
| Create service + unify | `PartnersPortalService.createService` | coord (seed `create:{partnerId}`) → expand → sorted → FOR UPDATE siblings → unify write |
| Update service / schedule / duration / resource / capacity | `PartnersPortalService.updateService` | coord → expand(old∪new resources) → sorted → FOR UPDATE → re-read → write |
| Partner withdraw / disable | `PartnersPortalService.deleteService` | coord → expand → sorted → FOR UPDATE → `active=false`, `contentStatus=withdrawn` |
| Admin withdraw / republish-affecting decide | `CatalogContentService.decide` (service withdraw) | same `lockPartnerScheduleScope` before owner update |

No global lock across all partners. Coordination key includes `partnerId`.

## Evidence scenarios (PostgreSQL, production functions)

| ID | Scenario | Result |
| --- | --- | --- |
| CONTROL | T1 holds Z then waits for A; T2 holds A waits for Z | timeout/deadlock observed |
| RC6-02 prod | After T0 grows S1→A+Z, concurrent `updateService` on S1/S2 | both commit; capacities retained |
| E5b | `deleteService` then `createBooking` | withdraw wins; no booking row |
| E6b | `createBooking` then `deleteService` | booking retained; service withdrawn |
| ADMIN-WD / ADMIN-E6 | `catalog.decide(withdraw)` both orders vs booking | same semantics |
| CAP1 | two bookings capacity-1 | one success, one reject |
| ATOMIC | mid-unify injected failure | full rollback (existing suite) |
| I | two partners same resource name | no cross-partner lock mix |

Logs: `lock-protocol.log`, `test-commerce.log`.
