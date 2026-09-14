# PROD-FINAL-1 — Client Runtime Gating

Face flags (`FaceCaptureMirrorFlag`, `FaceAnalysisMotionFlag`, `FaceResultMirrorFlag`) =
`MiraFeatures.*` AND `MiraRuntimeEntitlementStore.faceExperienceV1`

Fashion advisor client route =
`MiraFeatures.fashionAdvisorV1` AND `MiraRuntimeEntitlementStore.fashionAdvisorModeB`

Loader: `MiraRuntimeEntitlementLoader.refresh()` → fail-closed clear on error.
Logout clears store (auth repo, profile remote, settings).
