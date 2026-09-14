# READINESS STATE MACHINE

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9B — Capture Quality + Camera Contracts  
**Date:** 2026-08-11  
**Official portal:** `docs/mira-face-analysis-experience.html`  
**Mode:** Contracts + pure readiness logic · NO final mirror UI · NO production auto-shutter

States: initializing, searchingFace, multipleFaces, alignFace, moveCloser, moveFarther, adjustAngle, improveLight, holdStill, ready, captureInProgress, captured, qualityBlocked, cameraUnavailable, permissionDenied. One primary state per evaluation.
