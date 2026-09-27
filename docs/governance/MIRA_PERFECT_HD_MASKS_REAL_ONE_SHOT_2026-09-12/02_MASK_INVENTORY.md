# Mask inventory (sanitized)

Format: PNG with alpha (except resize_image JPEG auxiliary).

## Core

| type | region | raw_score | ui_score | mask | dims |
|------|--------|-----------|----------|------|------|
| hd_age_spot | — | 99.09 | 97 | YES | 1200×1680 |
| hd_redness | — | 93.70 | 90 | YES | 1200×1680 |
| hd_pore | forehead | 100 | 99 | YES | 1200×1680 |
| hd_pore | nose | 99.61 | 98 | YES | 1200×1680 |
| hd_pore | cheek | 100 | 99 | YES | 1200×1680 |
| hd_pore | whole | 99.90 | 99 | YES | 1200×1680 |
| hd_wrinkle | forehead | 93.14 | 86 | YES | 1200×1680 |
| hd_wrinkle | glabellar | 97.95 | 95 | YES | 1200×1680 |
| hd_wrinkle | crowfeet | 99 | 97 | YES | 1200×1680 |
| hd_wrinkle | periocular | 85.75 | 78 | YES | 1200×1680 |
| hd_wrinkle | nasolabial | 89.35 | 80 | YES | 1200×1680 |
| hd_wrinkle | marionette | 99 | 97 | YES | 1200×1680 |
| hd_wrinkle | whole | 83.90 | 78 | YES | 1200×1680 |

## Alignment proof

Every downloaded core mask: \`width==1200\`, \`height==1680\`, \`alignedWithSource=true\`, notes: \`mask dimensions == source (offset 0)\`. Overlay viewer uses CSS absolute inset 0 — no manual offset/rotation/warp.
