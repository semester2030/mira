# Capture usability closure status

## Surgical fixes applied (no CameraKit re-integration, no results touch)

1. **Frame feed:** VideoRange → FullRange Y/UV expand before `sendCameraBuffer`
2. **Exposure:** continuous auto exposure + auto focus on CameraKit capture path
3. **HUD:** CameraKit guide oval 0.72×0.84 (was 0.58×0.68) to match MODERATE faceSizeRatio 0.65
4. **Guidance:** priority distance → pose → lighting; clearer Arabic lighting copy
5. **Pose:** MODERATE yaw/pitch **unchanged**

## Lighting override

LIGHTING OVERRIDE REQUIRED: **PENDING physical retest after frame expand**  
Prior owner evidence: `area=good` + `pose=good` + `light=under_exposed` blocked READY.  
Hypothesis: false under_exposure from VideoRange labeled as FullRange.  
Override not applied yet (pose/size untouched).

## Physical matrix

Redeployed to fayez's iPhone (arm64 debug).  
Awaiting Skin Analysis session logs (`meanY`, `light=normal|good`, `ready=true`) and continuous video.

STATUS = BLOCKED until READY→AUTO CAPTURE proven on device.
