# Phase 9A — Mirror Orientation Policy

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — READ ONLY Discovery + Architecture Lock  
**Date:** 2026-08-11  


## Current
Front camera preview + captured review use `Transform.flip(flipX: true)` so preview matches review (`FaceCapturePanel`).
Mesh mapping uses `mirrorPreview` flag.

## Risk
Asymmetry metrics / left-right labels can confuse if result overlay coordinate space disagrees with mirrored photo.

## Decision gate D3
Product must choose: keep mirrored experience consistently, or unmirror after capture with remapped coordinates.
**No accidental L/R inversion.**
