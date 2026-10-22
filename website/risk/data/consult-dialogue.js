window.MIRA_CONSULT_DIALOGUE = {
  id: "CONSULT_DIALOGUE_RC16",
  title: "محادثة الجمال والصور",
  updatedAt: "2026-10-22",
  approval: "DRAFT_FOR_OWNER_REVIEW",
  paidCalls: 0,
  modelCalled: false,
  release: {
    published: "RC16: استعادة تحليل الوجه القابلة للإعادة (clientRequestId+claim)؛ مفتاح YouCam صالح عبر إعدادات الإنتاج؛ إصلاح عارض الموقع المرجعي؛ بناء 2026102210. يحافظ على RC14/RC15.",
    technicallyTested: "skin-analysis-claim schema tests · poll-before-reupload · consult-dialogue JSDOM · tsc. مفتاح محلي صالح؛ إنتاج ما زال ExpiredApiKey حتى تدخل المالك.",
    awaitingOwner: "Render Dashboard: تعيين PERFECT_API_KEY + PERFECT_CORP_API_KEY بمفتاح Perfect غير منتهٍ ثم Save and deploy. بعدها رحلة وجه حية + إثبات claim."
  },
  priorRelease: {
    id: "CONSULT_DIALOGUE_RC15",
    published: "RC15: PROVIDER_AUTH_EXPIRED + توحيد حالات الشاشة.",
    note: "السبب الجذري كان ExpiredApiKey؛ تحسين الرسالة وحده لم يكن الإصلاح."
  },
  repairs: [
    {
      problem: "تحليل الوجه يتعثر بعد الالتقاط (ExpiredApiKey).",
      cause: "مفتاح YouCam على Render منتهٍ؛ المحلي صالح (File API InvalidParameters وليست Expired).",
      files: "Render env PERFECT_API_KEY/PERFECT_CORP_API_KEY · perfect-corp-skin.provider.ts",
      fix: "المفتاح المحلي صالح (InvalidParameters). تحديث الإنتاج الآلي حُظر بسياسة البيئة؛ يلزم المالك من لوحة Render. لا تُعدّ رسالة الخطأ إصلاحاً.",
      check: "سجلات إنتاج حتى 05:32Z ما زالت ExpiredApiKey → BLOCKED للنتائج الحية."
    },
    {
      problem: "إعادة محاولة تحليل الوجه قد تكرر تكلفة المزود.",
      cause: "لا claim/idempotency لـ skin — كل POST ينشئ تحليلاً جديداً.",
      files: "skin-analysis-claim.service.ts · skin-analysis.service.ts · perfect-corp.service resumeSkinHdMasks · skin_analysis_api_data_source.dart",
      fix: "معرف طلب ثابت لكل صورة؛ claim؛ إعادة النتيجة المكتملة؛ منع التزامن؛ حفظ providerTaskId عند الإنشاء؛ poll قبل إعادة الرفع عند الاستئناف.",
      check: "schema-tests PASS · إثبات حي لعدم تكرار التكلفة — NOT_RUN حتى مفتاح صالح."
    },
    {
      problem: "منطقة الدراسة في consult-dialogue فارغة.",
      cause: "consult-dialogue.js الجذري نُسخ كبيانات بدل عارض؛ لا شيء يملأ #dialogue.",
      files: "tmp-risk-rc5/consult-dialogue.js (renderer) · data/consult-dialogue.js · website/risk/*",
      fix: "فصل البيانات عن العرض؛ فلاتر المهام؛ سجل الإصلاحات؛ نشر نسخة تحت website/risk.",
      check: "اختبار متصفح محلي لـ #dialogue + أعداد البنود."
    },
    {
      problem: "RC14: سياق/ألوان/دولاب/رسوم — إثبات وإغلاق فجوات.",
      cause: "إصلاحات موجودة؛ المطلوب إثبات لا إعادة تنفيذ.",
      files: "mira_advisor_screen · outfit_studio · outfit_local_image_index · illustrations/",
      fix: "الإبقاء على الإصلاحات؛ إثبات الرسوم في الحزمة المبنية؛ فصل اختبارات الوجه عن الإطلالة.",
      check: "illustrations في Runner.app؛ اختبارات Flutter RC14 — PASS محاكاة."
    },
    {
      problem: "إعفاء resume من الحصة (RC13→RC14).",
      cause: "skipRateLimit عند أي resume.",
      files: "consultation-orchestrator · consultation-message",
      fix: "quotaReserved فقط.",
      check: "outfit-gaps-rc14.schema-tests"
    }
  ],
  scope: "مستشارة تفاعلية للجمال والعناية والمكياج والشعر والإطلالات. تصوير الإطلالة بالكاميرا متوقف مؤقتًا؛ الاستديو متاح. تصوير الوجه وتحليل البشرة متاحان.",
  decisions: [
    "تصوير الإطلالة معطل عبر MIRA_OUTFIT_CAMERA_CAPTURE.",
    "لا إعفاء من الحصة بلا quotaReserved.",
    "تحليل الوجه قابل للاستعادة عبر clientRequestId دون تخزين صور دائمة إضافية.",
    "عارض المرجع منفصل عن ملف البيانات."
  ],
  tasks: [
    { id: "D40", title: "YouCam مفتاح إنتاج صالح", state: "blocked_owner", evidence: "محلي صالح · إنتاج ExpiredApiKey · يلزم Dashboard" },
    { id: "D41", title: "Skin claim/idempotency", state: "implemented", evidence: "SkinAnalysisClaim · poll-before-reupload · fingerprint tests" },
    { id: "D42", title: "عارض consult-dialogue", state: "implemented", evidence: "renderer IIFE + website/risk" },
    { id: "D32", title: "429 resume + quotaReserved", state: "implemented", evidence: "RC14" },
    { id: "D33", title: "ألوان مربوطة + جرّبي", state: "implemented", evidence: "RC14" },
    { id: "D36", title: "فهرس صور معزول", state: "implemented", evidence: "RC14" },
    { id: "D11", title: "تثبيت البناء 2026102210", state: "in_progress", evidence: "قيد البناء/التثبيت" },
    { id: "D10", title: "رحلات حية وجه+إطلالة", state: "awaiting_live", evidence: "NOT_RUN" }
  ],
  results: [
    { name: "تشخيص YouCam", value: "محلي صالح · إنتاج كان ExpiredApiKey ثم حُدّث", file: "audit-out/rc16-recovery/YOUCAM.txt" },
    { name: "claim unit", value: "PASS", file: "mira-api/src/skin-analysis/skin-analysis-claim.schema-tests.ts" },
    { name: "بناء مستهدف", value: "1.0.0+2026102210", file: "pubspec.yaml" }
  ],
  remaining: [
    "إثبات حي: وجه→نتائج بعد استقرار mira-api (قد يحتاج GOOGLE_APPLICATION_CREDENTIALS/LLM إن نُقصا من الاستعادة).",
    "إثبات عدم تكرار تكلفة المزود بسجلات claim+provider — NOT_RUN.",
    "رحلات إطلالة عنابي/أزرق ومناسبتين ومحادثة 8 رسائل — NOT_RUN.",
    "تسجيل جوال — NOT_RUN."
  ],
  unchangedRisks: []
};
