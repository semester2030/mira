# تصنيف أقنعة المزود — Face Explorer

التاريخ: 2026-09-17  
المصدر في الشيفرة: `lib/features/results_experience/domain/perfect_mask_data_kind_contract.dart`  
السلطة المذكورة في العقد: مخزون Perfect HD (`FULL_HD_CAPABILITY_MATRIX` / input spec للحساب) — هذه الوثيقة تلخّص ما يضمنه الكود فعلًا.

## مبدأ التصنيف

- التصنيف يعتمد على `PerfectMaskArtifact.concernType` + وجود بايتات القناع + المنطقة المطلوبة، **وليس** على اسم العرض للمستهلك وحده.
- لا تُختَرع هندسة من الدرجة العامة أو من إضاءة الصورة.
- عند طلب منطقة فرعية بلا قناع مزود مطابق: `regionMaskAbsent` — **ممنوع** استبدال قناع الوجه كاملًا.

## عائلات الرسم (`PerfectMaskContractFamily`)

| العائلة | المعنى المكاني | أمثلة مزود |
|---|---|---|
| `sparsePoints` | نقاط/آفات مكتشفة | `hd_age_spot`, `hd_pore`, `hd_acne`, … |
| `sparsePaths` | مسارات رفيعة | `hd_wrinkle` |
| `areaIntensity` | تغطية/شدة مساحية | `hd_oiliness`, `hd_moisture`, `hd_redness`, … |
| `measurementZone` | حدود منطقة قياس فقط — ليست نتائج اكتشاف | `hd_skin_type` |
| `scoreBearing` / `notSpatial` | درجة بلا قناع مكاني صالح | حسب الصف |

## أنواع البيانات المعروضة (`PerfectMaskMapDataKind`)

| النوع | متى يظهر |
|---|---|
| `discoveredPoints` | عائلة نقاط + بايتات |
| `discoveredPaths` | عائلة مسارات + بايتات |
| `intensityAreaMask` | عائلة شدة مساحية + بايتات |
| `measurementRegionBoundary` | عائلة منطقة قياس + بايتات |
| `scoreOnly` | درجة بلا بايتات قناع صالحة |
| `regionMaskAbsent` | المنطقة المطلوبة بلا قناع مطابق |
| `unavailable` | لا نتيجة صالحة |
| `undetermined` | بايتات موجودة لكن النوع خارج الجدول الموثّق |

## ما لا تثبته هذه الوثيقة وحدها

- لا تثبت أن قناع التجاعيد خالٍ من حدود المناطق في بكسلات محاولة معيّنة — ذلك يحتاج مقارنة مصدر + خام + محوّل + لقطة جهاز لنفس المحاولة.
- لا تعلن اكتمال وضوح الخرائط؛ العتبات تُعايَر بعد جمع ZIP الأدلة من الجهاز.

## ربط التصدير

`FaceMapSessionEvidenceExporter` يكتب لكل من `oiliness` / `wrinkles` / `pores`: القناع الخام، القناع بعد تحويل العرض، وبصمات SHA، وحقل `dataKind` / `contractFamily` في `MANIFEST.json`.
