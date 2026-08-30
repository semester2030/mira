# Phase 9B — Package Architecture

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9B — Capture Quality + Camera Contracts  
**Date:** 2026-08-11  
**Official portal:** `docs/mira-face-analysis-experience.html`  
**Mode:** Contracts + pure readiness logic · NO final mirror UI · NO production auto-shutter


```
capture/
  contracts/   input, result, guidance VM, reason codes, versions, semantics, truth
  policy/      readiness thresholds, priority, hold window
  evaluation/  pure evaluator, stability history, latch
  mapping/     Arabic guidance mapper
  adapters/    MediaPipe / FaceGate → input (optional bridge)
  capture.dart barrel
```
No second Face Intelligence engine.
