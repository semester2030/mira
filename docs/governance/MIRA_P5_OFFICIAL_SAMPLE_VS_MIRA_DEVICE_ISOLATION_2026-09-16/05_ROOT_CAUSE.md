# 05 — ROOT CAUSE

## Isolation verdict

**Case A:** official sample reaches acceptance and captures; Mira does not (under matched MODERATE thresholds on the same device, sequential runs).

## Proven difference (not yet a single-variable root cause)

Mira fails at the **integration frame path**, not at the SDK preset values:

- Sample: AVCapture → FullRange CMSampleBuffer → `sendCameraBuffer`
- Mira: Flutter CameraImage (VideoRange) → rebuild FullRange → `sendCameraBuffer`
- Observed: sample gets sustained `light=normal/good` + canCapture; Mira mostly `under_exposed` even when area=good

`isValid=false` is **common to both** and is **not** the differentiator.

## Root-cause statement

Mechanism of Mira’s under_exposed / unstable READY under this feed: **UNKNOWN** (pending single-variable A/B on buffer format / orientation / resolution).

Do **not** claim “user too far” as root cause: `too_small` is an engine output that also appeared in the sample and cleared when face filled the native preview.
