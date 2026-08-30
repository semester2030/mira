# PHASE 9F — Image Continuity

## Problem
Analysis pipelines delete the capture temp file in `finally` before navigation.

## Solution
When `FaceResultMirrorFlag` is ON, `NewAnalysisScreen` calls
`FaceResultMirrorImageHold.prepareFrom` **before** analysis, copying to `*.mira_9f_hold`.
Path passed via `MiraReportRouteArgs.captureImagePath`.
`ResultsFaceMirrorScreen.dispose` releases the hold (zero local retention).

## Failure paths
Guest/signed-in analysis failure releases hold immediately.
History / no path: mirror degrades to placeholder face chrome without inventing results.
