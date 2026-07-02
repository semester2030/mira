/**
 * MIRA Consultation Engine (MCE) — مصدر الحقيقة الوحيد
 * المرجع: mira-vision-platform.html#mce-consultation
 */
(function (global) {
  const MCE_META = {
    id: 'MCE',
    icon: '💬',
    titleAr: 'محرك الاستشارة الذكية',
    subtitleAr: 'MIRA Consultation Engine',
    version: '1.0.0',
    status: 'phase_2_live',
    dateAr: 'يونيو 2026',
  };

  const VERDICT = {
    score: 9,
    labelAr: 'استراتيجياً صحيح — تنفيذياً خطير إن أُهملت القواعد',
    summaryAr:
      'ميرا اليوم محلّل ثابت. MCE يحوّلها إلى مستشارة تفاعلية — لكن فقط إذا التزمنا: الرؤية تستخرج الحقائق، والذكاء الاصطناعي يشرحها. لا إعادة تحليل صورة في المحادثة.',
    pillarsAr: [
      { icon: '✅', title: 'لماذا نبنيه', body: 'البيانات موجودة: تقرير البشرة، تحليل الإطلالة، QEL — المستخدمة تسأل فعلاً عبر Advisor الحالي.' },
      { icon: '⚠️', title: 'الخطر الأكبر', body: 'ChatGPT بشعار ميرا — اختراع درجات أو نصائح طبية تدمر الثقة فوراً.' },
      { icon: '🎯', title: 'الحل', body: 'طبقة GEL — Grounded Explanation Layer: كل إجابة مربوطة بـ snapshot حقائق مُوقَّعة.' },
    ],
  };

  const GOLDEN_RULES = [
    {
      id: 'vision_facts',
      titleAr: 'الرؤية تستخرج — لا تشرح',
      bodyAr: 'OpenAI Semantic + Perfect Corp + FASHN Geometry = حقائق منظمة. MCE لا يستقبل صورة خام إن وُجد تحليل مخزّن.',
      forbiddenAr: 'إرسال الصورة لـ GPT في كل سؤال',
    },
    {
      id: 'fashn_exec',
      titleAr: 'FASHN تنفيذ فقط',
      bodyAr: 'تلوين القماش · QEL · لا منطق أسلوب داخل FASHN.',
      forbiddenAr: 'طلب «نسّقي لي» من FASHN Edit',
    },
    {
      id: 'grounding',
      titleAr: 'كل إجابة مُؤَسَّسة',
      bodyAr: 'تقرير البشرة + الإطلالة + Atelier + المناسبة + التفضيلات + تاريخ المحادثة.',
      forbiddenAr: 'إجابة عامة بدون contextSnapshotId',
    },
    {
      id: 'no_rebuild',
      titleAr: 'لا إعادة بناء',
      bodyAr: 'التكامل مع skin_analysis · outfit_analysis · vision/qel — لا محرك جديد.',
      forbiddenAr: 'محرك تحليل ثانٍ للوجه أو الإطلالة',
    },
  ];

  const LAYERS = {
    flutter: {
      titleAr: 'طبقة Flutter',
      icon: '📱',
      items: [
        { name: 'ConsultationHubScreen', desc: 'بوابة الجلسات — من لوحة التحكم وتقارير التحليل' },
        { name: 'ConsultationThreadScreen', desc: 'محادثة مع بث حي للرد + رسائل متفائلة' },
        { name: 'Riverpod', desc: 'consultationSessionProvider · messages · stream · quota' },
        { name: 'ConsultationRepository', desc: 'REST + SSE — لا مفاتيح OpenAI في التطبيق' },
        { name: 'ربط السياق', desc: 'من result_screen · outfit_result · recolor_panel → analysisIds' },
      ],
      path: 'lib/features/consultation/',
    },
    backend: {
      titleAr: 'طبقة Backend (NestJS)',
      icon: '⚙️',
      items: [
        { name: 'ConsultationOrchestrator', desc: 'نقطة الدخول — تنسيق كامل لكل رسالة' },
        { name: 'MceGroundingPipeline', desc: 'تحميل snapshot + دمج الحقائق' },
        { name: 'McePromptAssembler', desc: 'بناء البرومبت — عربي · قواعد · استشهادات' },
        { name: 'MceModeration', desc: 'امتداد advisor-guard — طبي · قاصر · حقن' },
        { name: 'MceCostGuard', desc: 'حدود توكن · ضغط · توجيه النموذج' },
      ],
      path: 'mira-api/src/consultation/',
    },
    ai: {
      titleAr: 'طبقة الذكاء الاصطناعي',
      icon: '🧠',
      items: [
        { name: 'SkinContextSummaryV1', desc: 'ملخص مضغوط من MiraBeautyReport — ~1.5KB' },
        { name: 'OutfitContextSummaryV1', desc: 'درجات · ألوان · topology · أسباب المطابقة' },
        { name: 'AtelierContextSummaryV1', desc: 'QEL · gate · درجات الهوية والحواف' },
        { name: 'MceResponseValidator', desc: 'يمنع درجات مُختلَقة · يفرض disclaimer' },
        { name: 'gpt-4o-mini / g4o', desc: 'mini افتراضي · 4o للمميزة فقط' },
      ],
      path: 'عقود: consultation/contracts/',
    },
    data: {
      titleAr: 'طبقة البيانات',
      icon: '🗄️',
      items: [
        { name: 'consultation_sessions', desc: 'جلسة · ملخص rolling · turnCount · planTier' },
        { name: 'consultation_messages', desc: 'user/assistant · payloadJson · tokenCount' },
        { name: 'consultation_context_snapshots', desc: 'نسخة immutable · factRegistry' },
        { name: 'consultation_recommendations', desc: 'منتج · إكسسوار · مكياج · تعديل إطلالة' },
        { name: 'atelier_recolor_attempts', desc: 'ربط QEL بالاستشارة' },
      ],
      path: 'prisma/schema.prisma',
    },
  };

  const PHASES = [
    {
      n: 1,
      id: 'phase-1',
      titleAr: 'العقود والبنية التحتية',
      durationAr: 'أسبوع 1',
      status: 'done',
      goalAr: 'تأسيس عقد واحد للحقائق — قبل أي واجهة محادثة.',
      deliverablesAr: [
        'تعريف MceContextSnapshotV1 + سجل الحقائق (factRegistry)',
        'ترحيل Prisma: sessions · messages · snapshots · recommendations',
        'هيكل consultation/ في NestJS — module فارغ موصول',
        'وثيقة ربط canonical: OutfitAnalysis (Vision) وليس legacy فقط',
      ],
      exitAr: '✓ migration ناجح · ✓ عقد TypeScript/Dart موثّق · ✓ لا endpoint عام بعد',
      filesAr: [
        'mira-api/src/consultation/contracts/mce-context-snapshot.v1.ts',
        'prisma/schema.prisma (+ models)',
        'lib/features/consultation/domain/entities/',
      ],
    },
    {
      n: 2,
      id: 'phase-2',
      titleAr: 'استشارة البشرة — MVP',
      durationAr: 'أسبوع 2–3',
      status: 'done',
      goalAr: 'أول محادثة مُؤَسَّسة على تقرير البشرة — استبدال Advisor التدريجي.',
      deliverablesAr: [
        'POST /consultation/sessions + /messages (بدون بث)',
        'MceGroundingPipeline من SkinAnalysis.resultJson',
        'MceModeration + MceResponseValidator',
        'Flutter: ConsultationThreadScreen من شاشة نتيجة البشرة',
        'Advisor الحالي → يوجّه إلى MCE (domain: skin)',
      ],
      exitAr: '✓ 20 سؤال تجريبي بإجابات تستشهد بتقرير البشرة · ✓ رفض طبي يعمل',
      filesAr: [
        'consultation-orchestrator.service.ts',
        'mce-grounding-pipeline.service.ts',
        'lib/features/consultation/presentation/screens/',
      ],
    },
    {
      n: 3,
      id: 'phase-3',
      titleAr: 'الإطلالة والمناسبة',
      durationAr: 'أسبوع 4–5',
      status: 'done',
      goalAr: 'أسئلة الأسلوب · التناسق · المناسبة · الإكسسوارات — مربوطة بتحليل الإطلالة.',
      deliverablesAr: [
        'ربط outfitAnalysisId في الجلسة — snapshot جديد version++',
        'OutfitContextSummaryV1 من Vision Platform path',
        'تصنيف النية: styling · occasion · accessory · makeup',
        'دخول من outfit_result_screen + AnalysisSession → server IDs',
        'بطاقات اقتراح follow-up عربية',
      ],
      exitAr: '✓ لا تناقض مع DeterministicOutfitEngine · ✓ يذكر analysisGate إن blocked',
      filesAr: [
        'mce-fact-extractor.ts (outfit)',
        'bind_analysis_context_usecase.dart',
      ],
    },
    {
      n: 4,
      id: 'phase-4',
      titleAr: 'Atelier والبث الحي',
      durationAr: 'أسبوع 6–7',
      status: 'done',
      goalAr: 'شرح نتائج التلوين وQEL · تجربة محادثة احترافية مع بث.',
      deliverablesAr: [
        'حفظ atelier_recolor_attempts عند كل تجربة QEL',
        'AtelierContextSummaryV1 في snapshot',
        'POST .../messages/stream — SSE',
        'واجهة بث + optimistic updates + شارات ثقة',
        'استشهادات (citation chips) للحقائق',
      ],
      exitAr: '✓ يشرح قبول/رفض QEL بدون اختراع درجات · ✓ latency مقبول على 4G',
      filesAr: [
        'mce-llm.service.ts (stream)',
        'mce_streaming_text.dart',
        'vision/qel → persist hook',
      ],
    },
    {
      n: 5,
      id: 'phase-5',
      titleAr: 'الذاكرة · التكلفة · الإنتاج',
      durationAr: 'أسبوع 8+',
      status: 'done',
      goalAr: 'جاهزية 100k+ مستخدمة — ذاكرة مضغوطة · خطط · تقييم.',
      deliverablesAr: [
        'MceMemoryCompaction — rollingSummary كل 8 أدوار',
        'حدود الخطة: free 10/يوم · premium 100/يوم',
        'لوحة تكلفة توكن · FAQ cache في Redis',
        'مجموعة تقييم 200 سؤال/جواب عربي',
        'خطافات: صوت · سوق · تصعيد خبير بشري (مستقبل)',
      ],
      exitAr: '✓ ~4000 token/دورة · ✓ حذف GDPR · ✓ Go/No-Go للإطلاق العام',
      filesAr: [
        'mce-memory-compaction.service.ts',
        'mce-cost-guard.service.ts',
        'docs/mira-mce-eval/ (مستقبل)',
      ],
    },
  ];

  const RISKS = [
    { severity: 'حرج', riskAr: 'اختراع درجات بشرة أو إطلالة', impactAr: 'فقدان ثقة فوري', mitAr: 'MceResponseValidator + factRegistry' },
    { severity: 'حرج', riskAr: 'نصائح طبية / وصفات', impactAr: 'مسؤولية قانونية', mitAr: 'advisor-guard ممتد + قاصر' },
    { severity: 'عالي', riskAr: 'نموذجان للإطلالة', impactAr: 'إجابات متناقضة', mitAr: 'OutfitAnalysis Vision فقط' },
    { severity: 'عالي', riskAr: 'إرسال JSON كامل كل دورة', impactAr: 'تكلفة غير قابلة للاستمرار', mitAr: 'snapshotId + ضغط' },
    { severity: 'عالي', riskAr: 'Advisor + MCE معاً', impactAr: 'إجابتان مختلفتان', mitAr: 'إحالة Advisor → MCE' },
    { severity: 'متوسط', riskAr: 'حقن برومبت', impactAr: 'تجاوز القواعد', mitAr: 'فصل system/user · تدقيق' },
    { severity: 'متوسط', riskAr: 'جودة عربية', impactAr: 'تجربة رديئة', mitAr: 'مجموعة تقييم 200' },
  ];

  const ENDPOINTS = [
    { method: 'POST', path: '/consultation/sessions', descAr: 'إنشاء جلسة + ربط سياق' },
    { method: 'GET', path: '/consultation/sessions', descAr: 'قائمة الجلسات' },
    { method: 'POST', path: '/consultation/sessions/:id/messages', descAr: 'رسالة (عادي)' },
    { method: 'POST', path: '/consultation/sessions/:id/messages/stream', descAr: 'بث SSE' },
    { method: 'GET', path: '/consultation/sessions/:id/messages', descAr: 'سجل الرسائل' },
    { method: 'PATCH', path: '/consultation/sessions/:id/context', descAr: 'إضافة إطلالة/تلوين' },
    { method: 'POST', path: '/outfit-analysis/snapshots', descAr: 'حفظ intelligence إطلالة (Vision)' },
    { method: 'DELETE', path: '/consultation/sessions/:id', descAr: 'حذف — GDPR' },
  ];

  const DEMO_INTENTS = {
    skin_hydration: {
      labelAr: 'ترطيب البشرة',
      contextAr: 'تقرير بشرة: ترطيب 62 · نوع مختلط · مسام مرئية خفيفة',
      questionsAr: ['لماذا ترطيبي منخفض؟', 'ما السيروم المناسب؟', 'هل أستخدم مرطب صباحاً أم مساءً؟'],
      answerAr:
        'وفق تقريركِ، درجة الترطيب 62/100 — أقل من المثالي لبشرتكِ المختلطة. المسام المرئية خفيفاً قد ترتبط بجفاف سطحي وليس بالضرورة بحب شباب. أنصحِ بتركيز على ترطيب خفيف صباحاً مع طبقة واقية، ومرطب أغنى مساءً — دون وصف دواء. الثقة: عالية — مبنية على تقريركِ المخزّن.',
      confidence: 'high',
      citesAr: ['skin.hydration.score', 'skin.type', 'skin.pores.severity'],
    },
    outfit_occasion: {
      labelAr: 'مناسبة العمل',
      contextAr: 'إطلالة: بلوزة+بنطلون · تناسق 78 · مناسبة عمل 82',
      questionsAr: ['هل تناسب العمل؟', 'أي لون حذاء؟', 'ماذا أضيف للأناقة؟'],
      answerAr:
        'إطلالتكِ (قطعتان — upper+lower) تحقق 82% لمناسبة العمل. التناسق اللوني 78% — جيد مع مجال لرفع التباين بإكسسوار محايد. الحذاء: بني داكن أو أسود مطفي يتماشى مع البنطلون دون منافسة البلوزة. لا أقترح تغيير القصة — فقط إكسسوار بسيط. الثقة: عالية.',
      confidence: 'high',
      citesAr: ['outfit.occasionMatch', 'outfit.colorHarmony', 'outfit.topology'],
    },
    atelier_recolor: {
      labelAr: 'تلوين Atelier',
      contextAr: 'فستان · أزرق→أسود · QEL: Accept · هوية 0.91',
      questionsAr: ['لماذا نجح التلوين؟', 'هل اللون دقيق؟', 'هل مسّ الوجه؟'],
      answerAr:
        'تجربة التلوين: فستان (قطعة واحدة) إلى أسود — QEL قبل العرض. الهوية 0.91 (ممتاز) — الوجه والبشرة لم يُمسّا. الحواف نظيفة. اللون قريب من المطلوب. هذا تلوين قماش فقط — لا إعادة توليد. إن رُفضت لاحقاً سأشرح السبب من درجات QEL لا من تخمين.',
      confidence: 'high',
      citesAr: ['atelier.qel.identity', 'atelier.qel.gate', 'atelier.scope'],
    },
  };

  const COST_DEFAULTS = {
    sessionsPerUser: 4,
    turnsPerSession: 6,
    inputTokens: 4050,
    outputTokens: 600,
    miniInputPer1M: 0.15,
    miniOutputPer1M: 0.6,
    mau: 100000,
    adoptionRate: 0.3,
  };

  const MEMORY_MODEL = [
    { tier: 'قصيرة', descAr: 'آخر 6–10 أزواج رسائل + snapshot نشط', ttlAr: 'مدة الجلسة' },
    { tier: 'ضغط', descAr: 'كل 8 أدوار → rollingSummaryAr', ttlAr: 'دائم في الجلسة' },
    { tier: 'طويلة', descAr: 'تفضيلات مُشتقة (ألوان · أسلوب) — لا نص خام', ttlAr: 'عبر الجلسات — مرحلة 5+' },
  ];

  const IMPLEMENTATION = {
    updatedAt: '2026-06-01',
    phases: {
      1: {
        status: 'done',
        labelAr: '✅ مكتملة',
        resultsAr: [
          'Prisma: consultation_sessions · messages · snapshots · recommendations',
          'عقد MceContextSnapshotV1 + factRegistry',
          'mira-api/src/consultation/ — module كامل',
          'Migration: 20250610120000_consultation_mce',
        ],
        verifyAr: 'cd mira-api && npx prisma generate && npm run build',
      },
      2: {
        status: 'done',
        labelAr: '✅ مكتملة',
        resultsAr: [
          'POST /consultation/sessions + /sessions/:id/messages',
          'MceGroundingPipeline من SkinAnalysis',
          'MceLlmService + Prompt + Validator + Moderation',
          'Advisor → MCE bridge (بدون جلسة لكل رسالة legacy)',
          'Flutter: ConsultationApiDataSource + مستشار ميرا بجلسة MCE',
        ],
        verifyAr: 'اختبار من شاشة نتيجة البشرة → اسألي ميرا',
      },
      3: {
        status: 'done',
        labelAr: '✅ مكتملة',
        resultsAr: [
          'OutfitContextSummaryV1 من Prisma + Vision snapshots',
          'PATCH /consultation/sessions/:id/context — snapshot version++',
          'POST /outfit-analysis/snapshots — حفظ intelligence بدون صورة',
          'MceIntentClassifier: styling · occasion · accessory · makeup',
          'Flutter: AskOutfitMiraSection + حفظ snapshot + جلسة MCE',
        ],
        verifyAr: 'من نتيجة الإطلالة → اسألي ميرا عن إطلالتك',
      },
      4: {
        status: 'done',
        labelAr: '✅ مكتملة',
        resultsAr: [
          'Prisma: atelier_recolor_attempts — QEL metadata بدون صور',
          'AtelierContextSummaryV1 في MCE snapshot + حقائق atelier.*',
          'POST /consultation/sessions/:id/messages/stream — SSE',
          'Flutter: بث حي + شارات ثقة + citation chips',
          'دخول من لوحة التلوين → اسألي ميرا عن QEL',
        ],
        verifyAr: 'جرّبي تلوين → اسألي ميرا عن التلوين',
      },
      5: {
        status: 'done',
        labelAr: '✅ مكتملة',
        resultsAr: [
          'MceMemoryCompaction — rollingSummary كل 8 أدوار',
          'MceCostGuard — free 10/يوم · premium 100/يوم + FAQ cache Redis',
          'DELETE /consultation/sessions/:id — GDPR',
          'mce-eval-cases.json + runner للتقييم',
        ],
        verifyAr: 'cd mira-api && npm run build && npx ts-node src/consultation/eval/mce-eval.runner.ts',
      },
    },
  };

  global.MIRA_MCE = {
    META: MCE_META,
    VERDICT,
    GOLDEN_RULES,
    LAYERS,
    PHASES,
    RISKS,
    ENDPOINTS,
    DEMO_INTENTS,
    COST_DEFAULTS,
    MEMORY_MODEL,
    IMPLEMENTATION,
  };
})(typeof window !== 'undefined' ? window : globalThis);
