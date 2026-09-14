# FK-1 — Fashion Knowledge Architecture Executive Summary

**Date:** 2026-08-10  
**Program:** Mira Fashion Knowledge & Advice Program  
**Portal:** `docs/mira-fashion-knowledge.html` · أيقونة **✦ معرفة الأزياء**  
**Mode:** Architecture Lock only — no production code

## Decision
**B) ARCHITECTURE LOCK APPROVED — WITH REQUIRED PRE-IMPLEMENTATION DECISIONS**

## Locked shape
**Hybrid Fashion Knowledge Layer (Service)** — additive peer:
- Mode A: curated Mira rules (registry)
- Mode B: structured LLM drafts → Claim Lock only
- Emits `FashionAdviceCandidate` → Claim Lock → Advisor Envelope projection
- Consumes GI/OI evidence + occasion + SI prefs (read-only)
- Does **not** reopen GI / OI / SI / Advisor / Envelope cores

## Why not A/C/D alone
- Library-only insufficient for Claim Lock + telemetry + LLM adapter
- Full “Engine” naming reserved for frozen intelligence; Layer avoids ownership collision
- Knowledge Graph deferred as projection over rules (not primary store; not Flutter `knowledge_graph.json`)

## Pre-implementation decisions required before FK-2 coding
1. Envelope claim taxonomy for fashion advice (new claim ids vs `unknown`)
2. Whether OI public projection API is productized or FKL reads garments+occasion only at first
3. Initial registry storage = versioned JSON (confirm)
4. Arabic public tone pack ownership (presentation vs FKL)

## Explicit non-goals of FK-1
No implementation, no LLM wiring, no new production rules, no frozen edits.
