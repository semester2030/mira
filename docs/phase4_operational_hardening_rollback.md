# Phase 4 Operational Hardening — Rollback

## Scope added

- `FaceClientMirrorGate` + gated Flutter Face mirrors  
- Explicit `FaceIntelRuntimeState` / `faceIntelligenceRuntime`  
- Always-on `faceIntel` multipart with runtime  
- Health intelligence block  
- `test:face-operational-e2e`, `audit:face-eng-laws`, `smoke:face-intel`  
- Architecture docs under `docs/architecture/face_*.md`  

## Rollback

1. Revert Flutter gate asserts (or set `allowMirrorExecution=true` globally — not recommended).  
2. Restore optional `faceIntel` omit behavior in API datasource / quality gate.  
3. Remove `faceIntelligenceRuntime` from `MiraBeautyReport` (optional field — clients tolerate absence).  
4. Revert health controller intelligence block.  
5. Remove operational npm scripts.  

Skin analysis and Face Report engines (4A–4F algorithms) remain unchanged by this rollback.
