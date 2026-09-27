# Alignment proof (design + on-device check)

## Design
ORIGINAL_IMAGE (ephemeral Skin capture)
→ Apple matte at same W×H
→ black composite same W×H
→ existing Perfect HD mask overlay (session bytes)
MANUAL_OFFSET = 0
FACE_WARP = 0
No second Perfect analysis.

## On-device proof
POC metrics bar prints:
- IN WxH (Flutter codec decode of source)
- MATTE WxH (alpha PNG)
- OUT WxH (black composite PNG)
- Perfect mask WxH (decoded bytes or artifact metadata)
- dimsMatch=true/false

Owner confirms visually that Perfect concern overlay sits on the face without nudge.
