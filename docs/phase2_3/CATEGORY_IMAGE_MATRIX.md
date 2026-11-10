# Phase 2 — categoryId → imageKey → file → display proof

Same `imageKey` resolves in Flutter (`LaneOrbAssets`) and portal (`ORB_BY_ID` / `SUB_ORB_BY_ID` in `e2b-product-shell.js`). Thumbs are derived from the same master PNG.

| categoryId | imageKey | Flutter master | Flutter thumb | Portal orb | Display |
|---|---|---|---|---|---|
| jewelry | jewelry | lanes/jewelry.png | thumbs/jewelry.png | e2b-ref/orbs/jewelry.png | home orbit + rail |
| jewelry.rings | jewelry.rings | lanes/jewelry.rings.png | thumbs/jewelry.rings.png | jewelry_rings.png | sub rail |
| jewelry.necklaces | jewelry.necklaces | lanes/jewelry.necklaces.png | thumbs/jewelry.necklaces.png | jewelry_necklaces.png | sub rail |
| jewelry.bracelets | jewelry.bracelets | lanes/jewelry.bracelets.png | thumbs/jewelry.bracelets.png | jewelry_bracelets.png | sub rail |
| jewelry.earrings | jewelry.earrings | lanes/jewelry.earrings.png | thumbs/jewelry.earrings.png | jewelry_earrings.png | sub rail |
| children | children | lanes/children.png | thumbs/children.png | children.png | home orbit + rail |
| children.clothes | children.clothes | lanes/children.clothes.png | thumbs/children.clothes.png | children_clothes.png | sub rail |
| children.shoes | children.shoes | lanes/children.shoes.png | thumbs/children.shoes.png | children_shoes.png | sub rail |
| children.newborn | children.newborn | lanes/children.newborn.png | thumbs/children.newborn.png | children_newborn.png | sub rail |
| occasions | occasions | lanes/occasions.png | thumbs/occasions.png | occasions.png | home orbit + rail |
| occasions.favors | occasions.favors | lanes/occasions.favors.png | thumbs/occasions.favors.png | occasions_favors.png | sub rail (شراء) |
| occasions.decor | occasions.decor | lanes/occasions.decor.png | thumbs/occasions.decor.png | occasions_decor.png | sub rail (ضيافة تُشترى) |
| occasions.styling | occasions.styling | lanes/occasions.styling.png | thumbs/occasions.styling.png | occasions_styling.png | sub rail (تنسيق يُحجز) |
| gifts | gifts | lanes/gifts.png | thumbs/gifts.png | gifts.png | home orbit + rail |
| gifts.boxes | gifts.boxes | lanes/gifts.boxes.png | thumbs/gifts.boxes.png | gifts_boxes.png | sub rail |
| elegance *(reused)* | elegance | discover/elegance_lane.png | same | *(existing)* | home orbit |
| beauty *(reused)* | beauty | discover/beauty_lane.png | same | *(existing)* | home orbit |

**Deferred (not in this delivery):** jewelry sets, children accessories, gifts wrapping.

**Preview board:** `docs/phase2_3/preview/ORB_PREVIEW_BOARD.html`

**Registry:** `mira-api/src/marketplace/taxonomy/phase2-orb-assets.v1.json`
