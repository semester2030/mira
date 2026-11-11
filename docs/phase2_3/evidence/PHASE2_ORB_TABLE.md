# Phase 2 — Portal orb decode table (real browser paint)

| التصنيف (categoryId) | الصورة المتوقعة | الصورة المعروضة (hash match) | النتيجة |
|---|---|---|---|
| jewelry | assets/e2b-ref/orbs/jewelry.png | shownHash==expected | PASS |
| jewelry.rings | assets/e2b-ref/orbs/jewelry_rings.png | shownHash==expected | PASS |
| jewelry.necklaces | assets/e2b-ref/orbs/jewelry_necklaces.png | shownHash==expected | PASS |
| jewelry.bracelets | assets/e2b-ref/orbs/jewelry_bracelets.png | shownHash==expected | PASS |
| jewelry.earrings | assets/e2b-ref/orbs/jewelry_earrings.png | shownHash==expected | PASS |
| children | assets/e2b-ref/orbs/children.png | shownHash==expected | PASS |
| children.clothes | assets/e2b-ref/orbs/children_clothes.png | shownHash==expected | PASS |
| children.shoes | assets/e2b-ref/orbs/children_shoes.png | shownHash==expected | PASS |
| children.newborn | assets/e2b-ref/orbs/children_newborn.png | shownHash==expected | PASS |
| occasions | assets/e2b-ref/orbs/occasions.png | shownHash==expected | PASS |
| occasions.favors | assets/e2b-ref/orbs/occasions_favors.png | shownHash==expected | PASS |
| occasions.decor | assets/e2b-ref/orbs/occasions_decor.png | shownHash==expected | PASS |
| occasions.styling | assets/e2b-ref/orbs/occasions_styling.png | shownHash==expected | PASS |
| gifts | assets/e2b-ref/orbs/gifts.png | shownHash==expected | PASS |
| gifts.boxes | assets/e2b-ref/orbs/gifts_boxes.png | shownHash==expected | PASS |

**15/15 PASS.** Source: `PORTAL_ORB_BROWSER_RESULTS.md` via `verify_portal_orbs_browser.mjs` against `phase2-orb-acceptance.html`.

## Negative swap log
Rings URL kept valid but file bytes swapped with earrings → decode hash ≠ rings expected → `negativeFailedCorrectly=true` (`PORTAL_ORB_NEGATIVE.json`).
