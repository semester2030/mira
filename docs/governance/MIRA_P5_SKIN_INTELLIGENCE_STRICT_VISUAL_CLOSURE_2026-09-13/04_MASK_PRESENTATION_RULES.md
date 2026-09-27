# Mask presentation rules

ALLOWED:
- semantic ColorFilter srcIn tint
- opacity / soft second presence pass (same mask bytes)
- blend presentation only

FORBIDDEN (not done):
- dilation / erosion / warp / offset
- stroke / polygon / landmark / signature lines
- geometry modification

GEOMETRY MODIFIED = NO
