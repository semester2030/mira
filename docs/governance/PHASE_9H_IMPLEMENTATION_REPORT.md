# PHASE 9H — Implementation Report

## Package
`lib/features/face_analysis_experience/guidance/`

## Delivered
- Contracts: `FaceGuidanceItemVm`, `FaceGuidanceReasonVm`, `FaceGuidanceSurfaceVm`, advisor context, truth manifest
- Pure assembler: `FaceGuidanceAssembler.build`
- Policies: ownership, eligibility/personalization, priority/cap, semantic dedup
- Validators: owner, source, forbidden phrases
- Presentation: compact 9F entry + dedicated guidance sheet
- 9G: related guidance link only when `sourceDetailRef` matches open detail
- Analytics: semantic keys only
- Flag: inherits Result Mirror flag

## Integration
- `ResultsFaceMirrorScreen`: `openGuidance` opens guidance sheet (not legacy tips dump)
- Compact «إرشادك الشخصي» entry below action bar
- Legacy full report remains secondary fallback
