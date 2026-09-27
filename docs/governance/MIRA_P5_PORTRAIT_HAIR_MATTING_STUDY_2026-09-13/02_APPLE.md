# Apple capability findings

Primary candidates:
1. VNGeneratePersonSegmentationRequest (iOS 15+), qualityLevel = accurate (matting refinement)
2. VNGenerateForegroundInstanceMaskRequest (iOS 17+), generateScaledMaskForImage — soft full-res mask; Apple ML notes hair/fur upsampling
3. Capture-time AVSemanticSegmentationMatte hair — NOT applicable to already-captured Skin analysis JPEG unless capture pipeline redesigned

Privacy: on-device, offline
Flutter: requires native bridge
Hair on pure black with curly hair: UNPROVEN — POC mandatory
Portrait Mode quality must NOT be assumed
