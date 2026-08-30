# Phase 9A — Auto-Capture Feasibility

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — Face Analysis Experience Discovery + Architecture Lock  
**Mode:** READ ONLY · NO IMPLEMENTATION  
**Date:** 2026-08-11  
**Verdict context:** Face Intelligence v1.0.0 frozen · Skin Intelligence v1.0.0 frozen · consume-only


## Classification: **MODERATE**

### Evidence
- Dependencies already present: `camera`, `mediapipe_face_mesh`, `google_mlkit_face_detection`
- Live mesh stream + `FaceMeshQualityGate.canTakePhoto` already computes READY-like condition
- Missing: hold-still timer (N ms stable), auto `takePicture()`, state machine UX, reduce false triggers

### Feasible without server spam
Yes — all guidance can stay on-device; server called once after capture (current pattern).

### Not EASY because
- Must handle low-end FPS, flicker readiness, accessibility Reduce Motion, Arabic guidance copy, no accidental captures
