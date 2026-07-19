# Face Intelligence Architecture Lock

**Status:** LOCKED · Discovery only · No implementation  
**Program:** Mira Premium Transformation  
**Pre-phase:** Final architecture gate before Phase 4A  
**Unified theme law:** Any future UI must use `AppColors` / `AppTypography` / `Premium*` / `MiraAppBar`

Portal: [mira-production-transformation-program.html#face-arch-lock](../mira-production-transformation-program.html#face-arch-lock)

---

## Verdict

Capture + MediaPipe + ML Kit + Skin Face Health Map exist.  
Measured Face Intelligence (ratios · thirds · symmetry · face shape) does **not**.  
Build as a **sibling** to Skin Intelligence — never overload `FaceHealthMap`.

---

## Canonical pipeline (target)

```
Capture → Capture Quality → Face Presence → Landmark Extraction
  → Measurement Eligibility → Face Geometry → Feature Analysis
  → Face Intelligence → Recommendations → Face Report → DTO → Flutter
```

## Phase breakdown

| Phase | Name | Scope |
|-------|------|--------|
| **4A** | Face Foundation | Landmark export boundary, eligibility, canonical skeleton, unavailable when unsafe |
| **4B** | Geometry | Ratios · thirds · cautious symmetry + formulas + tests |
| **4C** | Facial Features | Face-shape + feature findings |
| **4D** | Recommendations | Evidence-backed styling reco |
| **4E** | Report | Sibling DTO + Flutter section (theme-unified) |
| **4F** | Validation | Contracts, goldens, audits, deprecations |

## Engineering laws

1. No duplicate without evidence  
2. Reuse before create  
3. One concept → one owner  
4. No parallel production pipelines  
5. One source of truth for thresholds, landmarks, formulas, versions  

## Forbidden

- Second MediaPipe / FaceGate / threshold pack  
- Attractiveness score  
- Perfect Corp as Face Intel source  
- Mixing Face Intel into Skin SVI / skin-intelligence package  
- Off-theme UI  

Full matrix, owners, graphs, and file lists: see portal section `#face-arch-lock`.
