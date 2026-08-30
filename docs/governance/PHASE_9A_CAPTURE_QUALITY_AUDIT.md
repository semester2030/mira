# Phase 9A — Capture Quality Audit

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — Face Analysis Experience Discovery + Architecture Lock  
**Mode:** READ ONLY · NO IMPLEMENTATION  
**Date:** 2026-08-11  
**Verdict context:** Face Intelligence v1.0.0 frozen · Skin Intelligence v1.0.0 frozen · consume-only


| Gate | Client | Server | Notes |
|------|--------|--------|-------|
| FACE_PRESENT | YES (ML Kit + mesh) | YES (BlazeFace) | |
| SINGLE_FACE | YES | YES | |
| FACE_CENTERED | YES | via eligibility codes | |
| FACE_SIZE | YES | YES | |
| POSE YAW/PITCH/ROLL | YES | YES (eligibility) | |
| EYES_VISIBLE | PARTIAL (landmarks check) | PARTIAL | |
| LIGHTING | YES pixel | YES image quality port | |
| OVER/UNDER EXPOSURE | YES brightness band | YES | |
| BLUR | YES | YES | |
| OCCLUSION/GLASSES/HAIR | NOT_FOUND dedicated | NOT_FOUND dedicated | |
| IMAGE_RESOLUTION | PARTIAL | YES thresholds | |

Thresholds: `CaptureQualityThresholds` / `cq-thresholds-v2.1`
