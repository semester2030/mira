# TECHNICAL DEBT REGISTER

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9B — Capture Quality + Camera Contracts  
**Date:** 2026-08-11  
**Official portal:** `docs/mira-face-analysis-experience.html`  
**Mode:** Contracts + pure readiness logic · NO final mirror UI · NO production auto-shutter

- Production FaceCapturePanel not yet consuming evaluator (intentional until 9C)
- Live blur/brightness rarely available on preview frames
- Uneven lighting not separately signalled (global brightness only)
