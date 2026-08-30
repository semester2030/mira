# Fashion Advice Capability — Executive Summary

**Date:** 2026-08-10  
**Mode:** READ-ONLY technical discovery  
**Verdict:** **C — A NEW FASHION KNOWLEDGE LAYER IS REQUIRED WITHOUT REOPENING FROZEN INTELLIGENCE**

## One-line finding
Mira has frozen Garment / Outfit / Styling / Wardrobe engines plus Flutter catalog heuristics and an LLM consultation path, but **does not have a curated, provenance-backed Fashion Knowledge Base** that can explain *why* red+yellow is bold for a wedding or safely recommend beige alternatives from structured rules.

## What exists (production-relevant)
1. **Garment Intelligence (frozen):** category, colors[], material, fit, optional pattern/season — `CanonicalGarment`.
2. **Outfit Intelligence (frozen engines):** slot compatibility, simple color-stem clashes, palette-size harmony, occasion mapping, layering — **not wired** into `POST /ai/vision/outfit/analyze` (returns garments only).
3. **Styling Intelligence (frozen):** evidence-only decisions (Law #32); **no styling-principle knowledge library**.
4. **Flutter parallel stack:** color-wheel theory, catalog `compatibility.json`, `knowledge_graph.json` (SKU edges), occasion UI.
5. **Advisor:** Beauty Advisor = Law #33/#34 grounded (cannot invent). **MCE consultation LLM** = soft grounding; **can invent** piece/color swaps.

## What does not exist
- FashionRule condition/recommendation/source/approval model for domain styling knowledge
- Provenance for styling principles (book/stylist/research)
- Dedicated dress-code evaluator beyond formality scalars + occasion id
- Dedicated shoe/bag/jewelry harmony engines on Nest OI
- Conflict resolution between convention vs user bold preference with citeable rules

## Recommendation
Additive **Fashion Knowledge Layer** consuming frozen GI/OI evidence + emitting citeable advice units for Advisor Envelope — **do not reopen** GI/OI/SI cores.
