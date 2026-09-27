# Physical iPhone Evidence — Strict Frontal Geometry

**Task:** `MIRA-P5-SKIN-STRICT-FRONTAL-GEOMETRY-2026-09-09`  
**Device:** fayez’s iPhone `00008110-00191986268BA01E`

## Cursor-side proof completed

- App launch from Cursor: PASS
- strict-frontal code built/analyzed locally: PASS
- targeted geometry tests: PASS

## Owner acceptance matrix still required on device

### Live capture gate

- [ ] Off-center face -> rejected
- [ ] Sideways turn / yaw -> rejected
- [ ] Vertical pitch up/down -> rejected
- [ ] Roll / tilt -> rejected
- [ ] Too close -> rejected
- [ ] Too far -> rejected
- [ ] Forehead clipped -> rejected
- [ ] Chin clipped -> rejected
- [ ] Valid frontal face -> READY

### Post-capture / same-image

- [ ] Valid captured image -> post-capture PASS
- [ ] Same accepted image -> analysis request
- [ ] Same accepted image -> current report ephemeral face

### Region correctness

- [ ] Forehead tap -> forehead
- [ ] User-left cheek tap -> user-left cheek
- [ ] User-right cheek tap -> user-right cheek
- [ ] Nose tap -> nose
- [ ] Chin tap -> chin
- [ ] Wrong region selections = 0
- [ ] Right/left swaps = 0

## Notes

- No private face photos included in repository evidence or ZIP.
- History remains independent of the original face image.
- Current report map truth remains `LANDMARK_TEMPLATE`.

## Status

`PHYSICAL_IPHONE = BLOCKED` until the checklist above is executed on-device.
