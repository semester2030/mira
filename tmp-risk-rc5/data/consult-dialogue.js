window.MIRA_CONSULT_DIALOGUE = {
  id: "CONSULT_DIALOGUE_RC14",
  title: "محادثة الجمال والصور",
  updatedAt: "2026-10-22",
  approval: "DRAFT_FOR_OWNER_REVIEW",
  paidCalls: 0,
  modelCalled: false,
  release: {
    published: "RC14: إلغاء إعفاء resume العام من 429؛ حجز حصة موثّق (quotaReserved)؛ سياق bindContext مع statedGoal؛ اقتراحات لونية بلا zip؛ جرّبي يتجاهل النتائج المتأخرة؛ فهرس صور معزول بالحساب؛ بناء 2026102208.",
    technicallyTested: "outfit-gaps-rc14.schema-tests · rc14/rc13 flutter tests. تثبيت الجهاز قيد المحاولة بعد إصلاح التوقيع.",
    awaitingOwner: "رحلات الفستانين و8 رسائل وتسجيل الجوال — NOT_RUN حتى ينجح التثبيت الموقَّع."
  },
  priorRelease: {
    id: "CONSULT_DIALOGUE_RC13",
    published: "RC13: illustrations في pubspec + تخطي rate-limit عند resume (أوسع من اللازم) + ربط ألوان أولي.",
    note: "RC13 أخطأ بإعفاء كل resume من الحصة؛ وعائق التثبيت كان 0xe8008014 على objective_c.framework وليس قفل الشاشة فقط."
  },
  repairs: [
    {
      problem: "إعفاء عام من حد الاستخدام عند claimStatus=resume يفتح ثغرة بعد 429.",
      cause: "RC13 جعل skipRateLimit = claimStatus==='resume' فأي طلب فشل بـ429 ثم أُعيد يتخطى الحصة بلا دليل حجز سابق.",
      files: "consultation-orchestrator.service.ts · consultation-message.service.ts",
      fix: "بعد اجتياز assertWithinLimit + dailyQuota يُحفظ quotaReserved=true في payloadJson؛ الاستئناف يتخطى الحصة فقط إذا quotaReserved===true. الطلب المكتمل يعيد الرد المحفوظ. fail_closed يبقى عند تعذر Redis.",
      check: "outfit-gaps-rc14.schema-tests.ts (محاكاة وحدات؛ ليس اختباراً حياً على Redis)."
    },
    {
      problem: "سياق المحادثة يعتمد بصمة الصورة / lastOutfit؛ bindContext يُبتلع.",
      cause: "mira_outfit_report_$fingerprint بلا مناسبة؛ catch فارغ على bind؛ البطاقة تعرض نقاشاً محلياً.",
      files: "mira_advisor_screen.dart · update-session-context.dto.ts · consultation-session.service.ts · consultation_api_data_source.dart",
      fix: "مفتاح تقرير fingerprint+occasion؛ bindContext يرسل statedGoalAr ويحفظ activeSnapshotId؛ فشل الربط يظهر في البطاقة ولا يُعرض كنجاح.",
      check: "تحليل الواجهة؛ اختبارات محلية."
    },
    {
      problem: "اقتراحات الألوان تربط recommendedColors[i] بـ accessoryPieces[i].",
      cause: "zip بالفهرس + dataBacked=true لوجود قطعة فقط.",
      files: "outfit_studio_screen.dart · outfit_garment_recolor_panel.dart",
      fix: "اقتراح فقط بدليل قطعة إكسسوار واحدة واضحة؛ اختيار اللون يحدّث القطعة معاً؛ أهلية التلوين للقطعة؛ جرّبي يصفّر اللون اليدوي والنتيجة عند بذرة جديدة ويتجاهل الاستجابات المتأخرة.",
      check: "تحليل الكود؛ اختبارات RC14."
    },
    {
      problem: "فهرس الصور يقرأ/يكتب مفاتيح عامة؛ التثبيت فشل بتوقيع objective_c.",
      cause: "fallback غير معزول؛ install أبلغ 0xe8008014 ApplicationVerificationFailed.",
      files: "outfit_local_image_index.dart · بناء iOS",
      fix: "قراءة scoped فقط؛ ترحيل legacy عند remember المطابق؛ رقم بناء 2026102208؛ إعادة توقيع عميق قبل التثبيت.",
      check: "codesign -dvvv بعد البناء؛ سجل device-install."
    }
  ],
  scope: "مستشارة تفاعلية للجمال والعناية والمكياج والشعر والإطلالات. تصوير الإطلالة بالكاميرا متوقف مؤقتًا، واختيار صور الاستديو هو المسار المتاح. تصوير الوجه وتحليل البشرة يبقيان متاحين.",
  decisions: [
    "تصوير الإطلالة بالكاميرا معطل مؤقتًا عبر MIRA_OUTFIT_CAMERA_CAPTURE.",
    "لا إعفاء من الحصة بلا quotaReserved محفوظ على الخادم.",
    "تغيير مناسبة النقاش لا يعدّل مناسبة التقرير الأصلي."
  ],
  tasks: [
    { id: "D32", title: "429 resume فقط مع حجز حصة موثّق", state: "implemented", evidence: "quotaReserved · outfit-gaps-rc14" },
    { id: "D33", title: "ألوان مربوطة + جرّبيه", state: "implemented", evidence: "studio + recolor requestGen" },
    { id: "D34", title: "دولاب المزيد/مقارنة", state: "implemented", evidence: "wardrobe epoch reload" },
    { id: "D35", title: "سياق bindContext + بطاقة الخادم", state: "implemented", evidence: "statedGoalAr · context card" },
    { id: "D36", title: "فهرس صور معزول بالحساب", state: "implemented", evidence: "outfit_local_image_index scoped-only read" },
    { id: "D11", title: "تثبيت البناء 2026102208 على الجهاز", state: "awaiting_device", evidence: "RC13 فشل 0xe8008014؛ RC14 يعيد التوقيع" },
    { id: "D10", title: "رحلات حية + تسجيل", state: "awaiting_live", evidence: "NOT_RUN" }
  ],
  results: [
    { name: "فحوصات RC14 quota", value: "8 نجحت (محاكاة)", file: "mira-api/src/consultation/outfit-gaps-rc14.schema-tests.ts" },
    { name: "Flutter RC14/RC13", value: "6 نجحت", file: "test/outfit_analysis/rc14_outfit_gaps_test.dart" },
    { name: "بناء التطبيق", value: "1.0.0+2026102208", file: "pubspec.yaml" }
  ],
  remaining: [
    "تثبيت موقَّع على الجوال وإثبات الرسوم العشر على الجهاز.",
    "رحلات الفستان العنابي/الأزرق الفاتح و8 رسائل — NOT_RUN.",
    "تسجيل جوال فعلي — NOT_RUN."
  ]
};
