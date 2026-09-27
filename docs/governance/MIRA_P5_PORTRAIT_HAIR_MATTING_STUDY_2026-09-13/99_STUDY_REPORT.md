# MIRA — Portrait / Hair Matting Technology Selection
Task: `MIRA-P5-PORTRAIT-HAIR-MATTING-STUDY-2026-09-13`  
Mode: STUDY ONLY — no implementation, no packages, no Perfect/UI changes.

---

## 0. Executive verdict

| Field | Value |
|---|---|
| STATUS | COMPLETE |
| EXISTING MIRA MATTING | NO |
| EXISTING PERFECT CAPABILITY | SOD Background Removal API exists (`POST /s2s/v2.0/task/sod`) — **NOT** used by Skin HD path today; raw alpha contract **UNKNOWN** (docs say “foreground image”); hair VTO/detection ≠ matte |
| BEST ON-DEVICE | Apple Vision `VNGeneratePersonSegmentationRequest` (`.accurate`) ± iOS 17+ soft scaled mask APIs |
| BEST CLOUD | Photoroom Remove Background API (hair-focused community ranking) **or** remove.bg (mature hair edges); Perfect SOD if subscription units already include it |
| BEST OVERALL | **E — HYBRID**: Apple Person Segmentation Accurate first; cloud/Perfect SOD only if black-BG curly-hair POC fails Apple |
| HAIR QUALITY (expected) | PARTIAL (Apple) → GOOD/EXCELLENT only after POC |
| BLACK BG QUALITY | PARTIAL until POC (black exposes halo) |
| PERFECT MASK ALIGNMENT | REQUIRES POC (design preserves YES if matte = same pixel grid as original) |
| PERSISTENT FACE STORAGE | NO (ephemeral matte only) |
| POC REQUIRED | YES |
| IMPLEMENTATION | NOT STARTED |

---

## 1. Existing MIRA audit (STEP 2)

### Verdict: NO usable portrait/hair alpha matte

| Area | Finding |
|---|---|
| Perfect HD Skin | Concern overlays only (`hd_*` in `perfect-hd-mask.types.ts`). `resize_image` = opaque JPEG. `all` = score-only. |
| Perfect in MIRA | No SOD / bg-remove / person matte call in Skin pipeline |
| MediaPipe | Face mesh landmarks only (`mediapipe_face_mesh`) |
| ML Kit | Face detection + pose — **no** selfie segmentation package |
| pubspec | No matting / RMBG / MODNet / BiRefNet packages |
| Oval / faceOval | Geometric capture UX — **forbidden** as product matte |
| FASHN | Outfit garment BG-remove — wrong domain |
| Beauty `face_mask` / `hair_mask` | Capability **labels** only — no runtime producer |

**Missing capability name:** `portrait_head_subject_alpha_matte`

---

## 2. Perfect Corp findings (STEP 5)

### What exists (public docs)
| API | Role | Matte? |
|---|---|---|
| `POST /s2s/v2.0/task/sod` | AI Photo Background Removal | Output = “foreground image”; separate raw alpha **not documented** |
| `task/bg-replace` | Background change / replace | Composited result, not Skin-aligned matte pipeline |
| Hair type / density / color / length | Diagnostics + VTO | **Not** segmentation matte |
| HD Skin actions | Concern masks | Not subject isolation |

### Units / cost (official docs)
- Background Removal V1.0: **1 unit** per successful task  
- Subscription inclusion for MIRA’s current Perfect account: **UNKNOWN** (do not purchase; owner must confirm units entitlement)

### Privacy
- Requires file upload to Perfect (`yce-api-01.makeupar.com`)
- Conflict with prefer-on-device; acceptable only if quality wins POC and retention remains ephemeral

### Fit for MIRA Skin
- **Pros:** Same vendor; people-oriented SOD; 1 unit
- **Cons:** Cloud; alpha contract unclear; may re-encode geometry; must verify pixel-grid identity vs Perfect HD source
- **Verdict for now:** Strong **POC candidate #2**, not “already available in Skin”

---

## 3. Apple findings (STEP 4)

| API | iOS | Output | Hair notes |
|---|---|---|---|
| `VNGeneratePersonSegmentationRequest` | 15+ | Soft person mask; `.accurate` includes matting refinement | Best Apple **person** path; not proven Beauty-grade curly hair on pure black |
| `VNGeneratePersonInstanceMaskRequest` | 17+ | Per-person instance | Useful multi-person; overkill for Skin selfie |
| `VNGenerateForegroundInstanceMaskRequest` | 17+ | Soft class-agnostic subject mask + `generateScaledMaskForImage` | Apple ML research cites content-aware upsampling for hair/fur; still **needs POC on black** |
| AVCapture Portrait / semantic hair matte | Capture-time | Hair/skin/teeth mattes | **Only if captured in Portrait pipeline** — does **not** apply to existing Skin JPEG already analyzed by Perfect |

### Latency / privacy / Flutter
- On-device, offline, no upload → **best privacy fit**
- Latency: typically tens–low hundreds of ms on modern iPhones for stills (estimate; measure in POC)
- Flutter: **native iOS plugin / MethodChannel** required (no first-party Flutter API)
- Android: **no Apple path** → needs parallel plan (ML Kit Selfie Segmentation = weaker hair, or cloud)

### Verdict
**Best on-device option** and **first POC**. Do **not** claim EXCELLENT hair without black-BG curly-hair proof.

---

## 4. Other on-device / models (STEP 3B)

| Candidate | Notes | Hair on black | Flutter fit |
|---|---|---|---|
| MODNet | Portrait matting, lightweight | Historically good hair; random GitHub integration risk | Custom CoreML/ONNX bridge |
| RVM (Robust Video Matting) | CoreML MobileNetV3 exists | Video-oriented; still usable for stills | CoreML + bridge |
| BiRefNet Portrait | Strong matting research | Often GPU/server (TensorRT) — poor phone fit | Poor as-is |
| ML Kit Selfie Segmentation | Easy Android/iOS | Typically **PARTIAL** hair — likely FAIL black+curly | Easy Flutter |

**Do not** adopt first pub.dev “background_remover” without Beauty POC.

---

## 5. Cloud / API (STEP 3D)

| Candidate | Evidence | Cost (public) | Privacy |
|---|---|---|---|
| Photoroom Remove BG API | 2025 community arena ~9k votes — ranked high on hair/strands | Official: **$0.02**/call Basic; 10 free credits/mo | Upload |
| remove.bg API | Mature hair/fur reputation | Free preview quota; paid credits (~**$0.20**/image commonly cited — confirm on remove.bg pricing) | Upload |
| Perfect SOD | Same ecosystem | **1 Perfect unit** | Upload |

Cloud is **quality insurance**, not first privacy choice.

---

## 6. Comparison matrix

| Candidate | Hair | Alpha | Black BG | On-device | Privacy | Speed | Flutter Fit | Cost | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| MIRA existing | POOR | POOR | POOR | N/A | EXCELLENT | N/A | N/A | 0 | REJECT |
| MediaPipe oval | POOR | POOR | POOR | YES | EXCELLENT | EXCELLENT | GOOD | 0 | REJECT (forbidden crop) |
| Apple PersonSeg `.accurate` | PARTIAL→? | GOOD | PARTIAL→? | YES | EXCELLENT | GOOD | PARTIAL (native) | 0 | **POC #1** |
| Apple ForegroundInstanceMask | PARTIAL→? | GOOD | PARTIAL→? | YES | EXCELLENT | GOOD | PARTIAL | 0 | POC alt |
| Perfect SOD | UNKNOWN | UNKNOWN | UNKNOWN | NO | PARTIAL | GOOD | GOOD (existing Dio) | 1 unit | **POC #2** |
| Photoroom API | GOOD* | GOOD* | GOOD* | NO | PARTIAL | GOOD | GOOD | ~$0.02 | **POC #3 / fallback** |
| remove.bg API | GOOD* | GOOD* | GOOD* | NO | PARTIAL | GOOD | GOOD | ~$0.20 | Fallback |
| MODNet / RVM CoreML | GOOD* | GOOD* | PARTIAL→? | YES | EXCELLENT | GOOD | PARTIAL | eng cost | POC if Apple fails |
| ML Kit Selfie Seg | PARTIAL | PARTIAL | POOR→PARTIAL | YES | EXCELLENT | EXCELLENT | GOOD | 0 | Likely FAIL Beauty |
| BiRefNet on phone | UNKNOWN | GOOD | UNKNOWN | POOR | EXCELLENT | POOR | POOR | eng cost | Not first |

\*Cloud ratings from public benchmarks — **not** MIRA curly-hair black-BG proof.

---

## 7. Shortlist (max 3)

1. **Apple `VNGeneratePersonSegmentationRequest` `.accurate`** (primary)
2. **Perfect `task/sod`** (same vendor; confirm units + alpha extractability)
3. **Photoroom Remove Background API** (hair-ranked cloud fallback)

### Preferred architecture: **E — HYBRID**

**Why not A:** Perfect matte not in current Skin path; SOD alpha contract unproven.  
**Why not B alone:** Apple may fail curly hair on pure black — P0 risk.  
**Why not C alone:** Custom CoreML without Apple baseline = premature.  
**Why not D alone:** Violates prefer-on-device / face upload when Apple may suffice.  
**Why E:** Privacy-first on-device with objective fail-over to Perfect SOD or Photoroom only when hair/black metrics fail.

---

## 8. Perfect mask alignment (STEP 8)

### Required compositing order (conceptual)

```
1) ORIGINAL_IMAGE (exact bytes / pixel grid used for Perfect HD analysis)
2) SUBJECT_ALPHA  (same W×H; inference may downscale internally then upsample alpha back)
3) BLACK_BG       = ORIGINAL * ALPHA  over  #000
4) PERFECT_MASK   = presentation tint via srcIn on Perfect alpha  (unchanged geometry)
```

### Hard rules
- No face warp/resize **after** Perfect analysis for display geometry
- Matte must be regenerated for the **same** ephemeral capture used by Perfect
- If matte model needs 512/1024 input: resize **for inference only**; map alpha back 1:1 to original
- `croppedToInstancesExtent: false` (Apple) to preserve coordinates

**PERFECT MASK ALIGNMENT PRESERVED:** design = YES; proof = REQUIRES POC

---

## 9. Privacy (STEP 9)

| Path | Face leaves device? | Persistent storage |
|---|---|---|
| Apple | NO | 0 (ephemeral matte in RAM) |
| Perfect SOD / Photoroom / remove.bg | YES (upload) | Must enforce delete/no DB — same Skin ephemeral policy |

Prefer Apple when quality gates pass.

---

## 10. Performance / cost (STEPS 10–11)

| Path | Latency (est.) | Binary | Cost |
|---|---|---|---|
| Apple | ~50–300ms still (measure) | OS-provided | $0 |
| Perfect SOD | network + engine | 0 model | 1 unit |
| Photoroom | network | 0 | $0.02/img (Basic, official page) |
| remove.bg | network | 0 | confirm live pricing; free preview limited |
| MODNet/RVM | tens–hundreds ms | +model size (MB–tens MB) | eng |

---

## 11. Canonical ownership (STEP 16) — future only

| Responsibility | Proposed single owner |
|---|---|
| Matte generation | `SubjectMatteSession` (new, **one**) — NOT a second Perfect client |
| Matte lifecycle | Ephemeral with Skin capture / AnalysisSession (parallel to PerfectMaskSession) |
| Composition | Extend `PerfectMaskOverlay` **or** thin compositor owned by Face Explorer only |
| Design tokens | Existing `SkinFaceMapVisualTokens` / `AppColors` |

ACTIVE DUPLICATE RESPONSIBILITIES target = 0.

---

## 12. POC plan (STEP 14) — do not run until owner authorizes

### Inputs (owner-authorized only)
1. Straight hair, light BG  
2. Curly/fine hair (owner), complex sofa/room  
3. Dark hair on dark BG  
4. Light hair / light BG  
5. Ears / jaw / chin close framing  

### Pipelines to score side-by-side
- A: Apple PersonSeg `.accurate`  
- B: Apple ForegroundInstanceMask (iOS 17+)  
- C: Perfect SOD (if units available)  
- D: Photoroom API  

### Composite each onto **pure black** + overlay one Perfect concern mask (e.g. pores) for alignment check.

### Objective metrics (STEP 15)
| Metric | Method | Pass bar (draft) |
|---|---|---|
| HAIR PRESERVATION | Manual strand checklist + optional FG recall on hair ROI | No scissor cut; strands visible |
| BACKGROUND LEAKAGE | % non-black pixels outside subject bbox after threshold | < 0.5% of BG area |
| HALO | Mean luminance ring 2–4px outside matte edge on black | Near 0; no white/gray ring |
| JAGGED EDGE | Edge length / smoothness proxy | No blocky stair on jaw |
| FACE/JAW/EAR | Checklist | Chin+ears intact |
| PERFECT ALIGNMENT | Overlay Perfect mask; check offset vs unmated | Pixel offset = 0 |
| LATENCY | p50/p95 on physical iPhone | Interactive (target p50 < 500ms on-device) |
| MEMORY | Peak delta | No OOM; no persistent face files |

**Reject** if: halo on black, cut curly hair, sofa leak, Perfect mask shift.

---

## 13. Recommendation letter

**RECOMMENDATION: E — HYBRID**

1. **POC #1 (mandatory):** Apple Person Segmentation Accurate on owner curly-hair images → pure black.  
2. **If FAIL hair/black:** POC Perfect SOD (confirm unit entitlement + whether alpha can be derived without geometry drift).  
3. **If still FAIL or no Perfect units:** Photoroom API as presentation-only ephemeral matte (privacy review required).  
4. **Custom CoreML (MODNet/RVM)** only if commercial/Apple paths fail Beauty gate.  
5. **Never** ship oval crop or generic ML Kit selfie seg as Beauty final.

IMPLEMENTATION: **NOT STARTED** — awaiting owner review of this study.
