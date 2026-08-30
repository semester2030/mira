# ADR-FACE-001 — Hybrid Intelligent Mirror

**Status:** Accepted · Frozen in Face Analysis Experience v1.0.0 (`MIRA-FACE-EXPERIENCE-FREEZE-1.0.0`)  
**Date:** 2026-08-11

## Context
Face capture/result UX needed premium interactive mirrors without becoming a second Face Intelligence engine.

## Decision
Hybrid Intelligent Mirror: live guidance + decorative motion + projected results; analysis remains server Face Intelligence.

## Consequences
MediaPipe/ML Kit remain capture guidance inputs only. Semantic Face claims come from frozen FI output via projection.
