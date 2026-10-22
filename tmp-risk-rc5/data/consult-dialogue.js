window.MIRA_CONSULT_DIALOGUE = {
  id: "CONSULT_DIALOGUE_RC14",
  title: "محادثة الجمال والصور",
  updatedAt: "2026-10-22",
  approval: "DRAFT_FOR_OWNER_REVIEW",
  paidCalls: 0,
  modelCalled: false,
  release: {
    published: "RC14: إلغاء إعفاء resume العام من 429؛ حجز حصة موثّق (quotaReserved)؛ سياق bindContext مع statedGoal؛ اقتراحات لونية بلا zip؛ جرّبي يتجاهل النتائج المتأخرة؛ فهرس صور معزول بالحساب؛ بناء 2026102208 مثبّت على الجهاز؛ API live dep-dbcp24ss728c73aqtfo0 @ 95c8989.",
    technicallyTested: "outfit-gaps-rc14.schema-tests · rc14 flutter tests · flutter build ios release · codesign platform=2 · device install 2026102208 · Render live.",
    awaitingOwner: "رحلات الفستانين و8 رسائل وتسجيل الجوال التفاعلي — NOT_RUN (التثبيت نجح؛ الرحلات اليدوية بانتظار المالك)."
  },
  priorRelease: {
    id: "CONSULT_DIALOGUE_RC13",
    published: "RC13: illustrations في pubspec + تخطي rate-limit عند resume (أوسع من اللازم) + ربط ألوان أولي.",
    note: "RC13 أخطأ بإعفاء كل resume من الحصة؛ وعائق التثبيت كان 0xe8008014 على objective_c.framework (توقيع/منصة خاطئة من native-assets) وليس قفل الشاشة فقط. إصلاح RC14: flutter clean + إزالة كاش objective_c + بناء جهاز فقط؛ لا تُعد توقيع Runner.app بدون application-identifier."
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
      fix: "قراءة scoped فقط؛ ترحيل legacy عند remember المطابق؛ رقم بناء 2026102208؛ تنظيف كاش native-assets قبل بناء الجهاز؛ التحقق من platform=2 ووجود application-identifier دون إعادة توقيع تُفرّغ الاستحقاقات.",
      check: "device-install.txt · illustrations-count=10 · device apps 1.0.0/2026102208."
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
    { id: "D11", title: "تثبيت البناء 2026102208 على الجهاز", state: "done", evidence: "devicectl install + apps list 2026102208؛ 10 رسوم في Runner.app" },
    { id: "D10", title: "رحلات حية + تسجيل", state: "awaiting_live", evidence: "NOT_RUN" }
  ],
  results: [
    { name: "فحوصات RC14 quota", value: "8 نجحت (محاكاة)", file: "mira-api/src/consultation/outfit-gaps-rc14.schema-tests.ts" },
    { name: "Flutter RC14/RC13", value: "6 نجحت", file: "test/outfit_analysis/rc14_outfit_gaps_test.dart" },
    { name: "بناء التطبيق", value: "1.0.0+2026102208", file: "pubspec.yaml" },
    { name: "تثبيت الجهاز", value: "PASS — Mira 1.0.0 (2026102208) على 00008110-00191986268BA01E دون مسح بيانات", file: "audit-out/rc14-outfit-gaps/device-install.txt" },
    { name: "API إنتاج", value: "live dep-dbcp24ss728c73aqtfo0 commit 95c8989", file: "audit-out/rc14-outfit-gaps/DEPLOY.txt" },
    { name: "رسوم الإطلالة في الحزمة", value: "10 ملفات تحت assets/icons/fashion/illustrations", file: "audit-out/rc14-outfit-gaps/illustrations-count.txt" }
  ],
  remaining: [
    "رحلات الفستان العنابي/الأزرق الفاتح والصورة متعددة القطع والمناسبتين وتبديل الحساب و8 رسائل مع انقطاع الشبكة — NOT_RUN (يدوي على الجهاز المثبّت).",
    "تسجيل جوال فعلي للرحلات — NOT_RUN.",
    "إثبات بصري على الجهاز أن الرسوم العشر تظهر في الواجهة (الملفات موجودة في الحزمة؛ العرض الحي بانتظار المالك)."
  ]
};
