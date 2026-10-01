# Correction tracker — after c98decb review

Baseline HEAD at start: `cf72f8a` (deploy note on top of `c98decb`).
User WIP preserved (phase2 PNGs / PH4 zips left untouched).

| ID | Issue | Status |
| --- | --- | --- |
| C1 | Availability overlap: duplicate slots / first-window capacity | proven_by_test (pure + assertAvailabilityConsistent; HTTP capacity pending) |
| C2 | canonicalVariantKey delimiter collision | proven_by_test (length-prefix; variant id preferred) |
| C3 | Status map vs code (failed_delivery, reject-after-accept, collect) | implemented_awaiting_db (STATUS_MAP + collect after delivered only) |
| C4 | Delivery fee “max” + acknowledgeUnknown presented as owner policy | implemented_awaiting_db (equal known fee; ack removed; DEC clarified) |
| C5 | Partner portal options JSON / availability UI / review bypass | implemented_awaiting_db (draft options + day UI + structured save) |
| C6 | Admin commerce ops incomplete / publish | implemented_awaiting_publish (detail/timeline/transitions/collect/bookings) |
| C7 | Share deep link / favorites proof / views deferred | in_progress (route parse; views remain open) |
| C8 | Thin review ZIP / empty tests folder | open |
| C9 | HTTP+DB journey proofs | open |
| C10 | Flutter failing tests + device journey | open |
