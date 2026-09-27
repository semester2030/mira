# Post-capture blockers — necessity log (implementation)

Aligned with user constraint: do not port legacy reject stack blindly.

| Blocker | Threshold | Why hard-reject | Arabic reason |
|---------|-----------|-----------------|---------------|
| missing file | — | no input | لم يتم العثور على الصورة… |
| decode_failed | — | no pixels | تعذر قراءة الصورة… |
| no_face | faceCount==0 | Perfect single-face | لم نتعرف على وجه… |
| multiple_faces | faceCount>1 | Perfect single-face | وجدنا أكثر من وجه… |
| face_too_small | area < 0.05 | YouCam framing | الوجه بعيد جداً… |
| face_too_large | area > 0.92 | cropped face | الوجه قريب جداً أو مقصوص… |
| resolution_below_hd | short side < **1080** | Perfect HD Face Explorer contract (`HD_MIN_SHORT_SIDE`) — **not** SD 480 | دقة الصورة غير كافية… ≥1080 |

## Explicit non-blockers (advisory / provider later)

| Signal | Legacy | Manual path |
|--------|--------|-------------|
| blur Laplacian < 28 | blocked in QualityConfidenceMapper | **advisory log only** — method = variance of absolute Laplacian on luma with spatial stride; threshold not validated against HD Perfect success in this repo |
| brightness outside [0.18,0.92] | blocked | not local hard reject |
| over/under exposure ratios | blocked | not local hard reject |
| shadow imbalance | blocked | not local hard reject |
| yaw/pitch/roll | FaceGate full | not local hard reject |
| center offset | FaceGate full | not local hard reject |

Provider/YouCam face errors still surface via existing Arabic classification after upload.
