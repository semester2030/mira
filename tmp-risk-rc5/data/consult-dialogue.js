window.MIRA_CONSULT_DIALOGUE = {
  id: "CONSULT_DIALOGUE_RC11",
  title: "محادثة الجمال والصور",
  updatedAt: "2026-10-22",
  approval: "DRAFT_FOR_OWNER_REVIEW",
  paidCalls: 0,
  modelCalled: false,
  release: {
    published: "RC11 فوق RC10: إصلاح حفظ 400 (clientSaveId≤64) + دوائر ألوان حقيقية + أهلية التلوين المبكرة. لا تغيير خادم مطلوب للحفظ — الرفض كان صحيحاً لطول المعرف.",
    technicallyTested: "RC11 schema 2/2 (يرفض clientSaveId الطويل). RC10 12/12. Flutter rc11_outfit_ux 3 + ألوان 4. جرد audit-out/rc11-outfit-ux/INVENTORY.md.",
    awaitingOwner: "رحلة الفستانين الحية بعد تحديث التطبيق دون wipe. حفظ→جلسة→رسالة على الإنتاج."
  },
  priorRelease: {
    id: "CONSULT_DIALOGUE_RC10",
    published: "RC10 على main: ba5e34b + 207871b. Redis AVAILABLE · dep-dbcmckss728c73aof56g.",
    note: "أدلة RC10 تاريخية في evidence/rc10 — لا تُمسح."
  },
  repairs: [
    {
      problem: "تعذر حفظ تقرير الإطلالة — 400 · تتبع c-1792632474988668.",
      cause: "clientSaveId = μs + SHA-256 كاملة (~81 حرفاً) يتجاوز MaxLength(64) على SaveOutfitSnapshotDto. طلبات 400 على /snapshots @ 01:27–01:28Z قبل/أثناء نشر Redis.",
      files: "mira_advisor_screen.dart · outfit_consultation_mapper.dart · save-outfit-snapshot.dto.ts",
      fix: "buildClientSaveId يقصّ البصمة إلى 12 ويبقى ≤64؛ يعيد توليد المعرف إن وُجد قديم أطول في prefs.",
      check: "rc11_outfit_ux_test + outfit-recovery-rc11.schema-tests.ts يرفضان الطول الزائد ويقبلان القصير."
    },
    {
      problem: "دائرة نبيتي تظهر وردية فاتحة.",
      cause: "fuzzyByName('نبيتي') اختار أطول تطابق «نبيتي فاتح جداً» #ECD5D5.",
      files: "fashion_color_binding.dart · outfit_studio_screen.dart · outfit_garment_recolor_panel.dart",
      fix: "shortNameHex نبيتي/عنابي=#781828؛ alias نبيتي→نبيتي غامق؛ تفضيل غامق/متوسط على فاتح في fuzzy.",
      check: "rc11_outfit_ux_test: luminance نبيتي < 0.25 وhex #781828."
    },
    {
      problem: "تجربة التلوين تُفهم كتعديل منفَّذ دون أهلية واضحة؛ والسجل يعرض درجة مدعومة بلا دليل.",
      cause: "رسالة الأهلية متأخرة؛ _HistoryTile استخدم score>0.",
      files: "outfit_garment_recolor_panel.dart · outfit_studio_screen.dart",
      fix: "أهلية مبكرة + مسار مناقشة؛ دوائر مرصودة/مقترحة منفصلة؛ درجة غير متاحة في السجل دون ادّعاء دعم.",
      check: "تحليل الواجهة؛ اختبارات الألوان؛ جرد INVENTORY."
    },

    {
      problem: "Redis في الصحة DEGRADED رغم توفر mira-redis، فيفشل حد الاستخدام بـ RATE_LIMIT_UNAVAILABLE.",
      cause: "RedisService كان يفتح الاتصال بكسل (lazyConnect) ويُرجع العميل قبل ready؛ ومقارنة status==='ready' كسرت بناء Nest (TS2367) ففشل dep-dbcmafjbc2fs738k3k0g.",
      files: "mira-api/src/redis/redis.service.ts",
      fix: "اتصال صريح عند الإقلاع مع ping وعلم ready منفصل؛ إعادة المحاولة عند فشل العداد دون تعطيل fail_closed. إصلاح العلم في 207871b بعد فشل البناء.",
      check: "LIVE 2026-10-22T01:28Z: redis.state=AVAILABLE · audit-out/rc10-outfit-recovery/health-after-rc10.json"
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
    { id: "D26", title: "Redis AVAILABLE بعد إصلاح ready-flag", state: "verified_live", evidence: "health-after-rc10.json · dep-dbcmckss728c73aof56g · Redis critical controls connected" },
    { id: "D10", title: "جودة إجابات النموذج الحية", state: "awaiting_live", evidence: "Redis AVAILABLE؛ رحلة الحذاء بعد الطائر NOT_RUN بلا حساب جلسة في هذه الجولة" },
    { id: "D11", title: "تثبيت بناء RC10 على الجهاز", state: "verified_device", evidence: "flutter run --release ثبّت وأطلق app.mira.beauty بعد فشل codesign لـ flutter install. تحذير: flutter install أزال النسخة السابقة قبل الفشل — قد فُقدت بيانات محلية." },
    { id: "D27", title: "إصلاح حفظ 400 لطول clientSaveId", state: "verified_local", evidence: "outfit-recovery-rc11.schema-tests.ts · rc11_outfit_ux_test.dart · طلبات 400 على snapshots" },
    { id: "D28", title: "دائرة نبيتي ليست وردية فاتحة", state: "verified_local", evidence: "fashion_color_binding shortNameHex #781828" },
    { id: "D29", title: "تحسين تبويبات الاستديو دون مسار موازٍ", state: "implemented", evidence: "outfit_studio_screen.dart · دوائر/طي الصورة/أهلية جرّبي" }
  ],
  results: [
    { name: "فحوصات RC11", value: "2 نجحت", file: "mira-api/src/outfit-analysis/outfit-recovery-rc11.schema-tests.ts" },
    { name: "Flutter RC11 UX", value: "3 نجحت", file: "test/outfit_analysis/rc11_outfit_ux_test.dart" },
    { name: "فحوصات RC10", value: "12 نجحت", file: "mira-api/src/outfit-analysis/outfit-recovery-rc10.schema-tests.ts" },
    { name: "فحوصات RC9", value: "4 نجحت", file: "mira-api/src/outfit-analysis/outfit-recovery-rc9.schema-tests.ts" },
    { name: "Flutter ألوان", value: "4 نجحت", file: "test/outfit_color_retention_test.dart" },
    { name: "Redis LIVE", value: "AVAILABLE", file: "audit-out/rc10-outfit-recovery/health-after-rc10.json" },
    { name: "نشر API", value: "dep-dbcmckss728c73aof56g LIVE · لا نشر API إضافي لـ RC11", file: "Render mira-api" },
    { name: "جهاز RC10", value: "مثبّت عبر flutter run --release", file: "audit-out/rc10-outfit-recovery/flutter-run-release.txt" }
  ],
  remaining: [
    "رحلة الفستانين الحية (عنابي وأزرق فاتح) ومسار حفظ→جلسة→رسالة على الإنتاج NOT_RUN بعد تحديث RC11 على الجهاز.",
    "مقارنة بصرية كاملة بالمرجع المرفق NOT_RUN في هذه الجولة (لا لقطات جهاز جديدة).",
    "تصوير الإطلالة بالكاميرا ما زال متوقفًا مؤقتًا.",
    "004 و005 و013 وعيب تعليمات الإعلان خارج النطاق."
  ],
  unchangedRisks: ["MIRA-RISK-003", "MIRA-RISK-004", "MIRA-RISK-005", "MIRA-RISK-012", "MIRA-RISK-013", "AIA-C02"]
};
