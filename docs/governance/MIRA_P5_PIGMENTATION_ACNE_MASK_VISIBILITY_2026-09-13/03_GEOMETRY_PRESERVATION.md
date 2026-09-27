# Geometry preservation
- No dilation / blur / offset / landmark fallback
- Luminance gate only remaps presentation alpha of existing Perfect pixels
- Perfect A=0 → visual 0 (unit-tested)
- Wash gray (61,61,61,92) → presentation 0 (not expansion; suppression)
- Lesion pixels remain at Perfect coordinates
MASK EXPANSION = 0
