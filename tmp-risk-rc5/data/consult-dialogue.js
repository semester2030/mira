window.MIRA_CONSULT_DIALOGUE = {
  id: "CONSULT_DIALOGUE_RC13",
  title: "محادثة الجمال والصور",
  updatedAt: "2026-10-22",
  approval: "DRAFT_FOR_OWNER_REVIEW",
  paidCalls: 0,
  modelCalled: false,
  release: {
    published: "RC13: فجوات ما بعد RC12 — محادثة (429/إعادة محاولة)، أصول illustrations في الحزمة، ألوان مربوطة بالقطعة، جرّبيه ينقل الاختيار، دولاب بتحميل المزيد ومقارنة اختيارية، فهرس صور بالحساب.",
    technicallyTested: "rc13_outfit_gaps · rc12_visual · أدلة Render لـ c-1792639982099619=429 عند الطلب قبل البث. لا مسار إطلالة موازٍ.",
    awaitingOwner: "لقطات/تسجيل جهاز حي للشاشات الأربع والرسوم بعد إعادة البناء مع illustrations؛ رحلة الفستانين؛ 8 رسائل متتابعة على الجهاز."
  },
  priorRelease: {
    id: "CONSULT_DIALOGUE_RC12",
    published: "RC12: أصول موضحة + بطاقات متجاورة + فهرس صور محلية.",
    note: "أدلة RC10–RC12 محفوظة — لا تُمسح. RC12 لم يُثبَّت الرسوم في الحزمة لأن pubspec لم يعلن مجلد illustrations."
  },
  repairs: [
    {
      problem: "طلب المحادثة c-1792639982099619 فشل في التسجيل الأخير.",
      cause: "مرحلة الطلب: POST …/messages/stream أعاد 429 Too Many Requests في 2026-10-22T03:33:02Z (نفس ثانية clientMessageId). إعادة المحاولة بنفس الهوية كانت تمرّ من claim→resume ثم assertWithinLimit فتستهلك/تُرفض مجدداً قبل النموذج/البث/الحفظ.",
      files: "consultation-orchestrator.service.ts · mira_advisor_screen.dart · dialogue_outbound.dart",
      fix: "تخطي حد الاستخدام عند claimStatus=resume لنفس clientMessageId؛ إعادة المحاولة تبقي الهوية وتعيد الرد المحفوظ إن اكتمل؛ بطاقة سياق صغيرة + فصل مناسبة التقرير عن سياق النقاش؛ sanitize لـ ** وMarkdown.",
      check: "سجلات Render request 429 مطابقة للبصمة الزمنية؛ اختبار DialogueOutbound.retry؛ اختبار MceDisplayText."
    },
    {
      problem: "رسوم القطع العشر موجودة في RC12 لكنها لا تظهر في التطبيق/التسجيل.",
      cause: "Flutter لا يضمّن المجلدات الفرعية تلقائياً. pubspec أعلن assets/icons/fashion/ فقط فغابت illustrations عن AssetManifest وحزمة iOS (0 ملفات mira_piece في Runner.app).",
      files: "pubspec.yaml · outfit_piece_art.dart",
      fix: "إعلان assets/icons/fashion/illustrations/ صراحة؛ تسجيل فشل تحميل الأصل في assert بدل إخفاء صامت بالكامل.",
      check: "بعد إعادة البناء يجب ظهور illustrations في flutter_assets؛ rc13_outfit_gaps + rc12_visual."
    },
    {
      problem: "ألوان الأعلى/الأسفل تُنسب كلها للقطعة المختارة؛ اقتراحات حقيبة/حذاء بترتيب القائمة؛ جرّبيه لا ينقل الاختيار للوحة.",
      cause: "دمج dominant+upper+lower تحت subtitle واحد؛ pieceHint=i==0?حقيبة؛ _TryPage بلا selectedColor/Piece.",
      files: "outfit_studio_screen.dart · outfit_garment_recolor_panel.dart",
      fix: "ألوان مربوطة بمصدر/قطعة؛ اقتراحات فقط عند بيانات كافية؛ تمرير initialGarment/Color إلى لوحة التلوين؛ فصل رسالة التعرف عن أهلية القناع.",
      check: "تحليل الواجهة؛ اختبارات RC13."
    },
    {
      problem: "مسار cache يعيد frozenImagePath للصورة الأصلية ويتجاوز النسخة المحتفظ بها؛ السجل يقطع عند 12؛ المقارنة تأخذ أول سجلين فقط.",
      cause: "copyWith(frozenImagePath: outfitImage.path)؛ take(12)؛ compare items[0]/[1].",
      files: "outfit_intelligence_service.dart · outfit_local_image_index.dart · outfit_studio_screen.dart",
      fix: "cache يستخدم retained.path ويفهرس؛ فهرس بمفتاح الحساب+المفتاح؛ تحميل المزيد؛ مقارنة سجلين تختارهما المستخدمة؛ لا استبدال صورة مفقودة برسم يوحي بأنها صورة المستخدم.",
      check: "تحليل المسارات؛ اختبارات محلية."
    }
  ],
  scope: "مستشارة تفاعلية للجمال والعناية والمكياج والشعر والإطلالات. تصوير الإطلالة بالكاميرا متوقف مؤقتًا، واختيار صور الاستديو هو المسار المتاح. تصوير الوجه وتحليل البشرة يبقيان متاحين.",
  decisions: [
    "تصوير الإطلالة بالكاميرا معطل مؤقتًا عبر MIRA_OUTFIT_CAMERA_CAPTURE.",
    "صور الاستديو تبقى مسار تحليل الإطلالة والمحادثة.",
    "fail_closed لحد الاستخدام يبقى؛ استئناف نفس clientMessageId لا يحرق حصة إضافية.",
    "تغيير مناسبة النقاش لا يغيّر مناسبة التقرير الأصلي بصمت."
  ],
  tasks: [
    { id: "D22", title: "أقسام الإطلالة الأربعة واستئناف محادثة التحليل", state: "implemented", evidence: "outfit_studio_screen.dart · جرّبي بلا تكرار صورة البطل" },
    { id: "D23", title: "حفظ ذري بإعادة المحاولة دون خلط تحليل جديد", state: "verified_local", evidence: "outfit-recovery-rc10.schema-tests.ts · clientSaveId" },
    { id: "D24", title: "عزل تاريخ الاختصاص بعد موضوع خارج الجمال", state: "verified_local", evidence: "outfit-recovery-rc10.schema-tests.ts · historyForBeautyTurn" },
    { id: "D25", title: "جلسة محذوفة ورسائل مراحل واضحة", state: "implemented", evidence: "consultation-session.service.ts · mira_advisor_screen.dart" },
    { id: "D26", title: "Redis AVAILABLE بعد إصلاح ready-flag", state: "verified_live", evidence: "health-after-rc10.json · dep-dbcmckss728c73aof56g" },
    { id: "D10", title: "جودة إجابات النموذج الحية", state: "awaiting_live", evidence: "إصلاح 429/resume؛ رحلة 8 رسائل على الجهاز NOT_RUN" },
    { id: "D11", title: "تثبيت بناء على الجهاز", state: "awaiting_device", evidence: "RC12 فشل قفل الجهاز؛ RC13 يحتاج flutter run --release بعد تضمين illustrations" },
    { id: "D27", title: "إصلاح حفظ 400 لطول clientSaveId", state: "verified_local", evidence: "rc11" },
    { id: "D28", title: "دائرة نبيتي ليست وردية فاتحة", state: "verified_local", evidence: "rc11 #781828" },
    { id: "D29", title: "تحسين تبويبات الاستديو دون مسار موازٍ", state: "implemented", evidence: "RC11/RC12/RC13 studio" },
    { id: "D30", title: "أصول قطع موضحة في الحزمة", state: "fixed_packaging", evidence: "pubspec illustrations/ · كان 0 في Runner.app قبل الإصلاح" },
    { id: "D31", title: "فهرس صور محلية للحساب+التقرير", state: "implemented", evidence: "outfit_local_image_index scoped + cache retained path" },
    { id: "D32", title: "إعادة محاولة بنفس clientMessageId دون 429 مكرر", state: "implemented", evidence: "orchestrator skipRateLimit on resume · Render 429 evidence" },
    { id: "D33", title: "ألوان مربوطة + جرّبيه ينقل الاختيار", state: "implemented", evidence: "studio + recolor panel seeds" },
    { id: "D34", title: "دولاب: المزيد + مقارنة اختيارية", state: "implemented", evidence: "outfit_studio_screen wardrobe" }
  ],
  results: [
    { name: "فشل c-1792639982099619", value: "مرحلة الطلب · 429", file: "Render request logs 2026-10-22T03:33:02Z" },
    { name: "أصول قبل الإصلاح", value: "0 illustrations في Runner.app", file: "build/ios/.../flutter_assets" },
    { name: "فحوصات RC13", value: "انظر audit-out/rc13", file: "test/outfit_analysis/rc13_outfit_gaps_test.dart" },
    { name: "فحوصات RC12 visual", value: "2 نجحت سابقاً", file: "test/outfit_analysis/rc12_outfit_visual_test.dart" },
    { name: "Redis LIVE", value: "AVAILABLE (RC10)", file: "audit-out/rc10-outfit-recovery/health-after-rc10.json" }
  ],
  remaining: [
    "تسجيل/لقطات جهاز بعد البناء مع illustrations — NOT_RUN حتى يُفتح الجهاز.",
    "رحلة فستان عنابي + أزرق فاتح حية — NOT_RUN.",
    "8 رسائل متتابعة + انقطاع شبكة على الجهاز — NOT_RUN.",
    "التسجيل الأخير لم يُعثر عليه كملف فيديو على سطح المكتب؛ الاعتماد على سجلات Render + وصف البرومت."
  ]
};
