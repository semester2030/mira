window.MIRA_CONSULT_DIALOGUE = {
  id: "CONSULT_DIALOGUE_RC15",
  title: "محادثة الجمال والصور",
  updatedAt: "2026-10-22",
  approval: "DRAFT_FOR_OWNER_REVIEW",
  paidCalls: 0,
  modelCalled: false,
  release: {
    published: "RC15: إصلاح تعثر تحليل الوجه — YouCam ExpiredApiKey يُصنَّف PROVIDER_AUTH_EXPIRED؛ توحيد حالات الشاشة وإزالة تعارض «جاهز للتصوير» مع الصورة الملتقطة؛ إعادة المحاولة بنفس الصورة؛ بناء 2026102209. يحافظ على RC14.",
    technicallyTested: "phase5 surgical schema + flutter face tests · UI overlay state · Render logs ExpiredApiKey evidence.",
    awaitingOwner: "تجديد PERFECT_API_KEY / PERFECT_CORP_API_KEY على Render ثم إعادة رحلة التقاط→نتائج حية. الرحلات الكاملة وتسجيل الجوال — NOT_RUN حتى يتجدد المفتاح."
  },
  priorRelease: {
    id: "CONSULT_DIALOGUE_RC14",
    published: "RC14: quotaReserved · bindContext · ألوان بلا zip · فهرس صور scoped · تثبيت 2026102208.",
    note: "RC14 بقي سارياً؛ RC15 يضيف مسار الوجه دون إعادة بناء مسارات الإطلالة."
  },
  repairs: [
    {
      problem: "بعد «تم التقاط الصورة» تظهر «تعذر بدء التحليل حالياً» مع بقاء «جاهز للتصوير».",
      cause: "سجلات الإنتاج (2026-10-22T05:30–05:32Z): PerfectCorpSkinProvider File API 401 ExpiredApiKey على أثر skin_mvj3r1sd_* ولاحقيه. الواجهة أبقت TrackingQualityBadge «جاهز للتصوير» فوق حالة captured/failure.",
      files: "perfect-corp-skin.provider.ts · youcam-face-errors.ts · live_face_analysis_overlay.dart · new_analysis_screen.dart · skin_analysis_bloc.dart · skin_analysis_api_data_source.dart",
      fix: "تصنيف ExpiredApiKey → PROVIDER_AUTH_EXPIRED (503 منظم بدون تسريب تقني)؛ إخفاء «جاهز للتصوير» عند الالتقاط/الفشل؛ إعادة محاولة بنفس الصورة و«إعادة التصوير» مستقلة؛ clientRequestId للتتبع؛ تمييز شبكة/جلسة/حد/خدمة.",
      check: "phase5-face-analysis-surgical.schema-tests · phase5 flutter tests · Render logs قبل الإصلاح · رحلة نتائج حية NOT_RUN حتى تجديد مفتاح YouCam."
    },
    {
      problem: "إعفاء عام من حد الاستخدام عند claimStatus=resume يفتح ثغرة بعد 429.",
      cause: "RC13 جعل skipRateLimit = claimStatus==='resume'.",
      files: "consultation-orchestrator.service.ts · consultation-message.service.ts",
      fix: "quotaReserved=true فقط بعد حجز ناجح.",
      check: "outfit-gaps-rc14.schema-tests.ts"
    },
    {
      problem: "سياق المحادثة يعتمد بصمة الصورة / lastOutfit؛ bindContext يُبتلع.",
      cause: "مفتاح بلا مناسبة؛ catch فارغ.",
      files: "mira_advisor_screen.dart · consultation-session.service.ts",
      fix: "fingerprint+occasion · statedGoalAr · activeSnapshotId.",
      check: "تحليل الواجهة؛ اختبارات محلية."
    },
    {
      problem: "اقتراحات الألوان تربط recommendedColors[i] بـ accessoryPieces[i].",
      cause: "zip بالفهرس.",
      files: "outfit_studio_screen.dart · outfit_garment_recolor_panel.dart",
      fix: "دليل قطعة واضح؛ requestGen يتجاهل المتأخر.",
      check: "اختبارات RC14."
    },
    {
      problem: "فهرس الصور غير معزول؛ تثبيت 0xe8008014 على objective_c.",
      cause: "كاش native-assets منصة خاطئة.",
      files: "outfit_local_image_index.dart · بناء iOS",
      fix: "scoped index · clean + device build 2026102208.",
      check: "device-install RC14."
    }
  ],
  scope: "مستشارة تفاعلية للجمال والعناية والمكياج والشعر والإطلالات. تصوير الإطلالة بالكاميرا متوقف مؤقتًا، واختيار صور الاستديو هو المسار المتاح. تصوير الوجه وتحليل البشرة يبقيان متاحين (علم الإطلالة لا يشارك مسار الوجه).",
  decisions: [
    "تصوير الإطلالة بالكاميرا معطل مؤقتًا عبر MIRA_OUTFIT_CAMERA_CAPTURE.",
    "لا إعفاء من الحصة بلا quotaReserved محفوظ على الخادم.",
    "تغيير مناسبة النقاش لا يعدّل مناسبة التقرير الأصلي.",
    "فشل YouCam بمفتاح منتهٍ يُبلَّغ كتعطل خدمة قابل لإعادة المحاولة دون تسريب ExpiredApiKey للواجهة."
  ],
  tasks: [
    { id: "D37", title: "تحليل الوجه: ExpiredApiKey + حالات الشاشة", state: "implemented_blocked_live", evidence: "Render ExpiredApiKey · PROVIDER_AUTH_EXPIRED · overlay fix · build 2026102209" },
    { id: "D32", title: "429 resume فقط مع حجز حصة موثّق", state: "implemented", evidence: "quotaReserved · outfit-gaps-rc14" },
    { id: "D33", title: "ألوان مربوطة + جرّبيه", state: "implemented", evidence: "studio + recolor requestGen" },
    { id: "D34", title: "دولاب المزيد/مقارنة", state: "implemented", evidence: "wardrobe epoch reload" },
    { id: "D35", title: "سياق bindContext + بطاقة الخادم", state: "implemented", evidence: "statedGoalAr · context card" },
    { id: "D36", title: "فهرس صور معزول بالحساب", state: "implemented", evidence: "outfit_local_image_index scoped-only read" },
    { id: "D11", title: "تثبيت البناء على الجهاز", state: "in_progress", evidence: "RC15 يستهدف 2026102209" },
    { id: "D10", title: "رحلات حية + تسجيل", state: "awaiting_live", evidence: "NOT_RUN — يحتاج مفتاح YouCam ساري" }
  ],
  results: [
    { name: "تشخيص الوجه", value: "ExpiredApiKey على Perfect Corp (أدلة Render)", file: "audit-out/rc15-face-analysis/DIAGNOSIS.txt" },
    { name: "فحوصات phase5 + expired key", value: "PASS", file: "mira-api/src/ai/face-gate/phase5-face-analysis-surgical.schema-tests.ts" },
    { name: "Flutter face journey", value: "PASS (+AUTH_EXPIRED/network)", file: "test/face_analysis_experience/phase5_face_analysis_surgical_test.dart" },
    { name: "بناء التطبيق المستهدف", value: "1.0.0+2026102209", file: "pubspec.yaml" }
  ],
  remaining: [
    "تجديد مفتاح YouCam/Perfect Corp على Render (PERFECT_API_KEY أو PERFECT_CORP_API_KEY) — بدون ذلك نتائج التحليل الحية تبقى متعذرة.",
    "رحلة حية: التقاط→نتائج وخرائط؛ انقطاع شبكة؛ ضغط متكرر؛ تغيير صورة أثناء الطلب — NOT_RUN.",
    "تسجيل جوال فعلي — NOT_RUN.",
    "استعادة نتيجة مكتملة على الخادم عند ضياع الرد (لا آلية idempotency حالية للبشرة) — NOT_RUN / متبقٍ."
  ]
};
