/**
 * موقع تطوير ميرا — Technical Discovery & Architecture Audit
 * READ-ONLY evidence report · v1.0.0 · 2026-07-19
 * No production code changes. No invented accuracy claims.
 */
(function () {
  'use strict';

  const SPEC = {
    version: '1.0.0',
    date: '2026-07-19',
    mode: 'READ-ONLY',
    title: 'موقع تطوير ميرا',
  };

  const SCORES = [
    { id: 'arch', label: 'الهيكل المعماري', score: 6, note: 'modular جزئياً · مسارات مزدوجة' },
    { id: 'face', label: 'مصداقية تحليل الوجه', score: 4, note: 'MediaPipe للالتقاط فقط' },
    { id: 'beauty', label: 'مصداقية درجة الجمال', score: 3, note: 'صيغة محلية · ليست جاذبية' },
    { id: 'skin', label: 'مصداقية البشرة', score: 7, note: 'YouCam عند الإعداد · خطر mock' },
    { id: 'fashion', label: 'ذكاء الموضة', score: 6, note: 'FASHN+OpenAI + قواعد' },
    { id: 'privacy', label: 'الخصوصية', score: 7, note: 'S2S جيد · rawYouCam يُخزَّن' },
    { id: 'tests', label: 'الاختبارات', score: 4, note: 'صيَغ داخلية · لا دقة سريرية' },
    { id: 'ops', label: 'CI/CD · مراقبة', score: 2, note: 'لا GitHub CI · لا Crashlytics' },
    { id: 'scale', label: 'قابلية التوسع', score: 5, note: 'Render free · rate 30/h' },
    { id: 'maintain', label: 'قابلية الصيانة', score: 5, note: 'docs متضاربة · legacy paths' },
  ];

  function scoreClass(n) {
    if (n <= 3) return 'low';
    if (n <= 6) return 'mid';
    return 'high';
  }

  function evid(path, sym, lines, conf, kind) {
    return { path, sym, lines, conf, kind };
  }

  /* ── Feature inventory ── */
  const FEATURES = [
    {
      id: 'mediapipe',
      name: 'MediaPipe Face Mesh (468)',
      area: 'face',
      source: 'cv',
      reliability: 'Capture UX فقط — لا تشخيص بشرة',
      evidence: evid(
        'lib/features/skin_analysis/presentation/live_face_map/face_mesh_service.dart',
        'FaceMeshService',
        '14–196',
        'Confirmed',
        'Classical CV (MediaPipe)',
      ),
      detail:
        'يتطلب landmarks ≥ 468. يبني مناطق تشريحية. quality high/med/low من mesh.score. لا يغذي beauty score ولا YouCam scores.',
    },
    {
      id: 'mesh_gate',
      name: 'FaceMeshQualityGate',
      area: 'capture',
      source: 'heuristic',
      reliability: 'بوابة التقاط جيدة · لا تقيس blur/إضاءة رقمياً',
      evidence: evid(
        'lib/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart',
        'FaceMeshQualityGate.evaluate / canTakePhoto',
        '7–108',
        'Confirmed',
        'Heuristic on CV',
      ),
      detail: 'يرفض: لا وجه · جودة منخفضة · مناطق ناقصة · انحراف مركز · وجه بعيد/قريب (نسبة ارتفاع الدليل).',
    },
    {
      id: 'mlkit_gate',
      name: 'ML Kit Face Gate (بعد الالتقاط)',
      area: 'capture',
      source: 'ml',
      reliability: 'يمنع صور بلا وجه / متعددة / بزاوية حادة',
      evidence: evid(
        'lib/core/face_gate/',
        'FaceGateValidator + FaceGateRules',
        'threshold rules',
        'Confirmed',
        'ML Kit + heuristic',
      ),
      detail: 'عدد الوجوه · نسبة مساحة الوجه 5–95% · yaw≤42° · roll≤32° · تمركز.',
    },
    {
      id: 'youcam_skin',
      name: 'تحليل البشرة YouCam (Perfect Corp)',
      area: 'skin',
      source: 'api',
      reliability: 'إنتاجي عند وجود مفتاح · ليس تشخيصاً طبياً',
      evidence: evid(
        'mira-api/src/ai/services/perfect-corp.service.ts',
        'PerfectCorpService.analyzeSkin',
        '25–43 · mapYouCamResults',
        'Confirmed',
        'Third-party API',
      ),
      detail:
        'dst_actions الافتراضية: wrinkle, pore, texture, acne, moisture, oiliness, redness, age_spot. Flutter لا يحمل المفتاح.',
    },
    {
      id: 'mock_fallback',
      name: 'Mock fallback عند فشل YouCam',
      area: 'skin',
      source: 'mock',
      reliability: 'خطر إنتاجي — نتائج مزروعة تبدو حقيقية',
      evidence: evid(
        'mira-api/src/ai/mocks/perfect-corp-skin.provider.ts',
        'PerfectCorpSkinProvider.analyze',
        '41–84',
        'Confirmed',
        'Mock',
      ),
      detail: 'render.yaml يضبط PERFECT_CORP_FALLBACK_MOCK=true. أخطاء جودة الوجه لا تُحاكى؛ فشل الشبكة/API قد يُرجع mock.',
    },
    {
      id: 'beauty_score',
      name: 'درجة الجمال (Beauty Score)',
      area: 'beauty',
      source: 'heuristic',
      reliability: 'درجة صحة بشرة مرجّحة — ليست جاذبية / تناسب ذهبي',
      evidence: evid(
        'lib/features/skin_analysis/domain/services/beauty_score_engine.dart',
        'BeautyScoreEngine.compute',
        '49–107',
        'Confirmed',
        'Heuristic formula',
      ),
      detail:
        'أوزان إيجابية (hydration 0.22…) وسلبية (acne 0.14…). عقوبات مركبة · soft-cap · smoothing ±4. لا golden ratio · لا symmetry · لا thirds/fifths.',
    },
    {
      id: 'capture_unwired',
      name: 'CaptureQualitySignals غير مربوط',
      area: 'beauty',
      source: 'hardcoded',
      reliability: 'دائماً تقريباً neutral — لا يؤثر فعلياً',
      evidence: evid(
        'mira-api/src/intelligence/intelligence.service.ts',
        'computeBeautyScore(skin, { previousScore })',
        '82–84',
        'Confirmed',
        'Hard-coded defaults',
      ),
      detail: 'neutral(): lighting=0.72 · angle=10° · blur=0.14 (capture_quality_signals.dart:19–22).',
    },
    {
      id: 'symmetry',
      name: 'تناظر / أثلاث / أخماس الوجه',
      area: 'face',
      source: 'absent',
      reliability: 'غير موجود في المسار الحالي',
      evidence: evid('—', 'repo search', 'no implementation', 'Confirmed', 'Absent'),
      detail: 'لا معادلات تناسب ذهبي ولا قياسات thirds/fifths في مسار البشرة/الذكاء.',
    },
    {
      id: 'face_shape',
      name: 'شكل الوجه / جنس / جاذبية',
      area: 'face',
      source: 'absent',
      reliability: 'غير مُنفَّذ في مسار البشرة',
      evidence: evid('—', 'skin path', '—', 'Confirmed', 'Absent'),
      detail: 'يوجد UserGender في الموضة فقط. شكل الوجه غير محسوب من landmarks.',
    },
    {
      id: 'undertone',
      name: 'Undertone',
      area: 'skin',
      source: 'heuristic',
      reliability: 'غالباً مُستنتج محلياً — ليس في dst_actions الافتراضية',
      evidence: evid(
        'mira-api/src/intelligence/pipeline/undertone-intelligence.ts',
        'resolveUndertone',
        '79–88',
        'Confirmed',
        'API if present else heuristic',
      ),
      detail: 'يفضّل parse من YouCam ثم يستنتج من redness/moisture/age_spot.',
    },
    {
      id: 'skin_age',
      name: 'تقدير عمر البشرة',
      area: 'skin',
      source: 'heuristic',
      reliability: 'صيغة — ليس نموذجاً عمرية',
      evidence: evid(
        'mira-api/src/ai/services/perfect-corp.service.ts',
        'estimateSkinAge',
        '~470–475',
        'Confirmed',
        'Heuristic',
      ),
      detail: 'نمط: 28 + (100−avg)/4 · mock: 26+seed%14.',
    },
    {
      id: 'vision_outfit',
      name: 'Vision Outfit Analyze',
      area: 'fashion',
      source: 'api',
      reliability: 'مسار حي: FASHN geometry + OpenAI semantic',
      evidence: evid(
        'mira-api/src/vision/vision-orchestrator.service.ts',
        'VisionOrchestratorService.analyze',
        '72–247',
        'Confirmed',
        'Third-party API + LLM',
      ),
      detail: 'Flutter → POST /ai/vision/outfit/analyze. التسجيل على السيرفر analysis:null — التسجيل في Flutter.',
    },
    {
      id: 'outfit_mock',
      name: 'OUTFIT_PROVIDER=mock (legacy)',
      area: 'fashion',
      source: 'mock',
      reliability: 'مسار قديم لا يزال مفعّلاً على Render',
      evidence: evid('render.yaml', 'OUTFIT_PROVIDER', '27–28', 'Confirmed', 'Mock'),
      detail: 'يؤثر على /ai/outfit-analysis فقط — ليس Vision Platform.',
    },
    {
      id: 'delta_e',
      name: 'مطابقة الألوان CIEDE2000',
      area: 'fashion',
      source: 'heuristic',
      reliability: 'قوي تقنياً للألوان · كتالوج يدوي',
      evidence: evid(
        'lib/features/outfit_analysis/domain/catalog/professional_color_matcher.dart',
        'ProfessionalColorMatcher.deltaE2000',
        '~33–266',
        'Confirmed',
        'Heuristic (classical color science)',
      ),
      detail: 'يوجد أيضاً CIE76 في FashionColorLibrary — خوارزميتان مكررتان.',
    },
    {
      id: 'fashion_rank',
      name: 'ترتيب توصيات الكتالوج',
      area: 'fashion',
      source: 'heuristic',
      reliability: 'قواعد يدوية + JSON توافق',
      evidence: evid(
        'lib/features/outfit_analysis/domain/intelligence/fashion_ranking_engine.dart',
        'FashionRankingEngine.rank',
        '14–105',
        'Confirmed',
        'Rule-based',
      ),
      detail: 'finalScore = clamp(48 + Σ, 0, 98). bodyType في السياق غالباً null → boost=0.',
    },
    {
      id: 'body_measure',
      name: 'قياسات الجسم',
      area: 'fashion',
      source: 'heuristic',
      reliability: 'نِسب وضعية فقط — لا شريط قياس',
      evidence: evid(
        'lib/features/outfit_analysis/domain/services/outfit_body_silhouette_builder.dart',
        'OutfitBodySilhouetteBuilder.classify',
        '30–48',
        'Confirmed',
        'Heuristic on ML Kit pose',
      ),
      detail: 'petite/average/tall/plusSize من نسب landmarks — ليس bust/waist/hip.',
    },
    {
      id: 'makeup_vto',
      name: 'Makeup Virtual Try-On',
      area: 'perfect',
      source: 'absent',
      reliability: 'مخطط في docs فقط — لا كود',
      evidence: evid(
        'docs/perfect-services.js',
        'makeup_vto miraStatus p0',
        'planned',
        'Confirmed',
        'Absent in code',
      ),
      detail: 'لا perfect-corp-makeup.service.ts · لا lib/features/makeup_tryon/. توصيات نصية فقط.',
    },
  ];

  const FACE_TABLE = [
    ['كشف الوجه (حي)', 'MediaPipe', 'FaceMeshService', 'كاميرا', '—', 'Confirmed', 'جودة التتبع فقط', 'لا تشخيص'],
    ['معالم 468', 'MediaPipe', 'FaceMeshService', 'إطار فيديو', 'topology regions', 'Confirmed', 'جيد للـ UX', 'ليس دقة سريرية مُقاسة'],
    ['بوابة التقاط', 'Heuristic', 'FaceMeshQualityGate', 'mesh frame', 'عتبات مركز/مسافة', 'Confirmed', 'متوسط–جيد', 'لا blur meter'],
    ['بوابة بعد الالتقاط', 'ML Kit', 'FaceGateValidator', 'صورة ثابتة', 'مساحة/زاوية', 'Confirmed', 'جيد', 'لا إضاءة كمية'],
    ['تناظر الوجه', '—', 'Absent', '—', '—', 'Confirmed', 'N/A', 'قد يُفهم خطأ من UI'],
    ['أثلاث/أخماس', '—', 'Absent', '—', '—', 'Confirmed', 'N/A', '—'],
    ['شكل الوجه', '—', 'Absent (skin)', '—', '—', 'Confirmed', 'N/A', '—'],
    ['درجة الجمال', 'Heuristic', 'BeautyScoreEngine', 'metrics بشرة', 'أوزان+عقوبات', 'Confirmed', 'اتساق داخلي فقط', 'مضلّل إن عُرض كجاذبية'],
    ['هموم البشرة', 'YouCam API', 'PerfectCorpService', 'JPEG S2S', 'ui_score', 'Confirmed', 'يعتمد على Perfect', 'mock fallback خطر'],
    ['Undertone', 'API|Heuristic', 'resolveUndertone', 'scores', 'infer rules', 'Confirmed', 'جزئي', 'غالباً inferred'],
    ['عمر البشرة', 'Heuristic', 'estimateSkinAge', 'avg concerns', '28+(100-avg)/4', 'Confirmed', 'ضعيف كعمر', 'ليس نموذجاً'],
  ];

  const FASHION_TABLE = [
    ['كشف الملابس', 'FASHN API geometry', 'FashnGeometryProvider', 'حي (Vision)', 'Segmentation masks', 'فجوة: اعتماد vendor'],
    ['تصنيف دلالي', 'OpenAI LLM', 'OpenAiSemanticProvider', 'حي', 'JSON schema', 'هلوسة محتملة'],
    ['لون القطعة', 'CIEDE2000 + كتالوج', 'ProfessionalColorMatcher', 'موثوق نسبياً', 'كتالوج يدوي', 'CIE76 مكرر'],
    ['توافق القطع', 'JSON يدوي', 'compatibility.json', 'مؤلف يدوياً', 'غير متعلم', 'محدود'],
    ['ترتيب التوصيات', 'قواعد', 'FashionRankingEngine', 'قابل للتفسير', 'bodyType unused', 'تنويع ضعيف'],
    ['درجة الإطلالة', 'قواعد مرجّحة', 'OutfitScoreEngine', 'اتساق اختباري', 'لا ground truth', 'أوزان ثابتة'],
    ['قياسات الجسم', 'نسب وضعية', 'OutfitBodySilhouetteBuilder', 'ضعيف', 'لا قياسات حقيقية', 'لا تستخدم في recs'],
    ['إعادة تلوين', 'FASHN Edit API', 'FashnGarmentRecolorService', 'حي مع QEL', 'تكلفة/latency', '—'],
    ['توليد أصول AI', 'placeholder', 'scripts/asset_factory.dart', 'غير موصول', 'placeholder PNGs', 'خطر إنتاج'],
    ['مسار legacy mock', 'Mock', 'OUTFIT_PROVIDER=mock', 'مفعّل Render', 'ازدواجية', 'إرباك'],
  ];

  const RISKS = [
    {
      risk: 'PERFECT_CORP_FALLBACK_MOCK=true على Render',
      area: 'Skin',
      evidence: 'render.yaml:33–34 · perfect-corp-skin.provider.ts:41–84',
      prob: 'عالية',
      impact: 'عالي',
      sev: 'critical',
      blocker: true,
      mitigation: 'ضبط false في الإنتاج · فشل صريح بدل mock',
    },
    {
      risk: 'عرض Beauty Score كـ«جمال علمي»',
      area: 'Beauty',
      evidence: 'beauty_score_engine.dart · BeautyScoreHero',
      prob: 'عالية',
      impact: 'عالي',
      sev: 'critical',
      blocker: true,
      mitigation: 'إعادة تسمية: درجة صحة البشرة · إخلاء مسؤولية',
    },
    {
      risk: 'CaptureQualitySignals غير مربوط',
      area: 'Beauty',
      evidence: 'intelligence.service.ts:82–84 · capture_quality_signals.dart:19–22',
      prob: 'مؤكدة',
      impact: 'متوسط',
      sev: 'high',
      blocker: false,
      mitigation: 'تمرير إشارات من MediaPipe/ML Kit إلى المحرك',
    },
    {
      risk: 'تخزين rawYouCam في resultJson',
      area: 'Privacy',
      evidence: 'skin-analysis.service.ts buildStoredPayload',
      prob: 'مؤكدة',
      impact: 'متوسط–عالي',
      sev: 'high',
      blocker: false,
      mitigation: 'تقليم الحقول · سياسة احتفاظ · مراجعة قانونية',
    },
    {
      risk: 'OUTFIT_PROVIDER=mock مع مسار Vision حي',
      area: 'Fashion',
      evidence: 'render.yaml:27–28',
      prob: 'مؤكدة',
      impact: 'متوسط',
      sev: 'med',
      blocker: false,
      mitigation: 'توثيق المسار الأساسي · تعطيل legacy أو عزله',
    },
    {
      risk: 'تضارب docs: Perfect-only vs Banuba Phase2',
      area: 'Product',
      evidence: 'perfect-services.js · mira-phase2-platform.js',
      prob: 'مؤكدة',
      impact: 'متوسط',
      sev: 'med',
      blocker: false,
      mitigation: 'مصدر حقيقة واحد للاستراتيجية',
    },
    {
      risk: 'لا CI · Jest غير موصول بوضوح',
      area: 'Ops',
      evidence: 'لا .github/workflows · package.json بدون npm test واضح',
      prob: 'مؤكدة',
      impact: 'عالي',
      sev: 'high',
      blocker: true,
      mitigation: 'GitHub Actions: flutter test + nest build + vision schemas',
    },
    {
      risk: 'لا Crashlytics / Analytics إنتاجي',
      area: 'Ops',
      evidence: 'mira_analytics.dart stub · لا Crashlytics',
      prob: 'مؤكدة',
      impact: 'متوسط',
      sev: 'med',
      blocker: false,
      mitigation: 'Crashlytics + أحداث تحليل بدون صور',
    },
    {
      risk: 'Vendor lock-in YouCam + FASHN + OpenAI',
      area: 'Architecture',
      evidence: 'ai.module.ts providers',
      prob: 'متوسطة',
      impact: 'عالي',
      sev: 'med',
      blocker: false,
      mitigation: 'Ports: SkinAnalysisPort · FashionAnalysisPort · fallback',
    },
    {
      risk: 'تكلفة API مع النمو',
      area: 'Cost',
      evidence: 'credits YouCam · FASHN · OpenAI · RATE_LIMIT 30/h',
      prob: 'عالية',
      impact: 'عالي',
      sev: 'high',
      blocker: false,
      mitigation: 'حصص · كاش · حدود باقات',
    },
    {
      risk: 'ادعاءات طبية / App Store',
      area: 'Compliance',
      evidence: 'تحليل بشرة + درجة جمال',
      prob: 'متوسطة',
      impact: 'عالي',
      sev: 'high',
      blocker: true,
      mitigation: 'صياغة تجميلية · لا تشخيص · مراجعة قانونية سعودية',
    },
    {
      risk: 'تحيز لون البشرة / إضاءة',
      area: 'Bias',
      evidence: 'لا مجموعة اختبار متنوعة موثّقة',
      prob: 'عالية',
      impact: 'عالي',
      sev: 'high',
      blocker: true,
      mitigation: 'مجموعة تحقق Fitzpatrick I–VI · إضاءة متعددة',
    },
  ];

  const ROADMAP = [
    {
      phase: 'Phase 0 — حقيقة وأمان',
      complexity: 'Medium',
      items: [
        'تعطيل PERFECT_CORP_FALLBACK_MOCK في الإنتاج',
        'إعادة تسمية/إخلاء مسؤولية Beauty Score',
        'مواءمة سياسة الخصوصية مع rawYouCam',
        'مصدر استراتيجية واحد (Perfect-only)',
      ],
    },
    {
      phase: 'Phase 1 — استقرار الهيكل',
      complexity: 'Large',
      items: [
        'توحيد مسار الإطلالة (Vision فقط)',
        'Ports للتحليل (Skin/Fashion/Quality)',
        'CI: flutter test + API build',
        'إزالة stubs الميتة في الجذر',
      ],
    },
    {
      phase: 'Phase 2 — أساس وجه موثوق',
      complexity: 'Large',
      items: [
        'ربط CaptureQualitySignals من الـ mesh',
        'بوابة جودة كاملة: إضاءة/ضبابية/وضع',
        'لا نتائج بدون confidence',
        'اختبارات تكرار نفس الصورة',
      ],
    },
    {
      phase: 'Phase 3 — بشرة احترافية',
      complexity: 'Medium',
      items: [
        'توسيع Perfect: Color Tones · Fitzpatrick',
        'لا fallback صامت',
        'تقليم تخزين raw',
        'مجموعة تحقق مقابل تسميات خبراء (مقترح)',
      ],
    },
    {
      phase: 'Phase 4 — رؤية موضة',
      complexity: 'XL',
      items: [
        'Wardrobe digitization',
        'تفعيل body context في ranking',
        'توحيد ΔE',
        'إزالة placeholders من الإنتاج',
      ],
    },
    {
      phase: 'Phase 5 — تجارب Perfect المميزة',
      complexity: 'XL',
      items: [
        'Makeup VTO عبر Perfect (حسب الاستراتيجية)',
        'Makeup Transfer · Look VTO',
        'Clothes try-on POC',
        'Feature flags + cost controls',
      ],
    },
    {
      phase: 'Phase 6 — تحقق وإطلاق',
      complexity: 'Large',
      items: [
        'اختبارات تحيز وتنوع',
        'عتبات إطلاق مقترحة (ليست نتائج حالية)',
        'مراجعة قانونية',
        'إطلاق محدود',
      ],
    },
    {
      phase: 'Phase 7 — مقياس ومراقبة',
      complexity: 'Medium',
      items: [
        'Observability · SLOs',
        'مراقبة تكلفة API',
        'Model/provider drift alerts',
        'تعلم من feedback المستخدم',
      ],
    },
  ];

  const VERDICT_QA = [
    {
      q: '١. هل التطبيق جاهز تقنياً للإطلاق العام؟',
      a: 'لا — ليس كمنتج premium موثوق. يوجد أساس قوي (YouCam skin S2S · Vision outfit · بوابات التقاط)، لكن mock fallback، صياغة درجة الجمال، غياب CI، ونقص تحقق الدقة تمنع إطلاق عام واثق.',
    },
    {
      q: '٢. ما الميزات الموثوقة اليوم؟',
      a: 'التقاط بوجه MediaPipe + بوابات ML Kit؛ تحليل بشرة YouCam عند نجاح API؛ مسار Vision للإطلالة (FASHN+OpenAI)؛ مطابقة ألوان CIEDE2000؛ مصادقة Firebase؛ عدم إرسال مفاتيح Perfect من Flutter.',
    },
    {
      q: '٣. ما النماذج الأولية أو المضلِّلة؟',
      a: 'Beauty Score كـ«جمال»؛ عمر البشرة الصيَغي؛ undertone المستنتج؛ mock skin/outfit؛ CaptureQuality غير المربوط؛ توصيات كتالوج بقواعد بدون تعلم؛ قياسات جسم وهمية؛ Makeup VTO غير موجود.',
    },
    {
      q: '٤. هل محرك تحليل الوجه حقيقي وموثوق وقابل للتكرار؟',
      a: 'الـ mesh حقيقي (MediaPipe). «تحليل الجمال/التناسب» كمحرك هندسي غير موجود. تكرار نفس الصورة يعتمد على YouCam + صيغة محلية؛ لا اختبار تكرار إنتاجي موثّق في المستودع.',
    },
    {
      q: '٥. هل تحليل البشرة موثوق تقنياً؟',
      a: 'عند عمل YouCam: نعم كتحليل تجميلي من مزود مؤسسي — مع تحفظات الإضاءة والكاميرا. عند تفعيل mock fallback: لا. ليس جهازاً طبياً ولا يُثبت بدقة سريرية في الاختبارات الحالية.',
    },
    {
      q: '٦. كيف تُحسب درجة الجمال فعلياً؟',
      a: 'BeautyScoreEngine / computeBeautyScore: أوزان إيجابية وسلبية على metrics البشرة + عقوبات مركبة + مرساة ~positive×0.62+30 + مضاعف جودة التقاط (غالباً neutral) + تنعيم زمني. ليست نسبة ذهبية ولا جاذبية.',
    },
    {
      q: '٧. ما الدقة التي يمكن إثباتها حالياً؟',
      a: 'يمكن إثبات اتساق الصيغ عبر unit tests. لا يمكن إثبات دقة سريرية أو Top-1 fashion أو اتفاق خبراء من المستودع الحالي. Not verifiable from the current repository.',
    },
    {
      q: '٨. هل نظام الموضة ذكي أم قواعد؟',
      a: 'هجين: كشف/وصف عبر ML/API (FASHN+OpenAI)، ثم ترتيب وتوافق وقواعد كتالوج يدوية. ليس نظام تعلم توصيات من feedback.',
    },
    {
      q: '٩. هل الهيكل جاهز لـ APIs احترافية؟',
      a: 'جزئياً — يوجد SkinAnalysisProvider و Vision providers. يحتاج Ports أوضح، إزالة المسارات المزدوجة، وfeature flags/cost controls قبل توسيع Perfect.',
    },
    {
      q: '١٠. هل يمكن دمج Perfect بدون إعادة كتابة كبرى؟',
      a: 'للبشرة: مدمج. لـ Makeup/Clothes: نعم عبر adapters جديدة خلف نفس نمط S2S على Render — بدون إعادة كتابة التطبيق بالكامل، لكن بعمل تكامل كبير جديد.',
    },
    {
      q: '١١. أهم 10 عوائق إطلاق؟',
      a: '1) mock fallback 2) صياغة Beauty Score 3) لا تحقق دقة/تحيز 4) لا CI 5) ادعاءات طبية/App Store 6) CaptureQuality unwired 7) تضارب الاستراتيجية 8) rawYouCam retention 9) placeholders/legacy outfit 10) مراقبة/Crashlytics.',
    },
    {
      q: '١٢. ماذا يُبنى أولاً ليصبح المنتج موثوقاً؟',
      a: 'Phase 0–2: أمان الحقيقة (لا mock صامت) · صياغة صادقة · بوابة جودة كاملة مربوطة بالدرجة · CI · ثم توسيع Perfect Color/Makeup بحذر.',
    },
    {
      q: '١٣. ماذا يُحتفظ / يُعاد هيكلته / يُستبدل / يُحذف؟',
      a: 'يُحتفظ: Perfect S2S skin · Vision orchestrator · MediaPipe capture · Firebase auth · Delta E. يُعاد: Beauty naming · intelligence merge · docs. يُستبدل/يُعزل: OUTFIT_PROVIDER mock path. يُحذف: stubs الجذر الفارغة · مسارات docs المتضاربة كمصادر حقيقة.',
    },
    {
      q: '١٤. هل الكود مفهوم لفريق جديد؟',
      a: 'متوسط (5/10). الموديولات موجودة لكن مسارات مزدوجة، docs متضاربة، وشاشات كبيرة تخلط UX بالمنطق. مهندس أول يفهم خلال أيام — لا ساعات.',
    },
    {
      q: '١٥. ما الأدلة الناقصة؟',
      a: 'دقة YouCam على مجموعة سعودية/خليجية؛ تكرار التحليل؛ اتفاق خبراء بشرة؛ IoU segmentation؛ قبول التوصيات؛ سياسات احتفاظ Perfect التفصيلية؛ مطابقة مسار avatar مع storage.rules؛ تشغيل Jest في CI.',
    },
  ];

  const ARCH_TREE = `mira/
├── lib/                          Flutter app (features: skin, outfit, intelligence, auth…)
│   ├── core/                     network, face_gate, privacy, config, ai mocks
│   └── features/skin_analysis/live_face_map/   MediaPipe UX
├── mira-api/                     NestJS · Prisma · Render
│   ├── ai/                       PerfectCorp · providers · face-gate
│   ├── intelligence/             beauty-score · undertone · face-map
│   ├── vision/                   FASHN · OpenAI · orchestrator · color
│   └── skin-analysis/            orchestration + store
├── assets/fashion/               catalog.json · colors.json · compatibility.json
├── docs/                         strategy HTML (perfect-services · phase2 · this site)
├── admin-portal/ · partners-portal/ · website/
└── render.yaml                   SKIN=perfect_corp · OUTFIT=mock · FALLBACK_MOCK=true`;

  const SKIN_FLOW = `UI FaceCapturePanel
  → LiveFaceOverlayController → FaceMeshService (MediaPipe 468)
  → FaceMeshQualityGate (shutter)
  → FaceGateValidator (ML Kit post-capture)
  → FaceImageProcessor.prepareForAnalysis
  → SkinAnalysisApiDataSource POST /api/v1/ai/skin-analysis
       → FaceGateService (sharp metadata only — no face ML)
       → PerfectCorpSkinProvider
            → PerfectCorpService (YouCam S2S)  OR  MockSkinAnalysisProvider
       → IntelligenceService.computeBeautyScore(skin, { previousScore })  ← no captureQuality
       → Firestore results (no image) + buffer.fill(0)
  → Flutter MiraBeautyReport / BeautyScoreHero`;

  const FASHION_FLOW = `UI outfit capture
  → OutfitCaptureValidator
  → VisionApiDataSource POST /ai/vision/outfit/analyze
       → VisionOrchestratorService
            → FashnGeometryProvider (masks)
            → OpenAiSemanticProvider (garments JSON)
            → normalize · topology · conflict · confidence · QEL
       → analysis: null (scoring client-side)
  → DeterministicOutfitEngine + OutfitScoreEngine
  → FashionRecommendationEngine / FashionRankingEngine
  → UI insights + optional FASHN recolor`;

  /* ── Render helpers ── */
  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function confTag(c) {
    const map = {
      Confirmed: 'conf-c',
      'Strongly inferred': 'conf-s',
      'Partially confirmed': 'conf-p',
      Unknown: 'conf-u',
    };
    return `<span class="tag ${map[c] || 'conf-u'}">${c}</span>`;
  }

  function sourceTag(s) {
    const map = {
      api: 'api',
      ml: 'ml',
      cv: 'cv',
      heuristic: 'heuristic',
      mock: 'mock',
      hardcoded: 'hardcoded',
      absent: 'absent',
    };
    const labels = {
      api: 'Third-party API',
      ml: 'ML / LLM',
      cv: 'Computer Vision',
      heuristic: 'Heuristic',
      mock: 'Mock',
      hardcoded: 'Hard-coded',
      absent: 'Absent',
    };
    return `<span class="tag ${map[s] || ''}">${labels[s] || s}</span>`;
  }

  function evidenceHtml(ev) {
    return `<div class="evidence">
<span class="path">${ev.path}</span><br>
<span class="sym">${ev.sym}</span> · <span class="lines">L${ev.lines}</span><br>
${ev.kind} · ${confTag(ev.conf)}
</div>`;
  }

  function renderHero(root) {
    const s = el('section', { id: 'verdict', class: 'hero-dev' });
    const scoreCards = SCORES.map(
      (x) => `
      <div class="score-card" title="${x.note}">
        <div class="score-val ${scoreClass(x.score)}">${x.score}<span style="font-size:0.9rem">/10</span></div>
        <div class="score-label">${x.label}</div>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:${x.score * 10}%;background:${x.score <= 3 ? 'var(--danger)' : x.score <= 6 ? 'var(--warn)' : 'var(--ok)'}"></div></div>
      </div>`,
    ).join('');

    s.innerHTML = `
      <span class="badge-pill">READ-ONLY · EVIDENCE AUDIT · ${SPEC.version} · ${SPEC.date}</span>
      <h1>${SPEC.title}<br><span style="font-size:0.55em;font-weight:500;color:var(--muted)">تدقيق تقني صارم — ما هو حقيقي وما هو وهم</span></h1>
      <p class="lead">
        تدقيق قائم على الملفات والأكواد فقط. لا تعديل على المستودع أثناء هذا العمل.
        كل نتيجة مهمة مربوطة بمسار ملف · رمز · أسطر · مستوى ثقة · وتصنيف مصدر الحقيقة.
      </p>
      <div class="card danger">
        <h3 style="margin-top:0;">الحكم التنفيذي</h3>
        <p><strong>غير جاهز لإطلاق عام premium موثوق.</strong> الأساس التقني موجود (YouCam للبشرة · Vision للإطلالة · MediaPipe للالتقاط)،
        لكن درجة «الجمال» صيغة محلية على هموم البشرة، و<code>PERFECT_CORP_FALLBACK_MOCK=true</code> قد يعرض نتائج مزروعة،
        ولا توجد أدلة دقة سريرية/تحيز في المستودع.</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="num">${FEATURES.length}</div><div class="lbl">ميزة مُدقَّقة</div></div>
        <div class="stat-card"><div class="num">${RISKS.length}</div><div class="lbl">مخاطر مسجّلة</div></div>
        <div class="stat-card"><div class="num">1</div><div class="lbl">Perfect live (skin)</div></div>
        <div class="stat-card"><div class="num">0</div><div class="lbl">Makeup VTO في الكود</div></div>
      </div>
      <h3>درجات المجالات (0–10 · أدلة)</h3>
      <div class="score-row">${scoreCards}</div>
      <div class="toc-grid">
        <a class="toc-link" href="#subsystem-registry">Subsystem Registry (SSOT)</a>
        <a class="toc-link" href="#inventory">٤. مخزون الميزات</a>
        <a class="toc-link" href="#architecture">٣. خريطة الهيكل</a>
        <a class="toc-link" href="#face">٥–٦. الوجه والحسابات</a>
        <a class="toc-link" href="#beauty">٧. درجة الجمال</a>
        <a class="toc-link" href="#skin">٨. البشرة</a>
        <a class="toc-link" href="#capture">٩. جودة الالتقاط</a>
        <a class="toc-link" href="#fashion">١٠–١١. الموضة</a>
        <a class="toc-link" href="#perfect">١٢–١٤. بيرفكت والـ Ports</a>
        <a class="toc-link" href="#privacy">١٦. الخصوصية</a>
        <a class="toc-link" href="#risks">٢١. سجل المخاطر</a>
        <a class="toc-link" href="#roadmap">٢٤. خارطة المراحل</a>
        <a class="toc-link" href="#qa">١٧. الحكم النهائي (١٥ سؤال)</a>
      </div>
    `;
    root.appendChild(s);
  }

  function renderArchitecture(root) {
    const s = el('section', { id: 'architecture' });
    s.innerHTML = `
      <h2>٣. خريطة هيكل المستودع</h2>
      <p class="section-sub">Flutter + NestJS monorepo · Render Blueprint · Firebase Auth/Firestore/Storage(avatars)</p>
      <div class="flow-box">${ARCH_TREE}</div>
      <div class="feature-grid">
        <div class="card info">
          <h3>الحالة</h3>
          <ul class="tight">
            <li>State: Riverpod + Bloc (مزدوج)</li>
            <li>Routing: Named routes · لا go_router</li>
            <li>Network: Dio + Firebase ID token</li>
            <li>Backend: mira-api على Render</li>
          </ul>
        </div>
        <div class="card warn">
          <h3>نقاط فشل أحادية</h3>
          <ul class="tight">
            <li>YouCam / FASHN / OpenAI outage</li>
            <li>Render free spin-down</li>
            <li>مفتاح Perfect واحد على السيرفر</li>
            <li>mock fallback يخفي الأعطال</li>
          </ul>
        </div>
        <div class="card danger">
          <h3>ازدواجية وميّت</h3>
          <ul class="tight">
            <li>Vision path vs OUTFIT_PROVIDER mock</li>
            <li>CIEDE2000 vs CIE76</li>
            <li>stubs جذر فارغة · widgets/ خارج lib</li>
            <li>docs Perfect-only vs Phase2 Banuba</li>
          </ul>
        </div>
      </div>
    `;
    root.appendChild(s);
  }

  function renderInventory(root) {
    const s = el('section', { id: 'inventory' });
    const cards = FEATURES.map(
      (f) => `
      <article class="feature-card" data-area="${f.area}" data-source="${f.source}" tabindex="0">
        <div class="fc-head">
          <h4>${f.name}</h4>
          ${sourceTag(f.source)}
        </div>
        <div class="fc-meta">${f.reliability}</div>
        <div class="fc-body">
          <p>${f.detail}</p>
          ${evidenceHtml(f.evidence)}
        </div>
      </article>`,
    ).join('');

    s.innerHTML = `
      <h2>٤. مخزون الميزات — انقري للتفاصيل والأدلة</h2>
      <p class="section-sub">كل بطاقة: مصدر الحقيقة · الموثوقية · مسار الملف · مستوى الثقة</p>
      <div class="filter-bar">
        <input type="search" id="featSearch" placeholder="ابحثي: mesh · beauty · mock · FASHN…" />
        <select id="featArea">
          <option value="">كل المجالات</option>
          <option value="face">وجه</option>
          <option value="capture">التقاط</option>
          <option value="skin">بشرة</option>
          <option value="beauty">جمال</option>
          <option value="fashion">موضة</option>
          <option value="perfect">بيرفكت</option>
        </select>
        <select id="featSource">
          <option value="">كل المصادر</option>
          <option value="api">API</option>
          <option value="cv">CV</option>
          <option value="ml">ML</option>
          <option value="heuristic">Heuristic</option>
          <option value="mock">Mock</option>
          <option value="hardcoded">Hard-coded</option>
          <option value="absent">Absent</option>
        </select>
        <span id="featCount" class="muted small"></span>
      </div>
      <div class="feature-grid" id="featGrid">${cards}</div>
    `;
    root.appendChild(s);

    const grid = s.querySelector('#featGrid');
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.feature-card');
      if (!card) return;
      card.classList.toggle('open');
    });

    const search = s.querySelector('#featSearch');
    const area = s.querySelector('#featArea');
    const source = s.querySelector('#featSource');
    const count = s.querySelector('#featCount');
    const all = [...grid.querySelectorAll('.feature-card')];

    function apply() {
      const q = (search.value || '').trim().toLowerCase();
      let n = 0;
      all.forEach((c) => {
        const show =
          (!q || c.textContent.toLowerCase().includes(q)) &&
          (!area.value || c.dataset.area === area.value) &&
          (!source.value || c.dataset.source === source.value);
        c.style.display = show ? '' : 'none';
        if (show) n++;
      });
      count.textContent = `${n} / ${all.length}`;
    }
    search.addEventListener('input', apply);
    area.addEventListener('change', apply);
    source.addEventListener('change', apply);
    apply();
  }

  function renderFace(root) {
    const rows = FACE_TABLE.map(
      (r) => `<tr>
        <td>${r[0]}</td><td>${r[1]}</td><td><code>${r[2]}</code></td>
        <td>${r[3]}</td><td>${r[4]}</td><td>${confTag(r[5])}</td>
        <td>${r[6]}</td><td>${r[7]}</td>
      </tr>`,
    ).join('');

    const s = el('section', { id: 'face' });
    s.innerHTML = `
      <h2>٥–٦. تحليل الوجه — تدفق وحسابات</h2>
      <p class="section-sub">MediaPipe = التقاط. YouCam = هموم البشرة. Beauty = صيغة محلية. لا تناسب ذهبي.</p>
      <div class="flow-box">${SKIN_FLOW}</div>
      <div class="table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th>الميزة</th><th>المصدر</th><th>الرمز</th><th>المدخل</th>
              <th>الخوارزمية/الصيغة</th><th>الثقة</th><th>الموثوقية</th><th>المخاطر</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    root.appendChild(s);
  }

  function renderBeauty(root) {
    const s = el('section', { id: 'beauty' });
    s.innerHTML = `
      <h2>٧. تدقيق مصداقية درجة الجمال</h2>
      <div class="card danger">
        <h3 style="margin-top:0;">الخلاصة</h3>
        <p>الأدق وصفها: <strong>درجة صحة/حالة البشرة المرجّحة</strong> (aesthetic skin-health score) —
        وليست درجة جاذبية موضوعية ولا medical beauty score.</p>
      </div>
      <div class="feature-grid">
        <div class="card">
          <h3>المصدر الدقيق</h3>
          <p class="small">Dart: <code>BeautyScoreEngine.compute</code> L49–107</p>
          <p class="small">TS: <code>computeBeautyScore</code> L77–139</p>
          <p class="small">يُكتب في التقرير: <code>overallBeautyScore</code> عبر IntelligenceService L82–89</p>
        </div>
        <div class="card">
          <h3>ما يدخل في الدرجة</h3>
          <ul class="tight small">
            <li>إيجابي: hydration 0.22 · radiance 0.20 · firmness 0.18…</li>
            <li>سلبي: acne 0.14 · wrinkles 0.12 · oiliness 0.12…</li>
            <li>عقوبات مركبة (مثل oiliness+pores)</li>
            <li>تنعيم زمني مقابل الدرجة السابقة</li>
          </ul>
        </div>
        <div class="card warn">
          <h3>ما لا يدخل</h3>
          <ul class="tight small">
            <li>❌ Golden ratio</li>
            <li>❌ Symmetry / thirds / fifths</li>
            <li>❌ جنس / عرق كمدخل صريح</li>
            <li>❌ Capture quality الحقيقي (غالباً)</li>
          </ul>
        </div>
      </div>
      <div class="card ok">
        <h3>صياغة آمنة للمنتج</h3>
        <ul class="tight">
          <li><strong>يُسمح:</strong> «تقدير حالة البشرة من تحليل تجميلي» · ثقة منخفضة/متوسطة · عوامل الإضاءة</li>
          <li><strong>يُمنع:</strong> «درجة جمالك العلمية» · تشخيص طبي · مقارنة جاذبية بين الأشخاص</li>
          <li><strong>إخلاء:</strong> ليس بديلاً عن طبيب جلدية · النتائج تختلف مع الإضاءة والكاميرا</li>
        </ul>
      </div>
      ${evidenceHtml(evid('lib/features/skin_analysis/domain/services/beauty_score_engine.dart', 'BeautyScoreEngine', '10–107', 'Confirmed', 'Heuristic'))}
    `;
    root.appendChild(s);
  }

  function renderSkin(root) {
    const s = el('section', { id: 'skin' });
    s.innerHTML = `
      <h2>٨. تدقيق تحليل البشرة</h2>
      <p class="section-sub">ليس مجرد RGB محلي — عند الإعداد الصحيح: YouCam S2S. عند الفشل مع fallback: mock مزروع.</p>
      <div class="feature-grid">
        <div class="card ok">
          <h3>ما هو حقيقي</h3>
          <ul class="tight small">
            <li>رفع صورة من السيرفر إلى YouCam</li>
            <li>ui_score للهموم المطلوبة في dst_actions</li>
            <li>إعادة المحاولة عبر youcam-image-variants</li>
            <li>رفض أخطاء face quality بدون mock</li>
          </ul>
        </div>
        <div class="card warn">
          <h3>حدود تقنية</h3>
          <ul class="tight small">
            <li>تأثر بالإضاءة وwhite balance والكاميرا</li>
            <li>segmentation المكاني غالباً غير متاح → خريطة تعليمية</li>
            <li>error_src_face_too_small شائع</li>
            <li>تصنيف: تجميلي / wellness — لا طبي</li>
          </ul>
        </div>
        <div class="card danger">
          <h3>خطر المضلل</h3>
          <ul class="tight small">
            <li>FALLBACK_MOCK=true في render.yaml</li>
            <li>متوسطات/قيم افتراضية عند نقص concerns</li>
            <li>رسامون عشوائيون للزينة ≠ درجات</li>
          </ul>
        </div>
      </div>
      ${evidenceHtml(evid('mira-api/src/ai/mocks/perfect-corp-skin.provider.ts', 'allowFallback / mock.analyze', '41–84', 'Confirmed', 'Mock risk'))}
      ${evidenceHtml(evid('render.yaml', 'PERFECT_CORP_FALLBACK_MOCK', '33–34', 'Confirmed', 'Production config'))}
    `;
    root.appendChild(s);
  }

  function renderCapture(root) {
    const s = el('section', { id: 'capture' });
    s.innerHTML = `
      <h2>٩. جودة الالتقاط</h2>
      <div class="table-wrap">
        <table class="audit-table">
          <thead><tr><th>الفحص</th><th>موجود؟</th><th>أين</th><th>ملاحظة</th></tr></thead>
          <tbody>
            <tr><td>وجه أمامي / زاوية</td><td>جزئي</td><td>ML Kit yaw/roll · mesh gate</td><td>لا pitch كامل دائماً</td></tr>
            <tr><td>مسافة / حجم الوجه</td><td>نعم</td><td>FaceMeshQualityGate · FaceGateRules</td><td>face_too_small</td></tr>
            <tr><td>وجوه متعددة</td><td>نعم</td><td>FaceGateValidator</td><td>رفض</td></tr>
            <tr><td>إضاءة كمية</td><td>لا (عميل)</td><td>رسائل فقط · YouCam قد يرفض</td><td>غير مربوط بالدرجة</td></tr>
            <tr><td>ضبابية</td><td>لا مُقاس</td><td>—</td><td>CaptureQuality.blur ثابت تقريباً</td></tr>
            <tr><td>فلاتر / beauty mode</td><td>لا</td><td>—</td><td>Not verifiable detection</td></tr>
            <tr><td>بوابة السيرفر وجه</td><td>لا</td><td>FaceGateService = sharp فقط</td><td>هندسة صورة</td></tr>
          </tbody>
        </table>
      </div>
      <div class="card info">
        <h3>بوابة مقترحة (بدون تنفيذ الآن)</h3>
        <div class="flow-box">Capture → quality validation → alignment → segmentation → analysis → confidence check → result | block</div>
      </div>
    `;
    root.appendChild(s);
  }

  function renderFashion(root) {
    const rows = FASHION_TABLE.map(
      (r) => `<tr>
        <td>${r[0]}</td><td>${r[1]}</td><td><code>${r[2]}</code></td>
        <td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td>
      </tr>`,
    ).join('');

    const s = el('section', { id: 'fashion' });
    s.innerHTML = `
      <h2>١٠–١١. تدقيق الموضة وخط الأصول</h2>
      <p class="section-sub">مساران: Vision Platform (أساسي) و OUTFIT_PROVIDER mock (قديم على Render).</p>
      <div class="flow-box">${FASHION_FLOW}</div>
      <div class="table-wrap">
        <table class="audit-table">
          <thead>
            <tr><th>القدرة</th><th>التنفيذ</th><th>المصدر</th><th>الموثوقية</th><th>الفجوة</th><th>مخاطر</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="card">
        <h3>أصول الموضة</h3>
        <ul class="tight small">
          <li><code>assets/fashion/catalog.json</code> · colors.json · compatibility.json · archetypes.json</li>
          <li>مولَّدات Dart عبر <code>scripts/sync_fashion_catalog.dart</code></li>
          <li><code>asset_factory.dart</code> = hook توليد غير موصول</li>
          <li>صيغة الدرجة: colorHarmony 0.28 · occasionFit 0.26 · style 0.18 · silhouette 0.14 · polish 0.14</li>
        </ul>
      </div>
    `;
    root.appendChild(s);
  }

  function renderPerfect(root) {
    const s = el('section', { id: 'perfect' });
    s.innerHTML = `
      <h2>١٢–١٤. تكاملات الطرف الثالث · جاهزية Perfect · Ports</h2>
      <div class="feature-grid">
        <div class="card ok">
          <h3>موجود في الكود</h3>
          <ul class="tight small">
            <li>Perfect Corp Skin S2S فقط</li>
            <li>FASHN geometry + recolor</li>
            <li>OpenAI semantic + MCE</li>
            <li>MediaPipe + ML Kit on-device</li>
            <li>Firebase Auth / Firestore results</li>
          </ul>
        </div>
        <div class="card danger">
          <h3>غير موجود</h3>
          <ul class="tight small">
            <li>Perfect Makeup / Look / Nail VTO</li>
            <li>Perfect Clothes / Watch try-on</li>
            <li>Banuba SDK (رغم Phase2 docs)</li>
            <li>Facial reshape / surgery sims</li>
          </ul>
        </div>
        <div class="card info">
          <h3>Ports مقترحة (تصميم فقط)</h3>
          <ul class="tight small">
            <li>FaceAnalysisPort</li>
            <li>SkinAnalysisPort ✅ شبه موجود</li>
            <li>BeautyTryOnPort</li>
            <li>FashionAnalysisPort</li>
            <li>VirtualTryOnPort</li>
            <li>ImageQualityPort</li>
          </ul>
          <p class="small muted">Mock · Perfect · Local · Fallback · Flags · Cost · Region routing</p>
        </div>
      </div>
      <div class="card warn">
        <h3>إطار مقارنة مزودين (قبل الاختيار)</h3>
        <p class="small">القدرات · Flutter/SDK · REST · latency · استضافة/إقامة بيانات · التسعير · الاحتفاظ بالصور · استخدام التدريب · SLA · lock-in · وثائق الدقة · التحيز · sandbox · webhooks · الفشل.</p>
        <p class="small">لا اختيار من التسويق وحده.</p>
      </div>
    `;
    root.appendChild(s);
  }

  function renderValidation(root) {
    const s = el('section', { id: 'validation' });
    s.innerHTML = `
      <h2>١٥. خطة التحقق (مقترحة — ليست نتائج حالية)</h2>
      <div class="card">
        <h3>وجه</h3>
        <p class="small">خطأ المعالم · NME · التكرار · ثبات الوضع · أجهزة · إضاءة · نظارات/شعر وجه</p>
        <h3>بشرة</h3>
        <p class="small">اتفاق خبراء · Precision/Recall/F1 · إيجابيات كاذبة · إضاءة محكمة vs حرة</p>
        <h3>موضة</h3>
        <p class="small">Top-1/5 فئة · IoU · ΔE · قبول التوصية · تنوع · حجاب/أزياء محافظة</p>
        <p class="muted small">عتبات الإطلاق تُحدد لاحقاً كأهداف مقترحة فقط — لا تُعرض كأرقام محققة.</p>
      </div>
    `;
    root.appendChild(s);
  }

  function renderPrivacy(root) {
    const s = el('section', { id: 'privacy' });
    s.innerHTML = `
      <h2>١٦. الخصوصية والأمان</h2>
      <div class="table-wrap">
        <table class="audit-table">
          <thead><tr><th>البند</th><th>الحالة</th><th>دليل</th></tr></thead>
          <tbody>
            <tr><td>رفع صورة للتحليل</td><td>نعم → Render → YouCam</td><td>PerfectCorpService.uploadImage</td></tr>
            <tr><td>تخزين صورة في Firestore</td><td>لا (نتائج فقط)</td><td>SkinAnalysisRemoteDataSource</td></tr>
            <tr><td>Storage skin_scans</td><td>مرفوض بالقواعد</td><td>storage.rules</td></tr>
            <tr><td>مسح buffer</td><td>نعم fill(0)</td><td>skin-analysis.service.ts</td></tr>
            <tr><td>موافقة الخصوصية</td><td>نعم قبل التحليل</td><td>AnalysisNavigation · PrivacyConsentStorage</td></tr>
            <tr><td>مفاتيح Perfect على الجهاز</td><td>لا</td><td>MiraApiConfig + Render secrets</td></tr>
            <tr><td>AUTH_SKIP</td><td>false في blueprint</td><td>render.yaml:77–78</td></tr>
            <tr><td>rawYouCam في DB</td><td>نعم محتمل</td><td>resultJson / providerAudit</td></tr>
            <tr><td>Crashlytics</td><td>غائب</td><td>—</td></tr>
            <tr><td>تصنيف البيانات</td><td>صورة وجه = حساسة/بيومترية محتملة</td><td>يتطلب مراجعة قانونية سعودية</td></tr>
          </tbody>
        </table>
      </div>
    `;
    root.appendChild(s);
  }

  function renderScale(root) {
    const s = el('section', { id: 'scale' });
    s.innerHTML = `
      <h2>١٧–١٨. التوسع · الصيانة · العيوب</h2>
      <div class="feature-grid">
        <div class="card">
          <h3>توسع</h3>
          <ul class="tight small">
            <li>RATE_LIMIT_PER_HOUR=30</li>
            <li>Render free + Postgres free</li>
            <li>تكلفة credits تتصاعد خطياً</li>
            <li>لا طابور تحليل واضح للملايين</li>
          </ul>
        </div>
        <div class="card">
          <h3>صيانة</h3>
          <ul class="tight small">
            <li>قابلية فهم: متوسطة</li>
            <li>استبدال مزود: جزئي عبر providers</li>
            <li>اختبارات مستقلة: جزئياً</li>
            <li>Observability: ضعيف</li>
          </ul>
        </div>
        <div class="card warn">
          <h3>عيوب مؤكدة من الكود</h3>
          <ul class="tight small">
            <li>mock fallback إنتاجي</li>
            <li>CaptureQuality unwired</li>
            <li>مسار outfit مزدوج</li>
            <li>لا CI</li>
            <li>docs استراتيجية متضاربة</li>
          </ul>
        </div>
      </div>
    `;
    root.appendChild(s);
  }

  function renderRisks(root) {
    const rows = RISKS.map(
      (r) => `<tr>
        <td>${r.risk}</td>
        <td>${r.area}</td>
        <td class="small"><code>${r.evidence}</code></td>
        <td>${r.prob}</td>
        <td>${r.impact}</td>
        <td class="sev-${r.sev}">${r.sev}</td>
        <td>${r.blocker ? '<span class="tag blocker">نعم</span>' : 'لا'}</td>
        <td class="small">${r.mitigation}</td>
      </tr>`,
    ).join('');

    const s = el('section', { id: 'risks' });
    s.innerHTML = `
      <h2>٢١–٢٢. سجل المخاطر وعوائق الإطلاق</h2>
      <div class="table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th>المخاطر</th><th>المجال</th><th>الدليل</th><th>الاحتمال</th>
              <th>الأثر</th><th>الشدة</th><th>عائق؟</th><th>التخفيف</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    root.appendChild(s);
  }

  function renderQuickWins(root) {
    const s = el('section', { id: 'quickwins' });
    s.innerHTML = `
      <h2>٢٣. مكاسب سريعة · ملفات للمراجعة الفورية</h2>
      <div class="feature-grid">
        <div class="card ok">
          <h3>Quick wins</h3>
          <ul class="tight small">
            <li>FALLBACK_MOCK=false</li>
            <li>إعادة تسمية UI لدرجة البشرة</li>
            <li>إخلاء مسؤولية واضح</li>
            <li>تعطيل/عزل outfit mock path في docs</li>
            <li>ربط CaptureQuality من الـ gate</li>
          </ul>
        </div>
        <div class="card danger">
          <h3>٢٥. ملفات فورية</h3>
          <ul class="tight small">
            <li>render.yaml</li>
            <li>perfect-corp-skin.provider.ts</li>
            <li>beauty_score_engine.dart / .ts</li>
            <li>intelligence.service.ts</li>
            <li>beauty_score_hero.dart</li>
            <li>docs/perfect-services.js vs phase2</li>
          </ul>
        </div>
      </div>
    `;
    root.appendChild(s);
  }

  function renderRoadmap(root) {
    const cards = ROADMAP.map(
      (p) => `
      <div class="phase-card">
        <h4>${p.phase}</h4>
        <ul>${p.items.map((i) => `<li>${i}</li>`).join('')}</ul>
        <span class="complexity">Complexity: ${p.complexity}</span>
      </div>`,
    ).join('');

    const s = el('section', { id: 'roadmap' });
    s.innerHTML = `
      <h2>٢٤. خارطة المراحل المقترحة</h2>
      <p class="section-sub">بدون تقدير زمني أو تكلفة غير مدعومة. كل مرحلة تعتمد على إغلاق السابقة الحرجة.</p>
      <div class="roadmap-grid">${cards}</div>
    `;
    root.appendChild(s);
  }

  function renderUnknowns(root) {
    const s = el('section', { id: 'unknowns' });
    s.innerHTML = `
      <h2>٢٦. أسئلة لا تُجاب من المستودع</h2>
      <ul class="tight">
        <li>دقة YouCam الفعلية على وجوه خليجية/حجاب/إضاءة منزلية</li>
        <li>سياسة احتفاظ Perfect التفصيلية لكل منطقة</li>
        <li>هل storage.rules المنشورة تطابق مسار avatars في الكود؟</li>
        <li>معدلات قبول توصيات الموضة من مستخدمات حقيقيات</li>
        <li>هل يوجد حساب Perfect enterprise وأسعار رسمية؟</li>
        <li>هل تُشغَّل مواصفات Jest في أي بيئة CI خارجية غير ظاهرة؟</li>
      </ul>
      <p class="muted small">الجواب الرسمي حيث ينقص الدليل: <strong>Not verifiable from the current repository.</strong></p>
    `;
    root.appendChild(s);
  }

  function renderQA(root) {
    const items = VERDICT_QA.map(
      (x, i) => `
      <div class="qa-item${i === 0 ? ' open' : ''}">
        <button type="button" class="qa-q">${x.q}<span>▾</span></button>
        <div class="qa-a">${x.a}</div>
      </div>`,
    ).join('');

    const s = el('section', { id: 'qa' });
    s.innerHTML = `
      <h2>١٧. الحكم النهائي — ١٥ إجابة مباشرة</h2>
      <p class="section-sub">صارم · نقدي · بلا مجاملة للقرارات السابقة</p>
      ${items}
    `;
    root.appendChild(s);

    s.addEventListener('click', (e) => {
      const btn = e.target.closest('.qa-q');
      if (!btn) return;
      const item = btn.closest('.qa-item');
      item.classList.toggle('open');
    });
  }

  function initNav() {
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('mainNav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => nav.classList.toggle('open'));
    }
  }

  function init() {
    const root = document.getElementById('app');
    if (!root) return;
    root.innerHTML = '';
    renderHero(root);
    if (window.MiraSubsystemRegistry && typeof window.MiraSubsystemRegistry.render === 'function') {
      window.MiraSubsystemRegistry.render(root);
    }
    renderArchitecture(root);
    renderInventory(root);
    renderFace(root);
    renderBeauty(root);
    renderSkin(root);
    renderCapture(root);
    renderFashion(root);
    renderPerfect(root);
    renderValidation(root);
    renderPrivacy(root);
    renderScale(root);
    renderRisks(root);
    renderQuickWins(root);
    renderRoadmap(root);
    renderUnknowns(root);
    renderQA(root);
    initNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
