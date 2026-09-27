# Perfect Corp capability findings

## Present in Perfect public API
- AI Photo Background Removal: POST /s2s/v2.0/task/sod (1 unit)
- AI Photo Background Change / blur variants
- Hair type, density, color, length (analysis/VTO) — NOT subject alpha matte

## Present in MIRA Skin HD path
- NONE of the above for isolation
- Only hd_* concern masks + resize_image JPEG

## Gaps vs MIRA need
- Documented output = foreground image; dedicated raw alpha URL not confirmed
- Requires upload
- Whether current MIRA Perfect subscription includes SOD units: UNKNOWN (owner confirm; do not purchase in this task)

## Verdict
EXISTING PERFECT CAPABILITY FOR HAIR MATTING IN SKIN: NONE (API exists ecosystem-wide; not wired; alpha contract UNKNOWN)
