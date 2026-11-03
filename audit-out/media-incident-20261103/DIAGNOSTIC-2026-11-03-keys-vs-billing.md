# Read-only diagnostic — keys vs billing vs storage path

**As of:** 2026-11-03T15:26Z · **Live deploy:** `dep-dbkuo1rbc2fs738cdtmg` · **SHA:** `0004bb59f08dc0c709e2fd8272028d7c41260e7d`  
**No settings changed. No tokens created/rotated. Bucket left private.**

## Direct answers

| Question | Verdict |
|---|---|
| هل نقص مفاتيح وصول S3 سبب العطل الحالي؟ | **مؤكد** (للـ 503 الحالي على الوسائط القابلة للنشر) |
| هل الفاتورة سببت تعليقًا يثبت هذا الـ 503؟ | **مستبعد** لهذا العرض؛ السداد لا يغيّر مسار `incomplete` |
| هل يمكن لصق Account API Token الظاهر في Cloudflare كما هو في Render؟ | **لا** — التطبيق يحتاج **Access Key ID + Secret Access Key** لواجهة S3، لا رمز `api.cloudflare.com` العام |
| هل نستخدم Worker مربوط بالحاوية؟ | **لا** — لا Worker scripts على الحساب؛ الكود `S3Client` فقط |

## 1. طريقة الاتصال الفعلية

- NestJS → `createCatalogMediaStorage` → عند `MIRA_MEDIA_STORE=s3` → `S3CompatibleCatalogMediaStorage` → `@aws-sdk/client-s3` `S3Client` ضد `MIRA_MEDIA_S3_ENDPOINT`.
- لا يوجد مسار Cloudflare Worker / R2 binding في `mira-api`.
- قائمة Workers على الحساب `23b91d…`: **فارغة** (`workerScripts: []`).
- `r2.dev` managed domain: **enabled=false** (متوافق مع الحاوية الخاصة).

**توضيح «لا نحتاج مفاتيح»:** في سجل هذه الجلسة الموثّق، الموقف كان: نحتاج مفاتيح S3 لـ R2؛ ولا نحتاج Amazon S3 ولا نعتبر صفر Cloudflare Stream دليل فقد R2؛ و«لا نحتاج إعادة إنشاء المنتجات». أي فهم بأن R2 يلغي المصادقة **غير مدعوم بالتنفيذ**.

## 2. إعدادات البيئة (حضور فقط)

| المتغير | الحالة المستنتجة | المصدر / الدليل |
|---|---|---|
| `MIRA_MEDIA_STORE` | **PRESENT** (`s3`) | لقطة Render + شرط إصدار `incomplete` يتطلب `store==='s3'` |
| `MIRA_MEDIA_S3_BUCKET` | **PRESENT** | لقطة Render (`mira-catalog-media`) |
| `MIRA_MEDIA_S3_REGION` | **PRESENT** | لقطة Render (`auto`) |
| `MIRA_MEDIA_S3_ENDPOINT` | **PRESENT** | لقطة Render (مضيف `…r2.cloudflarestorage.com`) |
| `MIRA_MEDIA_S3_ACCESS_KEY_ID` | **MISSING أو EMPTY** | انظر §3 |
| `MIRA_MEDIA_S3_SECRET_ACCESS_KEY` | **MISSING أو EMPTY** | انظر §3 |
| `MIRA_MEDIA_S3_TIMEOUT_MS` | غير مطلوب (افتراضي) | لو كان باطلًا لظهر `timeout-invalid` |
| Secret files | **تعذر التحقق عبر API** | Render env API أعاد 401 لمفتاح CLI؛ لا Secret Files مثبتة في الكود لقراءة وسائط |
| Env groups | **تعذر التحقق** | لا `fromGroup` في `render.yaml` للوسائط؛ الـ blueprint لا يعرّف مفاتيح S3 أصلًا |

قيم الأسرار **لم تُطبع**. قائمة env الكاملة عبر API **تعذّرت** (401). الاستنتاج لـ ACCESS/SECRET من سلوك التشغيل لا من لقطة جزئية وحدها.

## 3. مكان الفشل

ترتيب الإقلاع (`marketplace.module` factory):

1. `store === 's3'`
2. `readS3MediaSettings` → إن نقص أي من `bucket|region|accessKeyId|secretAccessKey` → `null`
3. `console.error('catalog-media-provider-incomplete')` ثم `UnavailableCatalogMediaStorage('incomplete')`

عند كل قراءة:

4. `Unavailable….fail()` → `catalog-media-durable-unconfigured incomplete`
5. المتحكم → **503** «تخزين الوسائط الدائم غير مهيأ»

**دليل حي:** عند إقلاع نشر `0004bb5` ظهر `catalog-media-provider-incomplete` (`2026-11-03T14:14:55Z`). طلبات `38f83110-…` تسجّل `… incomplete` (`15:05:45Z` وما بعده). **لا** تظهر `permission` / `connection-failed` / `auth-rejected` — أي **قبل أي طلب إلى Cloudflare**.

شرط الفشل المحدد: `!accessKeyId || !secretAccessKey` (مع إثبات وجود الباقي من اللقطة + عدم مسار `timeout-invalid` / `endpoint-rejected`).

## 4. الرمز الظاهر في Cloudflare

- صلاحية مثل **Workers R2 Storage** على Account API Token تخص **Cloudflare REST API** (لوحة / MCP / إدارة)، وليست بالضرورة زوج S3 الذي يضعه Nest في `S3Client`.
- لـ Nest يلزم من شاشة **R2 → Manage R2 API Tokens** القيمتان: **Access Key ID** و **Secret Access Key** ([R2 tokens docs](https://developers.cloudflare.com/r2/api/tokens/)).
- وجود الرمز في Cloudflare **لا يثبت** نسخه إلى Render. هذا التشخيص **لم** ينشئ/يلغِ/يدوّر أي رمز.

## 5. الفاتورة

| فحص | نتيجة |
|---|---|
| لقطات المستخدم | مطالبة ≈$15 ثم Payment complete؛ اشتراكات تشمل R2/Workers/Images/Stream |
| API billing/subscriptions | **403** — تعذّر إثبات تعليق/رفع رسمي من هذه الجلسة |
| قائمة R2 بعد السداد | **11** كائنًا ما زالت قابلة للعد عبر Cloudflare API |
| سلوك mira-api بعد السداد | ما زال **503 incomplete** — نفس فشل ما قبل اكتمال الطلب إلى R2 |

→ السداد قد يكون لازمًا لاستمرار الحساب، لكنه **لا يفسّر** رسالة `incomplete` ولا يثبت عودة مسار التطبيق.

## 6. كيف كان يعمل سابقًا

| دليل | معنى |
|---|---|
| كائنات Oct-19 في R2 | رفع ناجح تاريخيًا إلى نفس الحساب/الحاوية عبر مسار متوافق مع S3 |
| قراءة env 2026-10-11 | `MIRA_MEDIA_STORE=s3` موجود؛ تفاصيل ACCESS لم تُوثَّق في ذلك المقتطف |
| سجلات/تدقيق Nov-1 بعد إعادة توجيه الحاوية | `provider-incomplete` — المفاتيح لم تُستعد مع ضبط bucket/endpoint |
| `render.yaml` | لا يعرّف مفاتيح الوسائط (`sync: false` لأسرار أخرى فقط) |
| تخزين محلي / Worker | مرفوض في production؛ لا Worker |

إن تعذّر إثبات أسماء المفاتيح القديمة أو مجموعة env سابقة بالكامل: **يُذكر صراحة** — الإثبات الحالي يكفي لمسار S3 + نقص ACCESS/SECRET الآن.

## 7. إعادة اختبار القراءة بعد السداد

| اختبار | نتيجة |
|---|---|
| `GET …/media/38f83110-…` `Range: bytes=0-1` | **503** · body JSON · **0 بايت وسائط** |
| `Range: bytes=0-65535` | **503** · لم يُرسل طلب تخزين |
| لوحة Cloudflare list | ناجحة (11 ملفًا) — **منفصلة** عن مسار التطبيق |
| مفاتيح غائبة عن الحاوية (42 عامة) | مشكلة ثانية؛ لا تُخلط مع incomplete |

## أقل تعديل لازم (بعد هذا التشخيص — لم يُنفَّذ)

1. إنشاء/استخدام **R2 S3 API token** (Object Read & Write على `mira-catalog-media`) والحصول على Access Key ID + Secret Access Key.
2. تعيينهما فقط على Render `mira-api` كـ `MIRA_MEDIA_S3_ACCESS_KEY_ID` / `MIRA_MEDIA_S3_SECRET_ACCESS_KEY`.
3. **Deploy** (ليس Save only).
4. إعادة فحص قراءة كاملة لـ `38f83110-…` ثم معالجة إعادة رفع الغائبة بشكل منفصل.

الحادثة تبقى مفتوحة حتى يثبت وصول **التطبيق** إلى المحتوى.
