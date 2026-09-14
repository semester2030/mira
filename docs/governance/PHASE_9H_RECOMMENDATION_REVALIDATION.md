# PHASE 9H — Recommendation Revalidation

Client production DTO categories observed:
`hairstyle`, `makeup_contour`, `eyewear`, `accessories`, `educational`.

Wire fields available to Flutter: id, category, titleAr/En, bodyAr/En.
Backend may carry richer reason/evidence/confidence; client mirror strips them today.

9H **projects** existing recommendations only — does not reimplement `if oval → haircut X` heuristics in Flutter.
