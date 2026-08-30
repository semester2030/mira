# Phase 9A — File Impact Map

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — READ ONLY Discovery + Architecture Lock  
**Date:** 2026-08-11  


### CREATE (future)
`lib/features/face_analysis_experience/**` projection VMs, capture state machine, mirror screens, docs portal already created.

### EXTEND
`face_capture_panel.dart`, live_face_map painters, results_experience (careful ownership vs skin), navigation entry naming.

### CONSUME_ONLY
Face Intelligence API DTO, Skin report, Advisor routes, MediaPipe service.

### NEVER_MODIFY (without CR)
`mira-api/src/intelligence/face-intelligence/**` engines, Skin Intelligence engines, Advisor frozen core, Fashion Knowledge freeze.
