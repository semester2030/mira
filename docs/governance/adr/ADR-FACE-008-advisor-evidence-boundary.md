# ADR-FACE-008 — Advisor Evidence Boundary

**Status:** Accepted · Frozen in Face Analysis Experience v1.0.0 (`MIRA-FACE-EXPERIENCE-FREEZE-1.0.0`)  
**Date:** 2026-08-11

## Context
9L MAJOR-9L-01: client `publicFactAr`/`reasonAr` could be sealed as canonical.

## Decision
Client text is never canonical Face evidence. Server loads owned report, reconciles refs, projects stored fields into Envelope (Laws #33/#34).
