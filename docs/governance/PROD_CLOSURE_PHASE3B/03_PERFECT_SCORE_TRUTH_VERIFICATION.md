# Phase 3B — Perfect Score Truth Verification

## Implemented contract

`mapYouCamResults` now accepts each required concern only when `ui_score` is a
finite number in `[0,100]`. The eight required IDs are:

`wrinkle, pore, texture, acne, moisture, oiliness, redness, age_spot`.

Missing one/many, `null`/undefined, wrong type, out-of-range and empty arrays
throw `YouCam incomplete result` before Skin Intelligence, persistence or
Flutter DTO mapping. Fixed concern defaults, the empty beauty average and
empty skin-age default were removed. Complete provider values and existing
derived intelligence semantics are preserved.

## Adversarial evidence

`npm run test:phase3b-perfect` / combined `test:phase3b` passed:

- complete response preserves provider values;
- missing one and multiple metrics fail;
- null/missing, wrong-type, out-of-range and empty concerns fail;
- HTTP 400/401/403/429/500/503 fail;
- malformed File API response fails;
- polling timeout is bounded and fails.

All network cases use local fetch doubles. No Perfect Corp request was sent.

## Verdict

`PASS — MISSING_DATA_RESULT = EXPLICIT FAILURE`

No incomplete provider task can become a normal-looking production score.
Paid provider and end-user image E2E remain Phase 3C.
