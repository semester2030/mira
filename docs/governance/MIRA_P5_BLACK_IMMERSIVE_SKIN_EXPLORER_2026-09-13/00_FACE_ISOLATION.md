# Face isolation audit

## Verdict
MISSING

## Exact missing capability
`portrait_head_subject_alpha_matte`

## Proof (repo audit)
- Perfect HD outputs are concern overlays only; `resize_image` is opaque JPEG; `all` score-only
- MediaPipe / ML Kit = landmarks / face presence — not selfie segmentation
- No matting package in pubspec
- Face oval / ClipOval = geometric UX only (explicitly forbidden as crude crop)
- FASHN BG-remove = outfit garment path — wrong domain

## What was NOT done
- No oval/mesh fake cutout
- No invented hair/jaw matte
- Black chrome applied to Face Explorer shell only (does not remove sofa/clothes from photo)

## Consequence
FACE ONLY = FAIL → overall STATUS = BLOCKED per owner gate.
