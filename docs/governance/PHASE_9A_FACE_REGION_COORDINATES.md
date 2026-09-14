# Phase 9A — Face Region Coordinates

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — READ ONLY Discovery + Architecture Lock  
**Date:** 2026-08-11  


Backend/anchor naming uses MediaPipe topology (`leftEyeOuter`, `leftFace=234`, `rightFace=454`, etc.).
Convention implied: **subject-left / subject-right** in landmark space (not viewer-left after mirror).

Before interactive overlays: lock coordinate policy + mirror transform contract (Decision D12).
Standalone ADR spelling "subject-left" explicitly: **NOT_FOUND** — recommend documentation in 9B contracts.
