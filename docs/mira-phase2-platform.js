/**
 * MIRA Phase 2 Platform — Official Implementation & Cost Reference
 * من «محلل بشرة وإطلالة» إلى «منصة Analyze → Recommend → Try → Buy»
 */
(function () {
  'use strict';

  const SPEC = {
    version: '1.2.0',
    date: '2026-07-05',
    repo: 'semester2030/mira',
    author: 'MIRA Engineering',
    currency: 'USD',
    sarRate: 3.75,
  };

  const PLATFORMS = [
    {
      id: 'perfect_corp',
      name: 'Perfect Corp / YouCam',
      phase: 1,
      role: 'Skin Intelligence',
      color: '#e86fa9',
      does: [
        'تحليل البشرة (مسام · تجاعيد · ترطيب · احمرار · تصبغات)',
        'Skin Score + concerns',
        'Undertone · texture class',
        'YouCam S2S v2.0 عبر Render',
      ],
      doesNot: ['AR makeup', 'Face tracking حي', 'Try-on'],
      code: [
        'mira-api/src/ai/services/perfect-corp.service.ts',
        'lib/core/ai/providers/skin_analysis_provider.dart',
        'POST /api/v1/ai/skin-analysis',
      ],
      costMonthly: { min: 500, max: 3000, note: 'حسب volume · API calls' },
    },
    {
      id: 'fashn',
      name: 'FASHN.ai',
      phase: 1,
      role: 'Fashion Intelligence',
      color: '#c19ee0',
      does: [
        'Outfit segmentation · geometry',
        'Semantic analysis via OpenAI orchestration',
        'Garment recolor (Phase 1.5)',
        'Try-on ملابس — مستقبلاً',
      ],
      doesNot: ['Makeup AR', 'Skin analysis'],
      code: [
        'mira-api/src/vision/providers/fashn-geometry.provider.ts',
        'POST /api/v1/ai/vision/outfit/analyze',
        'POST /api/v1/ai/vision/outfit/recolor',
      ],
      costMonthly: { min: 200, max: 2000, note: 'حسب API runs' },
    },
    {
      id: 'openai',
      name: 'OpenAI',
      phase: 1,
      role: 'Consultation Intelligence',
      color: '#64b5f6',
      does: [
        'شرح النتائج · narratives عربية',
        'استشارة Mira Advisor',
        'Semantic outfit analysis',
        'لا يستقبل صورة خام للتشخيص',
      ],
      doesNot: ['Skin scoring', 'AR rendering'],
      code: [
        'mira-api/src/ai/services/outfit-hybrid-intelligence.service.ts',
        'lib/features/intelligence/',
      ],
      costMonthly: { min: 100, max: 1500, note: 'gpt-4o-mini · usage-based' },
    },
    {
      id: 'mediapipe',
      name: 'MediaPipe Face Mesh',
      phase: 1,
      role: 'Capture & Live Tracking',
      color: '#5ce1ff',
      does: [
        '468 landmarks · live camera',
        'FaceMeshQualityGate · region mapping',
        'WOW overlay (wireframe · laser · spotlight)',
        'Quality gate قبل Perfect Corp',
      ],
      doesNot: ['Virtual makeup', 'Hair color AR', 'Skin AI'],
      code: [
        'lib/features/skin_analysis/presentation/live_face_map/',
        'mediapipe_face_mesh plugin',
        'FaceMeshService · PremiumWireframeMeshPainter',
      ],
      costMonthly: { min: 0, max: 0, note: 'On-device · مجاني' },
    },
    {
      id: 'mira_engine',
      name: 'MIRA Engine',
      phase: '1→2',
      role: 'Decision & Orchestration',
      color: '#c9a227',
      does: [
        'Beauty Score · Face Map · Narratives',
        'Treatment · Weekly · Journey plans',
        'Confidence Layer · Fusion skin+outfit',
        'Phase 2: Try-on orchestration · SKU mapping',
      ],
      doesNot: ['Rendering AR', 'Raw vision inference'],
      code: [
        'mira-api/src/intelligence/pipeline/',
        'lib/features/intelligence/',
        'lib/features/skin_analysis/domain/services/beauty_score_engine.dart',
      ],
      costMonthly: { min: 0, max: 0, note: 'داخلي — تكلفة فريق فقط' },
    },
    {
      id: 'banuba',
      name: 'Banuba (موصى به)',
      phase: 2,
      role: 'AR Beauty Experience',
      color: '#9b7bff',
      does: [
        'Virtual makeup (lip · blush · eyeshadow · foundation · contour · highlight)',
        'Hair color live · glasses · accessories',
        'Beauty filters · skin smoothing (preview only)',
        'Flutter SDK · real-time tracking',
      ],
      doesNot: ['Skin analysis', 'Fashion segmentation', 'Business logic'],
      code: [
        'lib/features/ar_tryon/ (جديد — Phase 2)',
        'Banuba SDK native bridge',
        'MiraTryOnOrchestrator (جديد)',
      ],
      costMonthly: { min: 2000, max: 10000, note: 'Enterprise SDK · MAU-based · عرض سعر' },
    },
  ];

  const AR_FEATURES = [
    {
      id: 'makeup',
      icon: '💄',
      title: 'تجربة المكياج الحي',
      priority: 1,
      rolloutWave: 'W1',
      rolloutLabel: 'الموجة 1 — الأولوية القصوى · إطلاق AR الأول',
      isHero: true,
      launchOrder: 1,
      roi: 'عالي جداً',
      banuba: true,
      visage: true,
      description: 'المستخدمة تجرب أحمر شفاه · بلاشر · آيشادو · كونتور · هايلايتر · كريم أساس — كلها تتحرك مع الوجه لحظياً.',
      why: 'أقرب ربط مع Perfect Corp (undertone · skin type) · أعلى conversion للـ marketplace.',
      technical: [
        'Banuba Makeup SDK module',
        'SKU → Banuba preset mapping (JSON catalog)',
        'MIRA Engine: recommend shade from skin undertone + concern',
        'Flutter: ArTryOnScreen · BanubaCameraWidget',
        'Backend: GET /api/v1/tryon/catalog · POST /api/v1/tryon/session',
      ],
      files: [
        'lib/features/ar_tryon/presentation/screens/ar_tryon_screen.dart',
        'lib/features/ar_tryon/data/banuba_sdk_adapter.dart',
        'lib/features/ar_tryon/domain/entities/makeup_preset.dart',
        'mira-api/src/tryon/tryon.module.ts',
        'mira-api/src/tryon/tryon-orchestrator.service.ts',
      ],
      acceptance: [
        '30fps+ على iPhone 12+ و Galaxy S21+',
        'Lip color يتبع الوجه عند دوران ±30°',
        'SKU من marketplace يفتح try-on مباشرة',
        'Disclaimer: «معاينة بصرية — ليست نتيجة المنتج الفعلية»',
      ],
      effortDevDays: { min: 45, max: 75 },
      costBuild: { min: 35000, max: 65000 },
    },
    {
      id: 'hair',
      icon: '💇',
      title: 'تجربة ألوان الشعر',
      priority: 4,
      rolloutWave: 'W3',
      rolloutLabel: 'الموجة 3 — بعد إطلاق المكياج',
      isHero: false,
      launchOrder: 4,
      roi: 'عالي',
      banuba: true,
      visage: true,
      description: 'تدير رأسها وترى اللون من زوايا متعددة — ليس صورة ثابتة.',
      why: 'Wow factor · شراكات صالونات · differentiation.',
      technical: [
        'Banuba Hair color module',
        'Hair segmentation mask · color LUT',
        'MIRA: recommend from skin undertone + outfit palette',
      ],
      files: [
        'lib/features/ar_tryon/presentation/widgets/hair_color_panel.dart',
        'assets/tryon/hair_presets.json',
      ],
      acceptance: ['Hair mask stable عند حركة الرأس', '8+ preset colors'],
      effortDevDays: { min: 25, max: 40 },
      costBuild: { min: 22000, max: 38000 },
    },
    {
      id: 'glasses',
      icon: '👓',
      title: 'تجربة النظارات',
      priority: 3,
      rolloutWave: 'W3',
      rolloutLabel: 'الموجة 3 — retail · شراكات optical',
      isHero: false,
      launchOrder: 5,
      roi: 'عالي (retail)',
      banuba: true,
      visage: true,
      description: 'نظارات شمسية · طبية — مع شركاء optical retail.',
      why: 'Revenue واضح · 3D asset pipeline مع partners.',
      technical: [
        'Banuba Glasses try-on · 3D GLB models',
        'Partner SKU → model URL mapping',
        'IPD calibration optional',
      ],
      files: [
        'lib/features/ar_tryon/presentation/widgets/glasses_tryon_panel.dart',
        'mira-api/src/tryon/partner-asset.service.ts',
      ],
      acceptance: ['Glasses anchor stable', 'Partner deep link → buy'],
      effortDevDays: { min: 30, max: 50 },
      costBuild: { min: 28000, max: 48000 },
    },
    {
      id: 'accessories',
      icon: '💎',
      title: 'تجربة الإكسسوارات',
      priority: 5,
      rolloutWave: 'W4',
      rolloutLabel: 'الموجة 4 — توسع · 3D assets',
      isHero: false,
      launchOrder: 6,
      roi: 'متوسط',
      banuba: true,
      visage: true,
      description: 'أقراط · عقود · تيجان · حجاب بألوان · قبعات.',
      why: 'يتوسع marketplace · يحتاج 3D assets كثيرة.',
      technical: ['Banuba Accessories · face + neck tracking', 'Asset CDN (R2/S3)'],
      files: ['lib/features/ar_tryon/presentation/widgets/accessory_panel.dart'],
      acceptance: ['Earrings track عند ±20° yaw'],
      effortDevDays: { min: 35, max: 55 },
      costBuild: { min: 32000, max: 52000 },
    },
    {
      id: 'nails',
      icon: '💅',
      title: 'تجربة طلاء الأظافر',
      priority: 6,
      rolloutWave: 'W4',
      rolloutLabel: 'الموجة 4 — nice-to-have',
      isHero: false,
      launchOrder: 7,
      roi: 'منخفض–متوسط',
      banuba: true,
      visage: false,
      description: 'Hand tracking + nail polish overlay.',
      why: 'Nice-to-have · يحتاج hand mesh — تعقيد إضافي.',
      technical: ['Banuba Hand / Nail module if licensed', 'Separate camera mode'],
      files: ['lib/features/ar_tryon/presentation/screens/nail_tryon_screen.dart'],
      acceptance: ['Hand detected · polish on nails only'],
      effortDevDays: { min: 20, max: 35 },
      costBuild: { min: 18000, max: 32000 },
    },
    {
      id: 'contacts',
      icon: '👁',
      title: 'العدسات اللاصقة',
      priority: 6,
      rolloutWave: 'W3',
      rolloutLabel: 'الموجة 3 — مع الشعر والنظارات',
      isHero: false,
      launchOrder: 5,
      roi: 'متوسط',
      banuba: true,
      visage: true,
      description: 'ألوان العين — iris overlay.',
      why: 'Popular in beauty apps · low asset cost.',
      technical: ['Banuba Eye color / iris module', 'Works with existing face mesh'],
      files: ['lib/features/ar_tryon/presentation/widgets/eye_color_panel.dart'],
      acceptance: ['Iris color stable with blink'],
      effortDevDays: { min: 15, max: 25 },
      costBuild: { min: 14000, max: 24000 },
    },
    {
      id: 'filters',
      icon: '✨',
      title: 'فلترات احترافية (Preview)',
      priority: 2,
      rolloutWave: 'W2',
      rolloutLabel: 'الموجة 2 — بعد المكياج · يدعم try-on UX',
      isHero: false,
      launchOrder: 2,
      roi: 'عالي',
      banuba: true,
      visage: true,
      description: 'تحسين إضاءة · matte · glow · soft skin — أثناء التجربة فقط · ليس TikTok filters.',
      why: 'يرفع perceived quality · يكمّل capture · لا يمس Perfect Corp analysis.',
      technical: [
        'Banuba Beauty filters · post-process pipeline',
        'Strict separation: preview mode ≠ analysis mode',
        'No filter applied before Perfect Corp upload',
      ],
      files: ['lib/features/ar_tryon/presentation/widgets/beauty_filter_bar.dart'],
      acceptance: ['Filter OFF during skin analysis capture', 'Filter ON only in try-on mode'],
      effortDevDays: { min: 12, max: 20 },
      costBuild: { min: 10000, max: 18000 },
    },
  ];

  /** سياسة الإطلاق — الميزات السبع على موجات · المكياج أولاً */
  const AR_ROLLOUT_POLICY = {
    headline: 'لا تُطلق الميزات السبع دفعة واحدة',
    subline: 'كل ميزة AR لها موجة إطلاق مستقلة · Gate · تكلفة · معايير قبول',
    heroFeature: 'makeup',
    heroFeatureAr: '💄 تجربة المكياج الحي',
    firstPublicRelease: 'MIRA Try — Makeup (Wave 1)',
    whyMakeupFirst: [
      'أقرب ربط مع Perfect Corp (undertone · skin type · concerns)',
      'أعلى conversion للـ marketplace (SKU makeup واضح)',
      'Banuba POC أسرع (lip preset → full suite)',
      'ROI أعلى · مخاطر أقل من hair/glasses/3D assets',
      'يتماشى مع Analyze → Recommend → Try → Buy',
    ],
    notInWave1: ['hair', 'glasses', 'accessories', 'nails', 'contacts'],
    forbidden: [
      'إطلاق 7 ميزات AR في release واحد',
      'بدء Banuba بـ hair أو glasses قبل makeup',
      'تفعيل filters أثناء capture التحليل (Perfect Corp)',
      'Marketplace بدون SKU makeup قبل Wave 1',
    ],
  };

  /** طبقات المكياج — تفصيل Wave 1 (الأهم) */
  const MAKEUP_LAYERS = [
    {
      layer: 'P2.1 — Lip POC',
      weeks: '3–4',
      items: ['أحمر شفاه فقط', 'SKU واحد → preset واحد', 'Deep link من تقرير MIRA', '5 أجهزة · 30fps'],
      gate: 'Banuba contract + lip try-on demo',
      cost: { min: 18000, max: 32000 },
    },
    {
      layer: 'P2.2 — Full Makeup Suite',
      weeks: '8–12',
      items: [
        'أحمر شفاه (lipstick · gloss · matte)',
        'بلاشر (blush · cream · powder)',
        'آيشادو (eyeshadow palettes)',
        'كونتور (contour · bronzer)',
        'هايلايتر (highlight · glow)',
        'كريم أساس (foundation · BB · tint)',
      ],
      gate: '50+ SKUs · try-on من beauty report · buy E2E',
      cost: { min: 45000, max: 78000 },
    },
  ];

  /** موجات إطلاق AR — 5 موجات + Wave 0 تأسيس */
  const AR_ROLLOUT_WAVES = [
    {
      id: 'W0',
      order: 0,
      icon: '🏗',
      title: 'Wave 0 — التأسيس (بدون AR)',
      subtitle: 'Marketplace live — شرط قبل أي try-on',
      implPhases: ['P2.0'],
      weeks: '4–6',
      features: [],
      featureLabels: ['— لا AR — Marketplace + SKU + analytics فقط'],
      releaseName: 'MIRA Marketplace Beta',
      userSees: 'منتجات مقترحة · شراء · بدون كاميرا AR',
      why: 'Try-on بدون شراء = wow بدون revenue. Wave 0 يبني قاعدة Try→Buy.',
      gate: 'Conversion ≥ 2% · 10+ makeup SKUs mapped',
      cost: { min: 25000, max: 45000 },
      teamFocus: 'Backend · Product · Partnerships',
      status: 'prerequisite',
    },
    {
      id: 'W1',
      order: 1,
      icon: '💄',
      title: 'Wave 1 — المكياج (الأولوية القصوى)',
      subtitle: '⭐ إطلاق AR الأول · Hero Feature',
      implPhases: ['P2.1', 'P2.2'],
      weeks: '11–16',
      features: ['makeup'],
      featureLabels: ['💄 تجربة المكياج الحي — lip → full suite'],
      releaseName: 'MIRA Try — Makeup',
      userSees: '«يناسبك 312» → جربي على وجهك → اشتري',
      why: 'Heart of Phase 2. Perfect Corp → shade match → Banuba lip/blush/eyes/base. Highest ROI.',
      gate: 'Makeup E2E · 30fps · legal disclaimer · Banuba signed',
      cost: { min: 63000, max: 110000 },
      teamFocus: 'Mobile (Banuba) · MIRA Engine (shade-matcher) · Content (presets)',
      status: 'hero',
      makeupLayers: MAKEUP_LAYERS,
    },
    {
      id: 'W2',
      order: 2,
      icon: '✨',
      title: 'Wave 2 — فلترات Preview',
      subtitle: 'بعد Wave 1 — يحسّن تجربة try-on',
      implPhases: ['P2.3'],
      weeks: '2–3',
      features: ['filters'],
      featureLabels: ['✨ فلترات احترافية (preview only · ليس TikTok)'],
      releaseName: 'MIRA Try — Beauty Filters',
      userSees: 'Glow · matte · soft light أثناء تجربة المكياج فقط',
      why: 'يرفع perceived quality · لا يمس Perfect Corp (mode separation)',
      gate: 'ANALYZE mode = zero filters · TRY_ON mode = filters OK',
      cost: { min: 12000, max: 22000 },
      teamFocus: 'Architecture · Flutter · QA regression skin scores',
      status: 'enhancement',
    },
    {
      id: 'W3',
      order: 3,
      icon: '💇',
      title: 'Wave 3 — شعر · نظارات · عدسات',
      subtitle: 'Retail expansion — 3 ميزات في موجة واحدة',
      implPhases: ['P2.4'],
      weeks: '10–14',
      features: ['hair', 'glasses', 'contacts'],
      featureLabels: ['💇 ألوان الشعر', '👓 نظارات', '👁 عدسات لاصقة'],
      releaseName: 'MIRA Try — Style',
      userSees: 'جربي لون شعر · نظارة · عدسة — من توصية MIRA',
      why: 'Retail partners (optical · hair) · wow عالي · يحتاج 3D assets',
      gate: '2 optical partners · hair presets · try→buy live',
      cost: { min: 55000, max: 92000 },
      teamFocus: 'Partnerships · 3D assets · Mobile',
      status: 'expansion',
    },
    {
      id: 'W4',
      order: 4,
      icon: '💎',
      title: 'Wave 4 — إكسسوارات · أظافر · Fusion',
      subtitle: 'توسع + ربط FASHN outfit مع makeup',
      implPhases: ['P2.5'],
      weeks: '8–12',
      features: ['accessories', 'nails'],
      featureLabels: ['💎 إكسسوارات', '💅 أظافر', '🔗 Fusion outfit+makeup'],
      releaseName: 'MIRA Try — Complete Look',
      userSees: '«هذا المكياج مع فستانك» → look كامل · أقراط · أظافر',
      why: 'Platform differentiation · FASHN + Banuba fusion = moat',
      gate: 'Fusion E2E · accessory tracking stable',
      cost: { min: 48000, max: 85000 },
      teamFocus: 'MIRA Fusion Engine · Mobile · Content',
      status: 'platform',
    },
    {
      id: 'W5',
      order: 5,
      icon: '🛡',
      title: 'Wave 5 — Production Hardening',
      subtitle: 'يعبر جميع الموجات — قبل scale عالمي',
      implPhases: ['P2.6'],
      weeks: '4–6',
      features: ['all'],
      featureLabels: ['QA 20 devices · Sentry · PDPL · cost monitoring'],
      releaseName: 'MIRA Try — Global Ready',
      userSees: 'استقرار · سرعة · compliance',
      why: 'Enterprise-grade قبل دخول سوق global',
      gate: 'Launch checklist 100% · crash rate < 0.1%',
      cost: { min: 22000, max: 40000 },
      teamFocus: 'QA · DevOps · Legal · Finance',
      status: 'hardening',
    },
  ];

  const IMPL_PHASES = [
    {
      id: 'P2.0',
      wave: 'W0',
      title: 'P2.0 — Prerequisites & Marketplace Live',
      weeks: '4–6',
      goal: 'بدون marketplace فعّال · try-on = wow بدون revenue.',
      tasks: [
        { task: 'تفعيل MIRA_MARKETPLACE_ENABLED في production', owner: 'Flutter', proof: 'lib/core/config/mira_features.dart' },
        { task: 'SKU catalog + partner APIs', owner: 'Backend', proof: 'marketplace module' },
        { task: 'matchForReport → product cards with buy CTA', owner: 'Full-stack', proof: 'MarketplaceRepository.matchForReport' },
        { task: 'Deep links · affiliate · payment gateway POC', owner: 'Product', proof: 'partner contracts' },
        { task: 'Analytics: impression → click → purchase funnel', owner: 'Data', proof: 'mira_analytics events' },
      ],
      cost: { min: 25000, max: 45000 },
      gate: 'Marketplace conversion ≥ 2% على beta cohort',
    },
    {
      id: 'P2.1',
      wave: 'W1',
      title: 'P2.1 — Banuba POC (Lip Try-on فقط)',
      weeks: '3–4',
      goal: 'إثبات تقني: Banuba + Flutter + MIRA recommendation → one SKU.',
      tasks: [
        { task: 'Banuba trial license + SDK integration Flutter', owner: 'Mobile', proof: 'banuba_sdk_adapter.dart' },
        { task: 'ArTryOnScreen · lip preset من catalog', owner: 'Mobile', proof: 'demo video' },
        { task: 'MIRA: «يناسبك أحمر 312» → deep link try-on', owner: 'Engine', proof: 'tryon-orchestrator' },
        { task: 'Performance profiling 30fps target', owner: 'QA', proof: 'device matrix' },
        { task: 'Legal: preview disclaimer AR', owner: 'Legal', proof: 'privacy-policy update' },
      ],
      cost: { min: 18000, max: 32000 },
      gate: 'POC approved on 5 devices · Banuba contract signed',
    },
    {
      id: 'P2.2',
      wave: 'W1',
      title: 'P2.2 — Full Makeup Suite ⭐ Hero',
      weeks: '8–12',
      goal: '💄 كامل: lip · blush · eyeshadow · foundation · contour · highlight.',
      tasks: [
        { task: 'Makeup preset catalog (50+ SKUs)', owner: 'Content', proof: 'JSON + Banuba presets' },
        { task: 'Undertone → shade recommendation engine', owner: 'MIRA Engine', proof: 'shade-matcher.ts' },
        { task: 'UI: makeup carousel · before/after · save look', owner: 'Design+Flutter', proof: 'Figma + screens' },
        { task: 'Session persistence · share look (optional)', owner: 'Backend', proof: 'tryon sessions table' },
      ],
      cost: { min: 45000, max: 78000 },
      gate: 'Makeup try-on from beauty report · buy flow E2E',
    },
    {
      id: 'P2.3',
      wave: 'W2',
      title: 'P2.3 — Beauty Filters + MediaPipe coexistence',
      weeks: '2–3',
      goal: 'فلترات preview · MediaPipe للcapture · Banuba للtry-on — لا تداخل.',
      tasks: [
        { task: 'Mode switch: ANALYZE vs TRY_ON', owner: 'Architecture', proof: 'CaptureMode enum' },
        { task: 'Block filters during Perfect Corp pipeline', owner: 'Engine', proof: 'skin-analysis guard' },
        { task: 'Filter bar in try-on only', owner: 'Flutter', proof: 'beauty_filter_bar.dart' },
      ],
      cost: { min: 12000, max: 22000 },
      gate: 'Perfect Corp scores unchanged with try-on enabled in app',
    },
    {
      id: 'P2.4',
      wave: 'W3',
      title: 'P2.4 — Hair · Glasses · Eye Color',
      weeks: '10–14',
      goal: '💇 👓 👁 — retail-ready modules.',
      tasks: [
        { task: 'Hair color presets + MIRA recommendation', owner: 'Full-stack', proof: 'hair panel' },
        { task: 'Glasses 3D assets from 2 partners', owner: 'Partnerships', proof: 'GLB catalog' },
        { task: 'Contact lens colors', owner: 'Mobile', proof: 'eye_color_panel' },
      ],
      cost: { min: 55000, max: 92000 },
      gate: '3 partner SKUs live with try→buy',
    },
    {
      id: 'P2.5',
      wave: 'W4',
      title: 'P2.5 — Accessories · Nails · Outfit+Makeup Fusion',
      weeks: '8–12',
      goal: '💎 💅 · «هذا المكياج يناسب فستانك» — FASHN + Banuba.',
      tasks: [
        { task: 'Accessory try-on', owner: 'Mobile', proof: 'accessory_panel' },
        { task: 'Nail try-on (hand mode)', owner: 'Mobile', proof: 'nail screen' },
        { task: 'FusionEngine → outfit palette → makeup suggestion', owner: 'MIRA Engine', proof: 'fusion-engine.ts extend' },
        { task: 'Combined look save + share', owner: 'Product', proof: 'look bundle entity' },
      ],
      cost: { min: 48000, max: 85000 },
      gate: 'Fusion look try-on E2E',
    },
    {
      id: 'P2.6',
      wave: 'W5',
      title: 'P2.6 — Production Hardening',
      weeks: '4–6',
      goal: 'Enterprise-grade قبل دخول السوق العالمي.',
      tasks: [
        { task: 'Device matrix QA (20 devices)', owner: 'QA', proof: 'test matrix doc' },
        { task: 'SDK crash monitoring · Sentry', owner: 'DevOps', proof: 'Sentry Banuba breadcrumbs' },
        { task: 'App Store AR compliance · Saudi PDPL', owner: 'Legal', proof: 'privacy update' },
        { task: 'Load test try-on sessions', owner: 'Backend', proof: 'k6 report' },
        { task: 'Cost monitoring Banuba MAU', owner: 'Finance', proof: 'dashboard' },
      ],
      cost: { min: 22000, max: 40000 },
      gate: 'Production launch checklist 100%',
    },
  ];

  const BANUBA_VS_VISAGE = [
    { feature: 'Virtual Makeup', banuba: '✅ ممتاز — beauty-first', visage: '⚠️ محدود' },
    { feature: 'Hair Color', banuba: '✅', visage: '✅' },
    { feature: 'Glasses Try-on', banuba: '✅', visage: '✅ قوي' },
    { feature: 'Accessories', banuba: '✅', visage: '✅' },
    { feature: 'Hand/Nails', banuba: '✅', visage: '⚠️' },
    { feature: 'Flutter SDK', banuba: '✅ رسمي', visage: '✅' },
    { feature: 'Beauty filters', banuba: '✅ غني', visage: '⚠️' },
    { feature: 'Head pose accuracy', banuba: '✅ جيد', visage: '✅✅ أدق' },
    { feature: 'Pricing transparency', banuba: '⚠️ enterprise', visage: '⚠️ enterprise' },
    { feature: 'توصية MIRA', banuba: '⭐ الأول — makeup + beauty', visage: 'بديل — إذا أولوية glasses/tracking' },
  ];

  /** تشغيل شهري — Banuba + YouCam + Render · شهر 1–6 · 100/500/1000 MAU */
  const MAU_OPERATING_MODEL = {
    tokenNote:
      'Client Token = مفتاح تفعيل SDK (trial ~14 يوم مجاناً). الرسوم = عقد سنوي ÷ 12 حسب MAU — ليس «كل try-on = فلوس».',
    rampByMonth: [
      { month: 1, label: 'شهر 1 · Beta', factor: 0.2, banuba: 'trial' },
      { month: 2, label: 'شهر 2 · Trial AR', factor: 0.35, banuba: 'trial' },
      { month: 3, label: 'شهر 3 · عقد Banuba', factor: 0.55, banuba: 'contract' },
      { month: 4, label: 'شهر 4 · Ramp', factor: 0.75, banuba: 'contract' },
      { month: 5, label: 'شهر 5 · Ramp', factor: 0.9, banuba: 'contract' },
      { month: 6, label: 'شهر 6 · هدف MAU', factor: 1.0, banuba: 'contract' },
    ],
    scenarios: [
      {
        id: 'mau100',
        label: '100 MAU',
        subtitle: 'Beta · أصدقاء · influencers صغار',
        targetMau: 100,
        banubaAnnualUsd: { min: 12000, max: 18000 },
      },
      {
        id: 'mau500',
        label: '500 MAU',
        subtitle: 'Soft launch · تسويق محدود',
        targetMau: 500,
        banubaAnnualUsd: { min: 18000, max: 28000 },
      },
      {
        id: 'mau1000',
        label: '1000 MAU',
        subtitle: 'هدف سنة 1 · عرض Banuba الرسمي',
        targetMau: 1000,
        banubaAnnualUsd: { min: 15000, max: 35000 },
      },
    ],
    usage: {
      skinScansPerActiveUser: 1.2,
      youcamPerScanUsd: { min: 0.12, max: 0.4 },
      outfitAdoption: 0.45,
      outfitPerRunUsd: { min: 0.3, max: 1.0 },
      openaiPerUserUsd: { min: 0.1, max: 0.35 },
      renderBaseUsd: { min: 30, max: 55 },
      renderPerUserUsd: { min: 0.03, max: 0.1 },
      firebaseUsd: { min: 0, max: 25 },
    },
    assumptions: [
      'MAU = مستخدم فريد في الشهر فتح ميزة AR try-on (تعريف Banuba يُؤكَّد مع Account Manager).',
      'YouCam = ~1.2 تحليل بشرة/مستخدم/شهر (per API call — ليس Banuba).',
      'Outfit = ~45% من النشطين × تحليل إطلالة واحد (FASHN + OpenAI على Render).',
      'OpenAI = استشارة MCE + semantic outfit — تقدير per user.',
      'Banuba = $0 في شهر 1–2 (trial) · من شهر 3 = عقد سنوي ÷ 12 (iOS · Makeup فقط).',
      'Render = Postgres + API على free/starter + زيادة طفيفة مع الحجم.',
    ],
  };

  function calcMonthOperating(scenario, monthDef) {
    const u = MAU_OPERATING_MODEL.usage;
    const active = Math.max(1, Math.round(scenario.targetMau * monthDef.factor));
    const skinScans = Math.round(active * u.skinScansPerActiveUser);
    const outfitRuns = Math.round(active * u.outfitAdoption);

    const youcam = {
      min: skinScans * u.youcamPerScanUsd.min,
      max: skinScans * u.youcamPerScanUsd.max,
    };
    const outfit = {
      min: outfitRuns * u.outfitPerRunUsd.min,
      max: outfitRuns * u.outfitPerRunUsd.max,
    };
    const openai = {
      min: active * u.openaiPerUserUsd.min,
      max: active * u.openaiPerUserUsd.max,
    };
    const render = {
      min: u.renderBaseUsd.min + active * u.renderPerUserUsd.min,
      max: u.renderBaseUsd.max + active * u.renderPerUserUsd.max,
    };
    const banuba =
      monthDef.banuba === 'contract'
        ? {
            min: scenario.banubaAnnualUsd.min / 12,
            max: scenario.banubaAnnualUsd.max / 12,
          }
        : { min: 0, max: 0 };

    const total = {
      min:
        youcam.min +
        outfit.min +
        openai.min +
        render.min +
        banuba.min +
        u.firebaseUsd.min,
      max:
        youcam.max +
        outfit.max +
        openai.max +
        render.max +
        banuba.max +
        u.firebaseUsd.max,
    };

    return {
      active,
      skinScans,
      outfitRuns,
      youcam,
      outfit,
      openai,
      render,
      banuba,
      total,
    };
  }

  function sumSixMonths(scenario) {
    let min = 0;
    let max = 0;
    MAU_OPERATING_MODEL.rampByMonth.forEach((m) => {
      const c = calcMonthOperating(scenario, m);
      min += c.total.min;
      max += c.total.max;
    });
    return { min, max };
  }

  function renderMauOperatingHtml() {
    const assumptionLis = MAU_OPERATING_MODEL.assumptions
      .map((a) => `<li>${a}</li>`)
      .join('');

    const scenarioTables = MAU_OPERATING_MODEL.scenarios
      .map((sc) => {
        const rows = MAU_OPERATING_MODEL.rampByMonth.map((m) => {
          const c = calcMonthOperating(sc, m);
          const banubaCell =
            m.banuba === 'trial'
              ? '<span class="phase-badge p1">Trial $0</span>'
              : `${fmt(Math.round(c.banuba.min))} – ${fmt(Math.round(c.banuba.max))}`;
          return `<tr>
            <td><strong>${m.label}</strong></td>
            <td>${c.active.toLocaleString('ar-SA')}</td>
            <td>${c.skinScans}</td>
            <td>${fmt(Math.round(c.youcam.min))} – ${fmt(Math.round(c.youcam.max))}</td>
            <td>${fmt(Math.round(c.outfit.min))} – ${fmt(Math.round(c.outfit.max))}</td>
            <td>${fmt(Math.round(c.openai.min))} – ${fmt(Math.round(c.openai.max))}</td>
            <td>${fmt(Math.round(c.render.min))} – ${fmt(Math.round(c.render.max))}</td>
            <td>${banubaCell}</td>
            <td class="mau-total-cell"><strong>${fmt(Math.round(c.total.min))} – ${fmt(Math.round(c.total.max))}</strong><br><span class="muted-inline">${sar(Math.round(c.total.min))} – ${sar(Math.round(c.total.max))} SAR</span></td>
          </tr>`;
        }).join('');

        const six = sumSixMonths(sc);
        return `
          <div class="mau-scenario-block" id="mau-${sc.id}">
            <h4>${sc.label} <span class="muted-inline">— ${sc.subtitle}</span></h4>
            <p class="scenario-meta">هدف MAU في شهر 6: <strong>${sc.targetMau.toLocaleString('ar-SA')}</strong> ·
              Banuba سنوي (تقدير): ${fmt(sc.banubaAnnualUsd.min)} – ${fmt(sc.banubaAnnualUsd.max)}
              (${sar(sc.banubaAnnualUsd.min)} – ${sar(sc.banubaAnnualUsd.max)} SAR)</p>
            <div class="table-scroll">
              <table class="task-table mau-month-table">
                <thead>
                  <tr>
                    <th>الشهر</th>
                    <th>MAU نشط</th>
                    <th>تحليلات بشرة</th>
                    <th>YouCam</th>
                    <th>Outfit API</th>
                    <th>OpenAI</th>
                    <th>Render</th>
                    <th>Banuba</th>
                    <th>المجموع الشهري</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                  <tr class="mau-six-month-row">
                    <td colspan="8"><strong>مجموع شهر 1 → 6 (تشغيل فقط)</strong></td>
                    <td class="mau-total-cell">
                      <strong>${fmt(Math.round(six.min))} – ${fmt(Math.round(six.max))}</strong><br>
                      <span class="muted-inline">${sar(Math.round(six.min))} – ${sar(Math.round(six.max))} SAR</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>`;
      })
      .join('');

    const compareRow = MAU_OPERATING_MODEL.scenarios
      .map((sc) => {
        const m6 = calcMonthOperating(
          sc,
          MAU_OPERATING_MODEL.rampByMonth[5]
        );
        const six = sumSixMonths(sc);
        return `<tr>
          <td><strong>${sc.label}</strong></td>
          <td>${sc.targetMau.toLocaleString('ar-SA')}</td>
          <td>${fmt(Math.round(m6.total.min))} – ${fmt(Math.round(m6.total.max))}</td>
          <td>${sar(Math.round(m6.total.min))} – ${sar(Math.round(m6.total.max))}</td>
          <td>${fmt(Math.round(six.min))} – ${fmt(Math.round(six.max))}</td>
          <td>${sar(Math.round(six.min))} – ${sar(Math.round(six.max))}</td>
        </tr>`;
      })
      .join('');

    return `
      <div class="card token-explainer" id="mau-operating-costs" style="margin-top:36px;border:2px solid #9b7bff;">
        <h3 style="margin-top:0;">💳 Token vs رسوم — قبل الأرقام</h3>
        <table class="task-table">
          <thead><tr><th>المفهوم</th><th>وش هو؟</th><th>هل كل استخدام؟</th></tr></thead>
          <tbody>
            <tr><td><strong>Banuba Client Token</strong></td><td>مفتاح تفعيل SDK (trial أو commercial)</td><td>❌ لا — يفعّل الفترة المدفوعة</td></tr>
            <tr><td><strong>Banuba عقد MAU</strong></td><td>ترخيص سنوي ÷ 12 — حسب مستخدمين AR/شهر</td><td>❌ لا per try-on</td></tr>
            <tr><td><strong>YouCam API</strong></td><td>تحليل بشرة على Render</td><td>✅ ~كل تحليل بشرة</td></tr>
            <tr><td><strong>FASHN + OpenAI Outfit</strong></td><td>تحليل إطلالة</td><td>✅ ~كل run</td></tr>
          </tbody>
        </table>
        <p class="muted-inline" style="margin-bottom:0;">${MAU_OPERATING_MODEL.tokenNote}</p>
      </div>

      <h3 style="margin-top:32px;">📊 تكلفة التشغيل — شهر 1 إلى 6 (Banuba + YouCam + Render)</h3>
      <p>تقدير <strong>OPEX شهري</strong> — بدون تكلفة بناء (Wave 1 dev) · بدون فريق · بدون Marketplace commission.</p>

      <div class="disclaimer-box">
        ⚠️ الأرقام engineering estimates · Banuba/YouCam يتطلبان عرض سعر رسمي ·
        <a href="https://www.banuba.com/faq/banuba-sdk-pricing" target="_blank" rel="noopener">Banuba pricing FAQ</a>
      </div>

      <h4 style="margin-top:20px;">افتراضات النموذج</h4>
      <ul class="assumption-list">${assumptionLis}</ul>

      <h4 style="margin-top:24px;">مقارنة سريعة — شهر 6 vs مجموع 6 أشهر</h4>
      <table class="task-table">
        <thead>
          <tr>
            <th>السيناريو</th>
            <th>MAU هدف</th>
            <th>شهر 6 USD</th>
            <th>شهر 6 SAR</th>
            <th>مجموع 6 أشهر USD</th>
            <th>مجموع 6 أشهر SAR</th>
          </tr>
        </thead>
        <tbody>${compareRow}</tbody>
      </table>

      ${scenarioTables}

      <div class="card ok" style="margin-top:24px;">
        <h4 style="margin-top:0;">✅ كيف تقرئين الجدول</h4>
        <ul style="margin:0;padding-right:20px;">
          <li><strong>شهر 1–2:</strong> Banuba = $0 (trial) — ركّزي على POC شفاه + YouCam.</li>
          <li><strong>شهر 3+:</strong> Banuba = أ biggest line item — لا توقّعي عقد قبل 100–200 مستخدمة حقيقية.</li>
          <li><strong>1000 MAU:</strong> شهر 6 ≈ ${fmt(Math.round(calcMonthOperating(MAU_OPERATING_MODEL.scenarios[2], MAU_OPERATING_MODEL.rampByMonth[5]).total.min))}–${fmt(Math.round(calcMonthOperating(MAU_OPERATING_MODEL.scenarios[2], MAU_OPERATING_MODEL.rampByMonth[5]).total.max))}/شهر — ليس $35k/شهر (ذلك تقدير <em>سنوي</em> قديم).</li>
          <li>اطلبي من Banuba quote لـ <strong>1000 MAU · Flutter · Makeup lip only</strong> قبل التزام.</li>
        </ul>
      </div>
    `;
  }

  const COST_SUMMARY = {
    phase2Build: { min: 225000, max: 392000, label: 'تطوير Phase 2 (one-time)' },
    sdkAnnual: { min: 24000, max: 120000, label: 'Banuba SDK (سنوي)' },
    assets3d: { min: 15000, max: 45000, label: '3D assets · presets · content' },
    infra: { min: 6000, max: 18000, label: 'CDN · storage · Render upgrade (سنوي)' },
    qaLegal: { min: 18000, max: 35000, label: 'QA · legal · compliance' },
    team: { min: 0, max: 0, label: 'فريق داخلي — خارج التقدير' },
  };

  function sar(usd) {
    return Math.round(usd * SPEC.sarRate).toLocaleString('ar-SA');
  }

  function fmt(usd) {
    return '$' + usd.toLocaleString('en-US');
  }

  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function renderVerdict(root) {
    const s = el('section', { id: 'verdict' });
    s.innerHTML = `
      <div class="hero hero-phase2">
        <span class="badge">MIRA PHASE 2 · AR BEAUTY PLATFORM · ${SPEC.version}</span>
        <h1>من محلل بشرة<br />إلى منصة تجميل وموضة عالمية</h1>
        <p class="lead">
          مرجع تنفيذي رسمي — Phase 2 — يغطي الهندسة · الميزات · خطة التنفيذ · التكلفة · المخاطر.
          مربوط بمستودع <code>${SPEC.repo}</code> · ${SPEC.date}.
          <strong>لا تدخل السوق إلا بعمل احترافي — هذه الوثيقة خارطة ذلك.</strong>
        </p>
        <div class="hero-meta">
          <span class="meta-pill"><span class="phase-badge p1">Phase 1</span> Analyze · جاهز ~80%</span>
          <span class="meta-pill"><span class="phase-badge p2">Phase 2</span> Try · Buy · AR</span>
          <span class="meta-pill"><span class="phase-badge cost">$${COST_SUMMARY.phase2Build.min.toLocaleString()}–$${COST_SUMMARY.phase2Build.max.toLocaleString()}</span> تقدير تطوير</span>
        </div>
      </div>

      <div class="card ok" style="margin-top:24px;border:2px solid var(--ok);">
        <h3 style="margin-top:0;">✅ الحكم التنفيذي</h3>
        <p><strong>Phase 1</strong> كافية لإطلاق قوي (Perfect Corp + FASHN + OpenAI + MediaPipe + MIRA Engine).</p>
        <p><strong>Phase 2</strong> ضرورية فقط إذا الرؤية = منصة عالمية · Analyze → Recommend → Try → Buy.</p>
        <p style="margin-bottom:0;"><strong>Banuba</strong> (موصى به) = AR Experience Layer — <em>ليس</em> بديل Perfect Corp أو MediaPipe.</p>
      </div>

      <div class="card hero-makeup-banner" style="margin-top:20px;">
        <h3 style="margin-top:0;">💄 سياسة الإطلاق — الميزات السبع على موجات</h3>
        <p><strong>${AR_ROLLOUT_POLICY.headline}.</strong> ${AR_ROLLOUT_POLICY.subline}</p>
        <p><strong>الأولوية القصوى:</strong> ${AR_ROLLOUT_POLICY.heroFeatureAr} → إطلاق <code>${AR_ROLLOUT_POLICY.firstPublicRelease}</code></p>
        <p style="margin-bottom:0;"><a href="#ar-rollout">← التفاصيل الكاملة · 5 موجات · تكلفة كل موجة</a></p>
      </div>

      <div class="disclaimer-box" style="margin-top:20px;">
        ⚠️ <strong>تنبيه التكلفة:</strong> جميع الأرقام تقديرية engineering · Banuba/Visage يتطلبان عرض سعر رسمي (Enterprise · MAU-based).
        الأسعار بالدollar الأمريكي · التحويل لـ SAR: ×${SPEC.sarRate}.
      </div>
    `;
    root.appendChild(s);
  }

  function renderToc(root) {
    const s = el('section', { class: 'toc card' });
    s.innerHTML = `
      <h2 style="margin-top:0;">فهرس المحتويات</h2>
      <ol>
        <li><a href="#vision">الرؤية · لماذا Phase 2</a></li>
        <li><a href="#architecture">الهندسة · 6 طبقات</a></li>
        <li><a href="#phase1-recap">Phase 1 — ما هو جاهز</a></li>
        <li><a href="#phase2-scope">Phase 2 — النطاق</a></li>
        <li><a href="#ar-rollout">⭐ موجات الإطلاق — المكياج أولاً</a></li>
        <li><a href="#ar-features">7 ميزات AR — تفصيل كل ميزة</a></li>
        <li><a href="#banuba-vs-visage">Banuba vs Visage</a></li>
        <li><a href="#mira-loop">Analyze → Recommend → Try → Buy</a></li>
        <li><a href="#marketplace">Marketplace · الربط التجاري</a></li>
        <li><a href="#implementation">خطة التنفيذ P2.0–P2.6</a></li>
        <li><a href="#costs">التكلفة · build + حاسبة</a></li>
        <li><a href="#mau-operating-costs">تشغيل شهر 1–6 · 100/500/1000 MAU</a></li>
        <li><a href="#risks">المخاطر</a></li>
        <li><a href="#prerequisites">متطلبات قبل البدء</a></li>
      </ol>
    `;
    root.appendChild(s);
  }

  function renderVision(root) {
    const s = el('section', { id: 'vision' });
    s.innerHTML = `
      <h2>١. الرؤية — لماذا Phase 2؟</h2>
      <p>إذا هدف mira = <strong>منصة تجميل وموضة متكاملة</strong> — لا مجرد محلل — فـ Phase 2 يضيف البعد الذي لا يقدمه أي provider وحده:</p>
      <div class="flow-loop">
Analyze (Perfect Corp + FASHN)
    ↓
Explain (OpenAI + MIRA Narrative)
    ↓
Recommend (MIRA Engine + Marketplace match)
    ↓
Try (Banuba AR)          ← Phase 2
    ↓
Buy (Marketplace + Partners)
      </div>
      <h3>لماذا لا نكتفي بـ Phase 1؟</h3>
      <table class="task-table">
        <thead><tr><th>Phase 1</th><th>Phase 2</th></tr></thead>
        <tbody>
          <tr><td>«بشرتك تحتاج ترطيب»</td><td>«جربي هذا السيروم» → <strong>ترى تأثيره</strong> → تشتري</td></tr>
          <tr><td>«أحمر شفاه 312 يناسبك»</td><td>تضغط → <strong>تراه على وجهها</strong> → تشتري</td></tr>
          <tr><td>تحليل إطلالة</td><td>«هذا المكياج مع فستانك» → <strong>fusion try-on</strong></td></tr>
          <tr><td>Capture WOW (MediaPipe)</td><td>AR Beauty Experience (Banuba)</td></tr>
        </tbody>
      </table>
    `;
    root.appendChild(s);
  }

  function renderArchitecture(root) {
    const s = el('section', { id: 'architecture' });
    let cards = PLATFORMS.map(
      (p) => `
      <div class="arch-card" style="border-top:4px solid ${p.color}">
        <span class="phase-badge ${p.phase === 2 ? 'p2' : 'p1'}">Phase ${p.phase}</span>
        <h4>${p.name}</h4>
        <div class="role">${p.role}</div>
        <ul>${p.does.map((d) => `<li>✅ ${d}</li>`).join('')}</ul>
        <ul>${p.doesNot.map((d) => `<li>❌ ${d}</li>`).join('')}</ul>
        <code style="font-size:0.72rem;display:block;margin-top:8px;direction:ltr;text-align:left">${p.code[0]}</code>
      </div>`
    ).join('');
    s.innerHTML = `
      <h2>٢. الهندسة — 6 طبقات</h2>
      <div class="arch-grid">${cards}</div>
      <div class="card" style="margin-top:20px;">
        <h4 style="margin-top:0;">قاعدة ذهبية</h4>
        <p style="margin:0;">كل provider = <strong>دور واحد</strong>. MIRA Engine = العقل الوحيد الذي يجمع · يقرر · يربط · يبيع. لا provider يتحدث مع المستخدم مباشرة.</p>
      </div>
    `;
    root.appendChild(s);
  }

  function renderPhase1(root) {
    const s = el('section', { id: 'phase1-recap' });
    s.innerHTML = `
      <h2>٣. Phase 1 — ما هو جاهز (لا تستبدله)</h2>
      <table class="task-table">
        <thead><tr><th>المكوّن</th><th>الحالة</th><th>الدليل</th></tr></thead>
        <tbody>
          <tr><td>Perfect Corp Skin</td><td><span class="status-pill done">~90%</span></td><td><code>perfect-corp.service.ts</code> · Render</td></tr>
          <tr><td>FASHN Vision</td><td><span class="status-pill done">live</span></td><td><code>/ai/vision/outfit/analyze</code></td></tr>
          <tr><td>MediaPipe + WOW</td><td><span class="status-pill done">merged</span></td><td><code>live_face_map/</code> · PR #1</td></tr>
          <tr><td>MIRA Intelligence</td><td><span class="status-pill done">15+ engines</span></td><td><code>intelligence/pipeline/</code></td></tr>
          <tr><td>Marketplace</td><td><span class="status-pill partial">scaffold</span></td><td><code>MarketplaceRepository</code> · feature flag</td></tr>
          <tr><td>OpenAI Consultation</td><td><span class="status-pill done">live</span></td><td>Mira Advisor · narratives</td></tr>
        </tbody>
      </table>
      <p><strong>Phase 2 يُبنى فوق Phase 1 — لا يستبدل أي مكوّن.</strong></p>
    `;
    root.appendChild(s);
  }

  function renderPhase2Scope(root) {
    const s = el('section', { id: 'phase2-scope' });
    s.innerHTML = `
      <h2>٤. Phase 2 — النطاق</h2>
      <div class="card" style="border:2px solid #9b7bff;margin-bottom:20px;">
        <h4 style="margin-top:0;">📌 قرار الإطلاق الرسمي</h4>
        <p><strong>لا نُطلق الميزات السبع AR دفعة واحدة.</strong> نُطلق على <strong>5 موجات (W0→W5)</strong>.</p>
        <p><strong>Wave 1 = 💄 المكياج</strong> — إطلاق AR الأول والأهم. باقي الميزات (شعر · نظارات · إكسسوارات · …) في موجات لاحقة بعد Gate كل موجة.</p>
        <p style="margin-bottom:0;"><a href="#ar-rollout">خريطة الموجات الكاملة →</a></p>
      </div>
      <div class="grid-2">
        <div class="card">
          <h4 style="margin-top:0;">✅ Wave 1 — الآن (الأولوية)</h4>
          <ul>
            <li>💄 <strong>تجربة المكياج الحي</strong> (lip → full suite)</li>
            <li>P2.1 Lip POC → P2.2 Full Makeup</li>
            <li>MIRA shade recommendation → try → buy</li>
            <li>إطلاق: <code>MIRA Try — Makeup</code></li>
          </ul>
        </div>
        <div class="card">
          <h4 style="margin-top:0;">⏳ موجات لاحقة (بعد Gate)</h4>
          <ul>
            <li>W2: ✨ فلترات preview</li>
            <li>W3: 💇 شعر · 👓 نظارات · 👁 عدسات</li>
            <li>W4: 💎 إكسسوارات · 💅 أظافر · Fusion</li>
            <li>W5: 🛡 Production hardening</li>
          </ul>
        </div>
      </div>
      <div class="grid-2" style="margin-top:16px;">
        <div class="card">
          <h4 style="margin-top:0;">✅ داخل النطاق الكلي</h4>
          <ul>
            <li>Banuba SDK (Flutter) — موجة موجة</li>
            <li>7 AR features — <strong>على مراحل</strong></li>
            <li>MIRA Try-on Orchestrator</li>
            <li>Marketplace Try → Buy</li>
            <li>Shade recommendation · Fusion</li>
          </ul>
        </div>
        <div class="card">
          <h4 style="margin-top:0;">❌ ممنوع</h4>
          <ul>
            ${AR_ROLLOUT_POLICY.forbidden.map((f) => `<li>${f}</li>`).join('')}
            <li>بناء Face Mesh داخلي · استبدال Perfect Corp</li>
          </ul>
        </div>
      </div>
    `;
    root.appendChild(s);
  }

  function renderArRollout(root) {
    const s = el('section', { id: 'ar-rollout' });
    const waveCards = AR_ROLLOUT_WAVES.map((w) => {
      const heroClass = w.status === 'hero' ? 'rollout-wave hero-wave' : 'rollout-wave';
      const statusBadge =
        w.status === 'hero'
          ? '<span class="phase-badge p2">⭐ الأولوية القصوى</span>'
          : w.status === 'prerequisite'
            ? '<span class="phase-badge cost">شرط مسبق</span>'
            : `<span class="phase-badge p1">موجة ${w.order}</span>`;

      let makeupDetail = '';
      if (w.makeupLayers) {
        makeupDetail = `
          <h4>💄 تفصيل طبقات المكياج (Wave 1)</h4>
          <table class="task-table">
            <thead><tr><th>الطبقة</th><th>المدة</th><th>المحتوى</th><th>Gate</th><th>التكلفة</th></tr></thead>
            <tbody>${w.makeupLayers
              .map(
                (m) => `
              <tr>
                <td><strong>${m.layer}</strong></td>
                <td>${m.weeks}</td>
                <td><ul style="margin:0;padding-right:16px">${m.items.map((i) => `<li>${i}</li>`).join('')}</ul></td>
                <td>${m.gate}</td>
                <td>${fmt(m.cost.min)} – ${fmt(m.cost.max)}</td>
              </tr>`
              )
              .join('')}</tbody>
          </table>`;
      }

      const featureList = w.featureLabels
        .map((l) => `<li>${l}</li>`)
        .join('');

      return `
        <div class="${heroClass} card">
          <div class="rollout-wave-header">
            <span class="rollout-icon">${w.icon}</span>
            <div>
              <h3 style="margin:0;">${w.title} ${statusBadge}</h3>
              <p class="rollout-sub">${w.subtitle}</p>
            </div>
          </div>
          <div class="rollout-meta">
            <span><strong>Impl:</strong> ${w.implPhases.join(' → ')}</span>
            <span><strong>المدة:</strong> ${w.weeks}</span>
            <span><strong>Release:</strong> <code>${w.releaseName}</code></span>
            <span><strong>التكلفة:</strong> ${fmt(w.cost.min)} – ${fmt(w.cost.max)} (${sar(w.cost.min)} – ${sar(w.cost.max)} SAR)</span>
          </div>
          <div class="grid-2" style="margin-top:14px;">
            <div>
              <h4 style="margin-top:0;">ميزات هذه الموجة</h4>
              <ul>${featureList || '<li>—</li>'}</ul>
              <p><strong>يرى المستخدم:</strong> ${w.userSees}</p>
            </div>
            <div>
              <h4 style="margin-top:0;">لماذا هذا الترتيب؟</h4>
              <p>${w.why}</p>
              <p><strong>Gate (لا تنتقل للموجة التالية بدون):</strong> ${w.gate}</p>
              <p><strong>فريق:</strong> ${w.teamFocus}</p>
            </div>
          </div>
          ${makeupDetail}
        </div>`;
    }).join('');

    const matrixRows = AR_FEATURES.sort((a, b) => a.launchOrder - b.launchOrder)
      .map((f) => {
        const wave = AR_ROLLOUT_WAVES.find((w) => w.id === f.rolloutWave);
        return `<tr class="${f.isHero ? 'hero-row' : ''}">
          <td>${f.icon} ${f.title}</td>
          <td><code>${f.rolloutWave}</code> · ${f.rolloutLabel}</td>
          <td>${wave ? wave.releaseName : '—'}</td>
          <td>${f.isHero ? '<strong>⭐ Wave 1 — أول إطلاق AR</strong>' : 'بعد Gate ' + f.rolloutWave}</td>
          <td>${fmt(f.costBuild.min)} – ${fmt(f.costBuild.max)}</td>
        </tr>`;
      })
      .join('');

    s.innerHTML = `
      <h2>⭐ ٥. موجات إطلاق الميزات السبع — المكياج أولاً</h2>

      <div class="card hero-makeup-banner">
        <h3 style="margin-top:0;">${AR_ROLLOUT_POLICY.headline}</h3>
        <p>${AR_ROLLOUT_POLICY.subline}</p>
        <p><strong>إطلاق AR الأول:</strong> <code>${AR_ROLLOUT_POLICY.firstPublicRelease}</code></p>
      </div>

      <h3>لماذا المكياج Wave 1 (قبل أي ميزة أخرى)؟</h3>
      <ul>${AR_ROLLOUT_POLICY.whyMakeupFirst.map((r) => `<li>${r}</li>`).join('')}</ul>

      <h3>❌ غير موجود في Wave 1 (يُؤجل عمداً)</h3>
      <p>${AR_ROLLOUT_POLICY.notInWave1.map((id) => {
        const f = AR_FEATURES.find((x) => x.id === id);
        return f ? f.icon + ' ' + f.title : id;
      }).join(' · ')}</p>

      <div class="flow-loop" style="margin:24px 0;">
W0 Marketplace (no AR)
  ↓ gate
W1 💄 MAKEUP — Hero · MIRA Try — Makeup     ← FIRST AR RELEASE
  ↓ gate
W2 ✨ Filters (preview · try-on mode only)
  ↓ gate
W3 💇 Hair · 👓 Glasses · 👁 Contacts
  ↓ gate
W4 💎 Accessories · 💅 Nails · Fusion
  ↓ gate
W5 🛡 Production Hardening · Global Ready
      </div>

      <h3>مصفوفة: كل ميزة → موجتها → release</h3>
      <table class="task-table feature-matrix">
        <thead>
          <tr>
            <th>الميزة</th>
            <th>الموجة</th>
            <th>اسم Release</th>
            <th>متى تُطلق</th>
            <th>تكلفة بناء</th>
          </tr>
        </thead>
        <tbody>${matrixRows}</tbody>
      </table>

      <h3 style="margin-top:36px;">تفصيل كل موجة</h3>
      <div class="rollout-timeline">${waveCards}</div>

      <div class="disclaimer-box" style="margin-top:24px;">
        <strong>ملاحظة تنفيذية:</strong> Wave 5 (Hardening) يُنفَّذ بالتوازي مع اختبار كل موجة —
        لكن «Global Ready» release لا يحدث إلا بعد اجتياز Gate W1 على الأقل (Makeup live + revenue).
      </div>
    `;
    root.appendChild(s);
  }

  function renderArFeatures(root) {
    const s = el('section', { id: 'ar-features' });
    let blocks = AR_FEATURES.sort((a, b) => a.launchOrder - b.launchOrder).map(
      (f) => `
      <div class="impl-phase card ${f.isHero ? 'hero-wave' : ''}" id="feature-${f.id}">
        <h3>
          ${f.icon} ${f.title}
          ${f.isHero ? '<span class="phase-badge p2">⭐ Wave 1 · Hero</span>' : `<span class="phase-badge p1">${f.rolloutWave}</span>`}
          · ROI: ${f.roi}
        </h3>
        <p class="rollout-sub"><strong>موجة الإطلاق:</strong> ${f.rolloutLabel}</p>
        ${f.isHero ? '<p class="hero-tag">🚀 <strong>أول ميزة AR تُطلق للمستخدمين</strong> — لا تُدمج مع الميزات الأخرى في release واحد.</p>' : `<p class="deferred-tag">⏳ <strong>مؤجّلة</strong> — تُطلق بعد Gate ${f.rolloutWave} (ليس مع المكياج).</p>`}
        <p>${f.description}</p>
        <p><strong>لماذا:</strong> ${f.why}</p>
        <h4>التنفيذ التقني</h4>
        <ul>${f.technical.map((t) => `<li>${t}</li>`).join('')}</ul>
        <h4>ملفات مقترحة</h4>
        <ul>${f.files.map((x) => `<li><code>${x}</code></li>`).join('')}</ul>
        <h4>معايير القبول</h4>
        <ul>${f.acceptance.map((a) => `<li>☑ ${a}</li>`).join('')}</ul>
        <p><strong>جهد:</strong> ${f.effortDevDays.min}–${f.effortDevDays.max} يوم dev ·
        <strong>تكلفة بناء:</strong> ${fmt(f.costBuild.min)} – ${fmt(f.costBuild.max)}
        (${sar(f.costBuild.min)} – ${sar(f.costBuild.max)} SAR)</p>
      </div>`
    ).join('');
    s.innerHTML = `
      <h2>٦. ميزات AR — تفصيل تنفيذي (مرتبة حسب موجة الإطلاق)</h2>
      <p>كل ميزة أدناه مربوطة بموجة (<a href="#ar-rollout">W0–W5</a>). <strong>Wave 1 = المكياج فقط.</strong></p>
      ${blocks}`;
    root.appendChild(s);
  }

  function renderBanubaVisage(root) {
    const s = el('section', { id: 'banuba-vs-visage' });
    const rows = BANUBA_VS_VISAGE.map(
      (r) => `<tr><td>${r.feature}</td><td>${r.banuba}</td><td>${r.visage}</td></tr>`
    ).join('');
    s.innerHTML = `
      <h2>٧. Banuba vs Visage</h2>
      <table class="task-table feature-matrix">
        <thead><tr><th>الميزة</th><th>Banuba</th><th>Visage</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="card ok" style="margin-top:16px;">
        <strong>توصية MIRA:</strong> Banuba للـ Phase 2 — beauty-first · makeup · filters.
        Visage بديل إذا أولوية glasses tracking / head pose أدق.
      </div>
    `;
    root.appendChild(s);
  }

  function renderMiraLoop(root) {
    const s = el('section', { id: 'mira-loop' });
    s.innerHTML = `
      <h2>٨. Analyze → Recommend → Try → Buy</h2>
      <div class="flow-loop">
[1] User captures face (MediaPipe WOW → quality gate)
[2] POST /ai/skin-analysis → Perfect Corp → SkinReport
[3] MIRA Engine → narrative + shade recommendation
[4] MarketplaceRepository.matchForReport() → SKU #312
[5] User taps "جربي الآن"
[6] ArTryOnScreen → Banuba applies lip preset #312
[7] User taps "اشتري" → partner checkout / deep link
[8] Analytics: tryon_start · tryon_complete · purchase
      </div>
      <h3>مثال تدفق كامل</h3>
      <table class="task-table">
        <thead><tr><th>خطوة</th><th>ميرا تقول</th><th>التقنية</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>«بشرتك دهنية · مسام مرئية»</td><td>Perfect Corp + MIRA narrative</td></tr>
          <tr><td>2</td><td>«يناسبك أحمر شفاه 312 (warm undertone)»</td><td>shade-matcher.ts</td></tr>
          <tr><td>3</td><td>المستخدمة تضغط «جربي»</td><td>Banuba lip preset</td></tr>
          <tr><td>4</td><td>«جربي لون شعر شوكولاتة»</td><td>Banuba hair + FASHN outfit harmony</td></tr>
          <tr><td>5</td><td>«هذه الأقراط مع إطلالتك»</td><td>accessory + fusion engine</td></tr>
          <tr><td>6</td><td>«اشتري من Sephora»</td><td>marketplace deep link</td></tr>
        </tbody>
      </table>
    `;
    root.appendChild(s);
  }

  function renderMarketplace(root) {
    const s = el('section', { id: 'marketplace' });
    s.innerHTML = `
      <h2>٩. Marketplace — شرط Wave 0 (قبل المكياج)</h2>
      <div class="card" style="border-right:4px solid var(--warn);">
        <p><strong>⚠️ Banuba قبل Marketplace live = wow بدون revenue.</strong></p>
        <p style="margin-bottom:0;">الترتيب: W0 Marketplace → W1 Makeup → W2+ …</p>
      </div>
      <h3>موجود في الكود</h3>
      <ul>
        <li><code>MarketplaceRepository.matchForReport(SkinReport)</code></li>
        <li><code>MIRA_MARKETPLACE_ENABLED</code> feature flag</li>
        <li>Discover hub · partners · product detail screens</li>
      </ul>
      <h3>مطلوب قبل P2.1</h3>
      <table class="task-table">
        <thead><tr><th>Item</th><th>Why</th><th>Owner</th></tr></thead>
        <tbody>
          <tr><td>SKU catalog JSON/API</td><td>Map product → Banuba preset ID</td><td>Backend + Partners</td></tr>
          <tr><td>Shade matching rules</td><td>Undertone → lipstick shades</td><td>MIRA Engine</td></tr>
          <tr><td>Checkout / affiliate links</td><td>Try → Buy conversion</td><td>Product</td></tr>
          <tr><td>Analytics funnel</td><td>Measure ROI of Banuba investment</td><td>Data</td></tr>
        </tbody>
      </table>
    `;
    root.appendChild(s);
  }

  function renderImplementation(root) {
    const s = el('section', { id: 'implementation' });
    let phases = IMPL_PHASES.map(
      (p) => {
        const wave = AR_ROLLOUT_WAVES.find((w) => w.id === p.wave);
        return `
      <div class="impl-phase card ${p.wave === 'W1' ? 'hero-wave' : ''}">
        <h3>
          ${p.title}
          <span class="phase-badge ${p.wave === 'W1' ? 'p2' : 'cost'}">${p.wave}${wave ? ' · ' + wave.icon : ''}</span>
          <span class="phase-badge cost">${p.weeks} أسابيع</span>
        </h3>
        ${p.wave === 'W1' ? '<p class="hero-tag">⭐ جزء من Wave 1 — إطلاق AR Hero (Makeup)</p>' : ''}
        <p><strong>الهدف:</strong> ${p.goal}</p>
        <p><strong>Gate:</strong> ${p.gate}</p>
        <p><strong>تكلفة:</strong> ${fmt(p.cost.min)} – ${fmt(p.cost.max)}</p>
        <table class="task-table">
          <thead><tr><th>المهمة</th><th>Owner</th><th>Proof</th></tr></thead>
          <tbody>${p.tasks.map((t) => `<tr><td>${t.task}</td><td>${t.owner}</td><td><code>${t.proof}</code></td></tr>`).join('')}</tbody>
        </table>
      </div>`;
      }
    ).join('');
    s.innerHTML = `
      <h2>١٠. خطة التنفيذ P2.0 → P2.6 (مربوطة بالموجات)</h2>
      <p>كل P2.x ينتمي لموجة W0–W5. <strong>P2.1 + P2.2 = Wave 1 Makeup فقط.</strong></p>
      ${phases}`;
    root.appendChild(s);
  }

  function renderCosts(root) {
    const s = el('section', { id: 'costs' });
    const rows = Object.entries(COST_SUMMARY)
      .map(
        ([, v]) =>
          `<tr><td>${v.label}</td><td>${fmt(v.min)} – ${fmt(v.max)}</td><td>${sar(v.min)} – ${sar(v.max)} SAR</td></tr>`
      )
      .join('');
    const totalMin = Object.values(COST_SUMMARY).reduce((a, v) => a + v.min, 0);
    const totalMax = Object.values(COST_SUMMARY).reduce((a, v) => a + v.max, 0);

    s.innerHTML = `
      <h2>١١. التكلفة — تقدير engineering (موجة موجة)</h2>

      <h3>تكلفة كل موجة (build فقط — بدون SDK)</h3>
      <table class="task-table">
        <thead>
          <tr><th>الموجة</th><th>المحتوى</th><th>USD</th><th>SAR</th></tr>
        </thead>
        <tbody>
          ${AR_ROLLOUT_WAVES.map(
            (w) => `<tr class="${w.status === 'hero' ? 'hero-row' : ''}">
              <td><strong>${w.id}</strong> ${w.icon} ${w.title.replace(/^Wave \d — /, '')}</td>
              <td>${w.featureLabels.join(' · ') || 'Marketplace'}</td>
              <td>${fmt(w.cost.min)} – ${fmt(w.cost.max)}</td>
              <td>${sar(w.cost.min)} – ${sar(w.cost.max)}</td>
            </tr>`
          ).join('')}
          <tr style="font-weight:800;background:#fdf5f9">
            <td colspan="2">مجموع Waves W0–W5 (build)</td>
            <td>${fmt(AR_ROLLOUT_WAVES.reduce((a, w) => a + w.cost.min, 0))} – ${fmt(AR_ROLLOUT_WAVES.reduce((a, w) => a + w.cost.max, 0))}</td>
            <td>${sar(AR_ROLLOUT_WAVES.reduce((a, w) => a + w.cost.min, 0))} – ${sar(AR_ROLLOUT_WAVES.reduce((a, w) => a + w.cost.max, 0))}</td>
          </tr>
        </tbody>
      </table>

      <h3 style="margin-top:28px;">💄 Wave 1 Makeup — تفصيل التكلفة (الأهم)</h3>
      <table class="task-table">
        <thead><tr><th>الطبقة</th><th>USD</th><th>SAR</th></tr></thead>
        <tbody>
          ${MAKEUP_LAYERS.map(
            (m) => `<tr><td>${m.layer}</td><td>${fmt(m.cost.min)} – ${fmt(m.cost.max)}</td><td>${sar(m.cost.min)} – ${sar(m.cost.max)}</td></tr>`
          ).join('')}
          <tr class="hero-row"><td><strong>Wave 1 Makeup إجمالي</strong></td><td>${fmt(63000)} – ${fmt(110000)}</td><td>${sar(63000)} – ${sar(110000)}</td></tr>
        </tbody>
      </table>

      <h3 style="margin-top:28px;">Overhead + SDK (سنوي)</h3>
      <table class="task-table">
        <thead><tr><th>البند</th><th>USD</th><th>SAR (×${SPEC.sarRate})</th></tr></thead>
        <tbody>${rows}
          <tr style="font-weight:800;background:#fdf5f9">
            <td>المجموع التقديري Phase 2</td>
            <td>${fmt(totalMin)} – ${fmt(totalMax)}</td>
            <td>${sar(totalMin)} – ${sar(totalMax)} SAR</td>
          </tr>
        </tbody>
      </table>

      <div class="cost-calculator" style="margin-top:28px;">
        <h3 style="margin-top:0;">🧮 حاسبة تفاعلية</h3>
        <label for="scopeSelect">نطاق Phase 2 (حسب الموجة)</label>
        <select id="scopeSelect">
          <option value="w0">W0 — Marketplace فقط (بدون AR)</option>
          <option value="w1" selected>W1 — 💄 Makeup Hero (الأولوية)</option>
          <option value="w1w2">W1 + W2 — Makeup + Filters</option>
          <option value="w1w3">W1→W3 — Makeup + Style (hair/glasses/contacts)</option>
          <option value="full">W0→W5 — كل الموجات (7 ميزات)</option>
        </select>
        <label for="sdkTier">Banuba SDK (شهري)</label>
        <select id="sdkTier">
          <option value="2000">Starter ~$2,000/شهر</option>
          <option value="5000" selected>Growth ~$5,000/شهر</option>
          <option value="10000">Scale ~$10,000/شهر</option>
        </select>
        <label for="teamSize">حجم الفريق الخارجي: <span id="teamLabel">2</span></label>
        <input type="range" id="teamSize" min="1" max="5" value="2" />
        <div class="cost-total" id="costTotal"></div>
      </div>

      <h3>تكلفة Phase 1 (مرجع — جاري)</h3>
      <table class="task-table">
        <thead><tr><th>Provider</th><th>شهري USD</th></tr></thead>
        <tbody>
          ${PLATFORMS.filter((p) => p.phase === 1 && p.costMonthly.max > 0)
            .map(
              (p) =>
                `<tr><td>${p.name}</td><td>${fmt(p.costMonthly.min)} – ${fmt(p.costMonthly.max)}</td></tr>`
            )
            .join('')}
          <tr><td>Render + Firebase + Postgres</td><td>$50 – $300</td></tr>
        </tbody>
      </table>

      ${renderMauOperatingHtml()}
    `;
    root.appendChild(s);
    initCostCalculator(totalMin, totalMax);
  }

  function initCostCalculator(baseMin, baseMax) {
    const waveCost = (ids) => {
      const waves = AR_ROLLOUT_WAVES.filter((w) => ids.includes(w.id));
      return {
        min: waves.reduce((a, w) => a + w.cost.min, 0),
        max: waves.reduce((a, w) => a + w.cost.max, 0),
        months: Math.ceil(waves.reduce((a, w) => a + parseInt(w.weeks.split('–')[1] || w.weeks, 10), 0) / 4),
        label: waves.map((w) => w.id).join(' → '),
      };
    };
    const scopes = {
      w0: { ...waveCost(['W0']), months: 1.5, note: 'بدون AR — Marketplace فقط' },
      w1: { ...waveCost(['W0', 'W1']), months: 4, note: '⭐ إطلاق AR الأول — Makeup Hero' },
      w1w2: { ...waveCost(['W0', 'W1', 'W2']), months: 5, note: 'Makeup + Beauty filters' },
      w1w3: { ...waveCost(['W0', 'W1', 'W2', 'W3']), months: 8, note: 'حتى Style (hair · glasses · contacts)' },
      full: { min: baseMin, max: baseMax, months: 14, label: 'W0→W5', note: 'كل الميزات السبع — على مراحل' },
    };
    const select = document.getElementById('scopeSelect');
    const sdk = document.getElementById('sdkTier');
    const team = document.getElementById('teamSize');
    const teamLabel = document.getElementById('teamLabel');
    const out = document.getElementById('costTotal');

    function update() {
      const sc = scopes[select.value];
      const sdkM = parseInt(sdk.value, 10);
      const teamM = parseInt(team.value, 10);
      teamLabel.textContent = teamM;
      const build = { min: sc.min * (0.9 + teamM * 0.05), max: sc.max * (0.95 + teamM * 0.08) };
      const sdkTotal = sdkM * sc.months;
      const totalMin = build.min + sdkTotal;
      const totalMax = build.max + sdkTotal * 1.2;
      out.innerHTML = `
        <div>نطاق: <strong>${select.options[select.selectedIndex].text}</strong></div>
        <div>${sc.note || ''}</div>
        <div>موجات: <code>${sc.label || '—'}</code></div>
        <div>مدة تقديرية: <strong>${sc.months} شهر</strong></div>
        <div class="big">${fmt(Math.round(totalMin))} – ${fmt(Math.round(totalMax))}</div>
        <div>${sar(Math.round(totalMin))} – ${sar(Math.round(totalMax))} SAR · build + SDK ${sc.months} شهر</div>
        ${select.value === 'w1' ? '<p style="margin:12px 0 0;font-size:0.88rem"><strong>Wave 1:</strong> P2.1 Lip POC + P2.2 Full Makeup — لا شعر · لا نظارات · لا إكسسوارات.</p>' : ''}
      `;
    }
    select.addEventListener('change', update);
    sdk.addEventListener('change', update);
    team.addEventListener('input', update);
    update();
  }

  function renderRisks(root) {
    const s = el('section', { id: 'risks' });
    s.innerHTML = `
      <h2>١٢. المخاطر</h2>
      <table class="task-table">
        <thead><tr><th>الخطر</th><th>الاحتمال</th><th>التخفيف</th></tr></thead>
        <tbody>
          <tr><td>إطلاق 7 ميزات دفعة واحدة → quality collapse</td><td class="risk-high">عالي</td><td>سياسة Waves W0–W5 · Makeup Hero W1</td></tr>
          <tr><td>Banuba pricing أعلى من التقدير</td><td class="risk-med">متوسط</td><td>POC W1 lip قبل عقد سنوي</td></tr>
          <tr><td>أداء AR &lt; 30fps على أجهزة mid-range</td><td class="risk-med">متوسط</td><td>Device matrix · quality tiers</td></tr>
          <tr><td>Marketplace غير جاهز → no ROI</td><td class="risk-high">عالي</td><td>P2.0 gate قبل Banuba</td></tr>
          <tr><td>Perfect Corp scores affected by filters</td><td class="risk-high">عالي</td><td>ANALYZE vs TRY_ON mode separation</td></tr>
          <tr><td>App Store rejection (AR + health claims)</td><td class="risk-med">متوسط</td><td>Disclaimers · no medical claims</td></tr>
          <tr><td>Vendor lock-in Banuba</td><td class="risk-med">متوسط</td><td>Adapter pattern · abstract TryOnProvider</td></tr>
          <tr><td>3D asset cost overrun</td><td class="risk-med">متوسط</td><td>Partner-provided assets</td></tr>
        </tbody>
      </table>
    `;
    root.appendChild(s);
  }

  function renderPrerequisites(root) {
    const s = el('section', { id: 'prerequisites' });
    s.innerHTML = `
      <h2>١٣. متطلبات قبل بدء Phase 2</h2>
      <table class="task-table">
        <thead><tr><th>#</th><th>المتطلب</th><th>الحالة</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Phase 1 Soft Launch live</td><td><span class="status-pill partial">~82%</span></td></tr>
          <tr><td>2</td><td>E2E Perfect Corp production validated</td><td><span class="status-pill partial">pending</span></td></tr>
          <tr><td>3</td><td>Marketplace enabled + 10 SKUs</td><td><span class="status-pill missing">required</span></td></tr>
          <tr><td>4</td><td>Wave 0: Marketplace + 10 makeup SKUs</td><td><span class="status-pill missing">W0 gate</span></td></tr>
          <tr><td>5</td><td>Wave 1: Banuba lip POC (P2.1)</td><td><span class="status-pill missing">Makeup Hero</span></td></tr>
          <tr><td>6</td><td>Wave 1: Full makeup suite (P2.2)</td><td><span class="status-pill missing">after P2.1 gate</span></td></tr>
          <tr><td>7</td><td>Legal: AR preview disclaimer</td><td><span class="status-pill missing">required</span></td></tr>
          <tr><td>8</td><td>Budget Wave 1: ~$88K–$155K (W0+W1)</td><td><span class="status-pill missing">stakeholder</span></td></tr>
        </tbody>
      </table>
      <div class="card ok" style="margin-top:20px;">
        <h4 style="margin-top:0;">✅ قرار الدخول للسوق العالمي</h4>
        <p style="margin:0;">
          <strong>Wave 0 → Wave 1 Makeup</strong> أولاً — لا تتخطون إلى W2/W3 قبل Gate W1.
          الميزات الست الأخرى <strong>مؤجّلة عمداً</strong> — ليست تأخيراً بل احترافية.
        </p>
      </div>
    `;
    root.appendChild(s);
  }

  function init() {
    const root = document.getElementById('app');
    if (!root) return;
    renderVerdict(root);
    renderToc(root);
    renderVision(root);
    renderArchitecture(root);
    renderPhase1(root);
    renderPhase2Scope(root);
    renderArRollout(root);
    renderArFeatures(root);
    renderBanubaVisage(root);
    renderMiraLoop(root);
    renderMarketplace(root);
    renderImplementation(root);
    renderCosts(root);
    renderRisks(root);
    renderPrerequisites(root);

    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('mainNav');
    if (toggle && nav) {
      toggle.style.display = 'block';
      toggle.addEventListener('click', () => nav.classList.toggle('open'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
