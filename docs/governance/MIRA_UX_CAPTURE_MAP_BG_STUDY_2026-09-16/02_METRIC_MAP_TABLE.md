# 02 — جدول المؤشرات (مصحَّح قطبية الدرجات 2026-09-17)

**عقد Perfect في Face Explorer:** `ui_score` / `uiScore` ∈ 0–100 و**الأعلى أفضل** (صحة المؤشر).  
**الشدة (أعلى = احتياج أوضح)** تظهر فقط بعد تحويل صريح `severity = 100 − ui` في مسار نتائج العناية — **ليس** الرقم الافتراضي على الخريطة.

التتبّع الكامل: `evidence/score_polarity_trace.md`.

| مؤشر مستهلك | Perfect type | الرقم المعروض في Face Explorer | معنى ارتفاع الرقم المعروض | قناع مكاني | أسلوب العرض | لون (`AppColors`) |
|-------------|--------------|----------------------------------|---------------------------|------------|-------------|-------------------|
| pigmentation | `hd_age_spot` | `uiScore` (wellness) | أفضل | نقاط إن وُجد قناع | luminanceGate | `analysisPigmentation` |
| pores | `hd_pore` | `uiScore` | أفضل | نقاط | luminanceGate | `analysisPores` |
| wrinkles | `hd_wrinkle` | `uiScore` | أفضل | خطوط | wrinkles profile | `analysisWrinkles` |
| redness | `hd_redness` | `uiScore` | أفضل | منطقة أو scoreOnly | قناع أو درجة | `analysisRedness` |
| texture | `hd_texture` | `uiScore` | أفضل | منطقة إن وُجد | texture profile | `analysisTexture` |
| acne | `hd_acne` | `uiScore` | أفضل | نقاط/آفات | acne profile | `analysisAcne` |
| hydration | `hd_moisture` | `uiScore` | أفضل | منطقة إن وُجد | hydration / درجة | `analysisHydration` |
| oiliness | `hd_oiliness` | `uiScore` | أفضل | منطقة | oiliness profile | `analysisOil` |
| radiance | `hd_radiance` | `uiScore` | أفضل | غالباً scoreOnly | درجة فقط إن لا قناع | `primary` |
| dark_circle | `hd_dark_circle` | `uiScore` | أفضل | منطقة أو درجة | — | قريب من pigmentation |
| eye_bag | `hd_eye_bag` | `uiScore` | أفضل | منطقة أو درجة | — | — |
| droopy_* | eyelids | `uiScore` | أفضل | منطقة أو درجة | — | — |
| firmness | `hd_firmness` | `uiScore` | أفضل | قناع أو scoreOnly | لا اختراع | — |
| tear_trough | `hd_tear_trough` | `uiScore` | أفضل | منطقة أو درجة | — | — |

`raw_score`: يُحفظ للتشخيص؛ لا يُفسَّر كشدة في الواجهة.

### مثال

`hd_acne.ui_score = 72` → الخريطة تعرض **72** + «مستوى جيد» + «الأعلى أفضل».  
الشدة **28** تظهر فقط إن استُدعي `wellnessUiToSeverity(72)` في بطاقة نتائج منفصلة.

### قاعدة مكانية (دون تغيير)

قناع RGBA من Perfect فقط؛ `scoreOnly` → درجة بلا خريطة تخمينية.
