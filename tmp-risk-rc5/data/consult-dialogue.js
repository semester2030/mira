window.MIRA_CONSULT_DIALOGUE = {
  id: "CONSULT_DIALOGUE_RC10",
  title: "محادثة الجمال والصور",
  updatedAt: "2026-10-22",
  approval: "DRAFT_FOR_OWNER_REVIEW",
  paidCalls: 0,
  modelCalled: false,
  release: {
    published: "التزام RC10 يُدفع إلى main مع هجرة clientSaveId وإصلاح Redis وجلسة المستشار واختصاص السياق. تحقق الصحة بعد النشر مطلوب لحالة Redis.",
    technicallyTested: "outfit-recovery-rc10.schema-tests.ts: 12 فحصًا نجحت (عقد الحفظ، رفض scoreSupported، تنظيف تاريخ الاختصاص، رفض جواب يذكر الصقر بعد سؤال الحذاء). RC9 بقي ناجحًا. اختبارات الألوان والكاميرا في Flutter نجحت. رحلة الفستانين الحية على الإنتاج تُسجَّل بعد استقرار Redis في health.",
    awaitingOwner: "تثبيت الإصدار على الجوال دون إزالة التطبيق. لقطة Redis AVAILABLE من /health. تسجيل قصير لمسار الحفظ→الجلسة→الرسالة إن توفّر حساب."
  },
  repairs: [
    {
      problem: "Redis في الصحة DEGRADED رغم توفر mira-redis، فيفشل حد الاستخدام بـ RATE_LIMIT_UNAVAILABLE.",
      cause: "RedisService كان يفتح الاتصال بكسل (lazyConnect) ويُرجع العميل قبل ready، فيظهر DEGRADED ويفشل incr عند انقطاع.",
      files: "mira-api/src/redis/redis.service.ts",
      fix: "اتصال صريح عند الإقلاع مع ping، وإعادة المحاولة عند فشل العداد، دون تعطيل fail_closed.",
      check: "بعد النشر: runtimeDependencies.redis.state يجب أن يصبح AVAILABLE. قبل النشر: الكود والاختبارات المحلية."
    },
    {
      problem: "الضغط المتكرر على اسألي ميرا قد ينشئ جلستين، واستئناف جلسة محذوفة يربط المستخدم بخطأ غير واضح.",
      cause: "لا قفل على _ensureSession، وgetForUser كان يقبل status=deleted، ورسالة الخطأ واحدة لكل المراحل.",
      files: "mira_advisor_screen.dart · consultation-session.service.ts",
      fix: "قفل in-flight لبدء الجلسة، رفض الجلسات المحذوفة، ومسح تفضيل الاستئناف عند 404، ورسائل عربية حسب المرحلة (حفظ/استئناف/جلسة) مع رقم تتبع عند الإمكان.",
      check: "تحليل Dart نظيف. اختبار RC10 للاختصاص والحفظ."
    },
    {
      problem: "إعادة حفظ نفس التحليل كانت تعتمد على مسح آخر 30 صفًا بالبصمة؛ تحليل جديد لنفس الصورة في مناسبة أخرى كان يُخلط بإعادة المحاولة.",
      cause: "المطابقة كانت imageFingerprint+analysisVersion الدائم، وanalysisVersion ثابت outfit-intel-v2.",
      files: "save-outfit-snapshot.dto.ts · outfit-analysis.service.ts · schema.prisma · outfit_consultation_mapper.dart · mira_advisor_screen.dart",
      fix: "clientSaveId اختياري مع قيد فريد (userId, clientSaveId). إعادة المحاولة تعيد الصف نفسه؛ تحليل جديد يولّد معرف حفظ جديد. أُزيلت إعادة الاستخدام الدائمة بالبصمة وحدها.",
      check: "outfit-recovery-rc10 يقبل clientSaveId ويرفض scoreSupported."
    },
    {
      problem: "بعد سؤال عن طائر/صقر كان جواب سؤال الحذاء يذكر الموضوع السابق.",
      cause: "تاريخ المحادثة كاملاً يُمرَّر للنموذج بلا عزل للدورات الخارجة عن الاختصاص.",
      files: "consultation-scope.ts · consultation-orchestrator.service.ts",
      fix: "historyForBeautyTurn يحذف أزواج الأسئلة الخارجة وإعادة التوجيه قبل التجميع. answerStaysInScope يرفض ذكر الصقر/القطة في جواب سؤال جمال.",
      check: "RC10: تنظيف التاريخ وطول 1 بعد سؤال الحذاء؛ رفض جواب يذكر الصقر."
    },
    {
      problem: "درجة قديمة بلا ألوان كانت تُعامل كدرجة مدعومة في المستشار (scoreSupported !== false).",
      cause: "غياب الحقل كان يعني true.",
      files: "mce-fact-extractor.service.ts · mce-prompt-assembler.service.ts",
      fix: "الدرجة تُعرض/تُرسل كحقيقة فقط إذا scoreSupported === true صراحة بعد التحليل.",
      check: "sanitize ما زال يحذف الدرجة عند غياب الألوان."
    },
    {
      problem: "فستان سهرة للجامعة كان يُمدح أسلوبه ثم يُحذَّر من الرسمية في الصفحة نفسها.",
      cause: "_buildQuickMatchReasons كان يمدح أي styleTypeAr بما فيها سهرة حتى لمناسبة الجامعة.",
      files: "deterministic_outfit_engine.dart",
      fix: "_styleFitsOccasion يمنع مدح سهرة للجامعة/كاجوال، ويضيف سبب عدم ملاءمة صريح.",
      check: "تحليل الملف. يحتاج صورة حية لاحقًا."
    },
    {
      problem: "تبويب جرّبي يكرر صورة البطل فوق لوحة التلوين.",
      cause: "_Photo المشترك يظهر فوق IndexedStack في كل التبويبات بما فيها جرّبي التي تعرض Image.file مرة أخرى.",
      files: "outfit_studio_screen.dart · outfit_garment_recolor_panel.dart",
      fix: "إخفاء _Photo في تبويب جرّبي، وعرض الأصل داخل اللوحة فقط قبل نتيجة التجربة، مع فصل لاحق بين الأصل والمعاينة عند وجود نتيجة.",
      check: "تحليل الواجهة نظيف."
    }
  ],
  scope: "مستشارة تفاعلية للجمال والعناية والمكياج والشعر والإطلالات. تصوير الإطلالة بالكاميرا متوقف مؤقتًا، واختيار صور الاستديو هو المسار المتاح. تصوير الوجه وتحليل البشرة يبقيان متاحين.",
  decisions: [
    "تصوير الإطلالة بالكاميرا معطل مؤقتًا عبر MIRA_OUTFIT_CAMERA_CAPTURE.",
    "صور الاستديو تبقى مسار تحليل الإطلالة والمحادثة.",
    "fail_closed لحد الاستخدام يبقى؛ الإصلاح يعيد اتصال Redis لا يتجاوز الضابط."
  ],
  tasks: [
    { id: "D22", title: "أقسام الإطلالة الأربعة واستئناف محادثة التحليل", state: "implemented", evidence: "outfit_studio_screen.dart · جرّبي بلا تكرار صورة البطل" },
    { id: "D23", title: "حفظ ذري بإعادة المحاولة دون خلط تحليل جديد", state: "verified_local", evidence: "outfit-recovery-rc10.schema-tests.ts · clientSaveId" },
    { id: "D24", title: "عزل تاريخ الاختصاص بعد موضوع خارج الجمال", state: "verified_local", evidence: "outfit-recovery-rc10.schema-tests.ts · historyForBeautyTurn" },
    { id: "D25", title: "جلسة محذوفة ورسائل مراحل واضحة", state: "implemented", evidence: "consultation-session.service.ts · mira_advisor_screen.dart" },
    { id: "D10", title: "جودة إجابات النموذج الحية", state: "awaiting_live", evidence: "يتطلب Redis AVAILABLE ثم إعادة سؤال الحذاء بعد سؤال الطائر" },
    { id: "D11", title: "اختيار الاستديو على جهاز بدون إزالة التطبيق", state: "awaiting_device", evidence: "تثبيت release بعد النشر" }
  ],
  results: [
    { name: "فحوصات RC10", value: "12 نجحت", file: "mira-api/src/outfit-analysis/outfit-recovery-rc10.schema-tests.ts" },
    { name: "فحوصات RC9", value: "4 نجحت", file: "mira-api/src/outfit-analysis/outfit-recovery-rc9.schema-tests.ts" },
    { name: "Flutter ألوان/كاميرا", value: "5 نجحت", file: "test/outfit_color_retention_test.dart" }
  ],
  remaining: [
    "رحلة الفستانين الحية (عنابي وأزرق فاتح) على الإنتاج NOT_RUN حتى يثبت Redis AVAILABLE في /health بعد النشر.",
    "لا يوجد تسجيل جهاز بعد تثبيت RC10 في هذه الجولة إن لم يكتمل التثبيت.",
    "تصوير الإطلالة بالكاميرا ما زال متوقفًا مؤقتًا.",
    "004 و005 و013 وعيب تعليمات الإعلان خارج النطاق."
  ],
  unchangedRisks: ["MIRA-RISK-003", "MIRA-RISK-004", "MIRA-RISK-005", "MIRA-RISK-012", "MIRA-RISK-013", "AIA-C02"]
};
