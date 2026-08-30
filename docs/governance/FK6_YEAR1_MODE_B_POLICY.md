# FK-6 — Year-1 Mode B Policy

**Status:** FORMALIZED · 2026-08-10  
**Version:** `fashion-knowledge-year1-mode-b-v1`  
**Code:** `mira-api/src/fashion-knowledge/accessories/year1-mode-b-policy.ts`

## Purpose
Allow qualified, structured, uncurated LLM fashion guidance in Year-1 while proprietary curated Mode A knowledge is developed gradually.

## Allowed usage
- Structured fashion advice candidate drafts
- Shoes / bags / jewelry / accessory reasoning
- Color/occasion supporting guidance when facts exist
- Multiple qualified alternatives

## Prohibited usage
- Auto-promote to ACTIVE registry
- Waive Claim Lock
- Claim Mira curated truth from LLM alone
- Authoritative PASS merely because the LLM generated advice
- Shopping / SKU / brand / price
- Attractiveness or body judgments

## Forced classification
| Field | Value |
|-------|-------|
| sourceType | `llm_general_knowledge` |
| approvalStatus | `UNCURATED` |
| knowledgeType | `LLM_GENERAL_KNOWLEDGE` |
| default eligibility | `PASS_WITH_QUALIFICATION` |
| confidence | capped per FK-2/FK-3 |

## Requirements
- Claim Lock mandatory
- Telemetry readiness for FK-9 (stable ids; no full loop yet)
- Source-promotion prohibited
- Disable via `FASHION_KNOWLEDGE_LLM_ENABLED` / `FASHION_KNOWLEDGE_ACCESSORIES_ENABLED`

## Axioms (explicit)
1. **USER ACCEPTANCE ≠ DOMAIN TRUTH**
2. **LLM FREQUENCY ≠ DOMAIN TRUTH**
3. **POPULARITY ≠ DOMAIN TRUTH**

No Mode B output may become ACTIVE knowledge automatically.
