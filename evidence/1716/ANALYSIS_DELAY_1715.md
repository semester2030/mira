# تحقيق تأخير 1715 — قبل إصلاح 1716

## أ) ملف مكتمل محليًا `71062d9e-…`

من `device_1715_from_first.txt`:

| وقت | حدث |
|---|---|
| 11:50:45.118 | audio_cut → 71062d9e |
| 11:50:45.127–45.483 | LOCK hold ≈**356ms** (`finalizePartIfComplete` / فحص اكتمال) |
| resolveMs=**357** | `peekResolve` محلي — ليس شبكة (`CACHE source=disk dl=0`) |
| initDone=521 playStart=522 | تهيئة مشغّل ملف ~40MB |
| 11:50:45.768 | seek_nudge_req targetMs=32 |
| 11:50:46.130 | **FF=1011 قبل seek_nudge_done** و`seekDone=null` |

**الخلاصة:** التأخير ليس إنترنت. ~357ms بحث/تحقق محلي تحت القفل + تهيئة. رقم 1011 ملوّث بسباق seek (الموضع 32 احتُسب تقدمًا). 1716: حراسة seek قبل await + تخطي finalize عند وجود complete موثوق + `peekResolveMs`.

## ب) جزئيات `9cbed24c` / `4cca7f2f` / `6e153366`

| mediaId | network_to_disk | ملاحظة |
|---|---|---|
| 9cbed24c | 3461ms | prefix_kick ثم قفل أثناء مغادرة سريعة |
| 4cca7f2f | 5309ms | كذلك |
| 6e153366 | 6359ms | كذلك |

**السلسلة المثبتة:**  
`resolvePlaySource` (proxy) → AVPlayer Range → `_handleProxyRequest` → `_kickFill` → **`ensureLocal` كامل** رغم وصف «تأجيل التحميل الكامل».  
أزمنة 3.5–6.4s = تنزيل بادئة/جسم تحت القفل، وليست أزمنة ظهور شاشة. المحاولات غُادرت قبل FF في عدة حالات.

**إصلاح 1716:** `_kickFill` → `ensurePlayablePrefix` محدود السقف فقط؛ التحميل الكامل يبقى عبر `prefetch` بعد تقدم الموضع.

## ج) قياس seek / صوت

محاولات FF قبل seek_nudge_done: `1795002645127354`, `1795002653593371`, `1795002663123314`.  
unmute مزدوج: `1795002658598963`.
