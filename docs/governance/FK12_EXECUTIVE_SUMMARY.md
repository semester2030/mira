# FK-12 — Executive Summary

## Verdict
**A — FK-12 REMEDIATION COMPLETED · READY FOR FK-13 INDEPENDENT RE-AUDIT**

## Authority
FK-11 Independent Audit Verdict **C — NOT APPROVED FOR PRODUCTION FREEZE** (preserved; not rewritten).

## What FK-12 fixed
FK-11 showed Fashion Knowledge library was largely sound, but `/advisor/chat` did **not** invoke `runFashionKnowledgeAdvisorBridge`. Flag ON returned `projectNoKnowledge` stub; flag OFF left MCE able to prescribe fashion.

FK-12 wires the real production path:
`POST /advisor/chat` → `AdvisorController` → `AdvisorService.chat` → `resolveFashionEvidenceForAdvisorChat` → Fashion Knowledge bridge (Mode A → Mode B) → Claim Lock → envelope projection → BeautyAdvisor narration.

## Release
`0.9.1-fashion-knowledge-production-wiring-remediation`  
Frozen Advisor remains `1.0.0-beauty-advisor`. Fashion Knowledge was **not** v1.0.0 at FK-12 close.

> **FK-14 update:** Platform later frozen as `1.0.0-fashion-knowledge` (`MIRA-FK-FREEZE-1.0.0`) under FK-13 verdict **B** — Platform Freeze with activation dependencies. Historical FK-11 **C** / FK-12 / FK-13 records remain authoritative for their times.


## Policy choices
- **Integration-OFF:** Option A — global MCE fashion-prescriptive quarantine (legacy escape hatch default false).
- **ACTIVE curated rules:** still **0** (no fabrication).
- **Year-1 expected path when flags ON:** Mode A empty → Mode B UNCURATED → Claim Lock → qualified projection.

## Do not begin
FK-13 begins only after this remediation is accepted. Do not freeze as Fashion Knowledge v1.0.0 in FK-12.
