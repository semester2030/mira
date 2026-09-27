# تتبّع قطبية الدرجات — Perfect → ميرا → العرض

## 1) عقد المزود (YouCam / Perfect HD)

| حقل | المصدر | النطاق الموثّق في ميرا | الاتجاه المثبت |
|-----|--------|-------------------------|----------------|
| `ui_score` | استجابة YouCam لكل concern | 0–100 (التحقق في `perfect-corp.service.ts`: `0 ≤ ui_score ≤ 100`) | **أعلى = أصحّ / أفضل** — `skin-analysis-result.interface.ts`: «higher = healthier» |
| `raw_score` | نفس الاستجابة | رقمي من المزود (قد لا يكون 0–100) | يُحفظ كما هو؛ **لا يُعرض كشدة** في Face Explorer |
| parser | `perfect-hd-mask.parser.ts` | ينسخ `raw_score`/`ui_score` → `rawScore`/`uiScore` | **بدون قلب** |

لا يوجد في مسار الـ parser تحويل `100 - ui`.

## 2) مسار Face Explorer (خريطة البشرة)

```
YouCam ui_score
  → PerfectMaskArtifact.uiScore
  → _ActiveMetricHero(uiScore)
  → الرقم المعروض = uiScore.round()
  → الوصف = MetricPresentationPolicy.faceExplorerStatusAr(uiScore)
       ≥70 «مستوى جيد» · ≥40 «مستوى متوسط» · وإلا «يحتاج اهتمامًا»
  → تلميح ثابت: «الأعلى أفضل»
```

إثبات في الكود: `results_skin_map_panel.dart` تعليق  
`Face Explorer uiScore is Perfect wellness-style: higher = better (0–100).`

## 3) مسار نتائج العناية (منفصل) — تحويل شدة صريح

```
normalizedWellnessValue (= ui wellness 0–100)
  → ScoreSemanticsContract.wellnessUiToSeverity(ui) = 100 - ui
  → ResultScoreView(category: concernSeverity, higherWorse)
  → MetricPresentationPolicy.isSeverityPrimary → يعرض الشدة في بطاقات النتائج
```

هذا التحويل **مثبت وصريح** في `score_semantics_contract.dart` و`result_experience_projector.dart`.  
لا يجوز وصف `uiScore` في جدول الخريطة بأنه «شدة» دون ذكر هذا التحويل.

## 4) مثال رقمي واحد

| الخطوة | القيمة | المعنى الصحيح |
|--------|--------|----------------|
| YouCam `hd_acne.ui_score` | **72** | صحة/جودة المؤشر — أعلى أفضل |
| Face Explorer يعرض | **72** + «مستوى جيد» + «الأعلى أفضل» | لا شدة |
| إن مُرّر لنفس الرقم عبر `wellnessUiToSeverity` | **28** | مستوى احتياج (أعلى أسوأ) — فقط في بطاقة نتائج الشدة |
| خطأ الدراسة السابقة | تفسير 72 كـ «حبوب أوضح» | **مرفوض** بدون التحويل |

## 5) قاعدة للجداول والعرض

- عمود «معنى ارتفاع الدرجة» في خريطة Face Explorer = **ارتفاع ui_score = أفضل** لكل مؤشرات Perfect المعروضة هناك.
- إن أُريدت لغة «احتياج أوضح» يجب عرض ناتج `wellnessUiToSeverity` مع وسم اتجاه صريح — وليس رقم Perfect الخام.
- مؤشرات مثل الترطيب/الإشراق/التماسك تُعرض wellness؛ لا تُعكس.
