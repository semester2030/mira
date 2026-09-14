# AT-1 — Proposed Activation Phase Plan

## AT-2 — Production LLM Provider
Implement `FashionKnowledgeLlmPort` OpenAI adapter + register in `AdvisorModule`. Config from existing `LLM_*` (+ optional FKL overrides). Tests with real/sandbox key in QA only. Preserve fail-closed. **No flag enablement in prod.**

## AT-3 — Client Fashion Context & Path
1. Route fashion-prescriptive Ask Mira turns to `POST /advisor/chat` (or dedicated UX)  
2. Map OutfitAnalysis/GI facts → `AdvisorChatDto.fashion`  
3. Keep MCE for skin/non-fashion; fashion remains quarantined on MCE  
4. Defer telemetry consent unless enabling telemetry  

## AT-4 — Controlled QA Activation
Enable integration+LLM flags in QA/staging only; smoke matrix (structured draft, Arabic, false provenance, body, culture, timeout, red/yellow/wedding).

## AT-5 — Independent Activation Audit
Read-only re-audit of live QA path.

## AT-6 — Production Activation Certificate
Only after AT-5 pass + rollback verified.

## Explicit non-goals of AT-2/3
No curated rule population. No telemetry ON. No frozen redesign. No Render flag flip in AT-1/2 without AT-4.
