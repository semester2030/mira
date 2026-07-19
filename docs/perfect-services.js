/**
 * MIRA × Perfect Corp (YouCam API) — Strategic Services Catalog
 * دراسة عميقة: متى · لماذا · كيف لكل خدمة
 */
(function () {
  'use strict';

  const SPEC = {
    version: '1.1.0',
    date: '2026-07-05',
    repo: 'semester2030/mira',
    perfectConsole: 'https://yce.perfectcorp.com',
    perfectDocs: 'https://yce.perfectcorp.com/api-console/en/documentation',
    s2sBase: 'https://yce-api-01.makeupar.com/s2s/v2.0',
    sarRate: 3.75,
  };

  const CATEGORIES = [
    { id: 'skin_face_body', label: 'Skin · Face · Body', icon: '🔬', color: '#e86fa9' },
    { id: 'beauty', label: 'Beauty · Makeup', icon: '💄', color: '#c95889' },
    { id: 'fashion', label: 'Fashion · Try-On', icon: '👗', color: '#c19ee0' },
    { id: 'jewelry_watch', label: 'Jewelry · Watch', icon: '⌚', color: '#c9a227' },
    { id: 'hair', label: 'Hair · Beard', icon: '💇', color: '#5ce1ff' },
    { id: 'image_video', label: 'Image · Video', icon: '🎬', color: '#64b5f6' },
  ];

  const STATUS_LABELS = {
    live: { label: '✅ Live في ميرا', cls: 'live' },
    p0: { label: 'P0 — فوري', cls: 'p0' },
    p1: { label: 'P1 — Phase 2', cls: 'p1' },
    p2: { label: 'P2 — توسع', cls: 'p2' },
    p3: { label: 'P3 — لاحقاً', cls: 'p3' },
    evaluate: { label: '🔍 تقييم', cls: 'eval' },
    exclude: { label: '❌ خارج العلامة', cls: 'skip' },
  };

  /** @type {Array<object>} */
  const SERVICES = [
    /* ─── SKIN · FACE · BODY ─── */
    {
      id: 'skin_analysis',
      name: 'AI Skin Analysis',
      nameAr: 'تحليل البشرة بالذكاء الاصطناعي',
      category: 'skin_face_body',
      icon: '🔬',
      perfectPath: '/ai-api/products/skin-analysis',
      summary:
        'تحليل 14+ concern بشرة (مسام · تجاعيد · ترطيب · حب شباب · تصبغات…) مع درجات ui_score — أساس Phase 1 في ميرا.',
      perfectOffers: [
        '14 concern types · verified dermatology benchmarks',
        'S2S v2.0: upload → task → poll',
        'dst_actions قابلة للتخصيص',
        'Playground + API Dashboard + credits',
      ],
      miraStatus: 'live',
      miraPhase: 'Phase 1 · Production',
      when: 'الآن — منشور على Render · SKIN_PROVIDER=perfect_corp',
      why: [
        'قلب منتج ميرا: «فهم بشرتك» قبل أي توصية مكياج أو skincare',
        'يربط مباشرة بـ MCE · Undertone Intelligence · Face Map Engine',
        'لا بديل داخلي بنفس الدقة — MediaPipe quality gate فقط قبل الإرسال',
        'يولّد بيانات structured لـ Marketplace skincare match',
      ],
      whyNot: [],
      how: {
        pattern: 'S2S async task (file upload → task → poll)',
        endpoints: [
          'POST /file/skin-analysis',
          'POST /task/skin-analysis',
          'GET /task/skin-analysis/{taskId}',
        ],
        server: [
          'mira-api/src/ai/services/perfect-corp.service.ts',
          'mira-api/src/ai/mocks/perfect-corp-skin.provider.ts',
          'POST /api/v1/ai/skin-analysis',
        ],
        flutter: [
          'lib/features/skin_analysis/',
          'SkinAnalysisApiDataSource → Render فقط (لا مفتاح Perfect في Flutter)',
        ],
        steps: [
          '1. Flutter: MediaPipe gate + crop → multipart image',
          '2. Render: buildYouCamImageVariants (retry on face_too_small)',
          '3. Perfect Corp: upload + task + poll',
          '4. MIRA Engine: undertone · spatial parser · MCE narrative',
          '5. Flutter: SkinReport + recommendations',
        ],
      },
      cost: { model: 'credits_per_scan', usd: '0.12–0.40/scan', note: 'حسب bundle · Dashboard credits' },
      overlap: { fashn: '—', mediapipe: 'Gate قبل upload · ليس تحليل' },
      risks: ['error_src_face_too_small — تحتاج selfie أقرب', 'PERFECT_CORP_FALLBACK_MOCK=false في prod'],
      gate: 'Live · لا تغيّر provider بدون spatial audit',
      scores: { value: 10, effort: 1, fit: 10 },
    },
    {
      id: 'facial_color_tones',
      name: 'AI Facial Color Tones Analyzer',
      nameAr: 'محلل ألوان الوجه (Seasonal · Personal Palette)',
      category: 'skin_face_body',
      icon: '🎨',
      perfectPath: '/ai-api/products/facial-color-analysis',
      summary:
        'يكشف undertone للبشرة · العيون · الشفاه · الحاجب · الشعر — أساس seasonal color analysis وتوصية ألوان المكياج والملابس.',
      perfectOffers: [
        'Personalized color palette per feature zone',
        'Seasonal color report potential',
        'API + Playground',
      ],
      miraStatus: 'p0',
      miraPhase: 'Phase 1.5 → Intelligence Layer',
      when: 'Q3 2026 — بعد استقرار skin analysis · قبل Makeup VTO POC',
      why: [
        'ميرا تبني undertone-intelligence.ts — Perfect يعطي ground truth أسرع من heuristic',
        'يربط تحليل البشرة → توصية ألوان إطلالة · مكياج · hijab/scarf',
        'Differentiator عربي: «ألوانك الموسمية» بتقرير MIRA narrative',
        'يقلل hallucination في OpenAI color advice',
      ],
      whyNot: ['تكلفة API إضافية فوق skin scan — يمكن دمج في session واحدة'],
      how: {
        pattern: 'S2S task (مشابه skin-analysis)',
        endpoints: ['POST /file/... + /task/facial-color-analysis (تحقق من docs)'],
        server: [
          'mira-api/src/intelligence/pipeline/undertone-intelligence.ts ← enrich',
          'PerfectCorpColorProvider (new)',
          'POST /api/v1/ai/color-analysis',
        ],
        flutter: ['ColorPaletteScreen · ربط بـ outfit + makeup recommendations'],
        steps: [
          '1. نفس selfie skin analysis (reuse image buffer)',
          '2. Parallel task: skin + color tones',
          '3. Merge في MIRA Beauty Report',
          '4. MCE: «ألوانك: soft autumn…»',
        ],
      },
      cost: { model: 'credits_per_scan', usd: '0.10–0.35/scan', note: 'قد يُدمج مع skin bundle' },
      overlap: { fashn: 'recolor يستفيد من palette', mediapipe: 'zones mapping' },
      risks: ['تأكيد endpoint من Perfect docs قبل build'],
      gate: 'ΔE color matcher tests · undertone-intelligence.spec.ts green',
      scores: { value: 9, effort: 4, fit: 10 },
    },
    {
      id: 'fitzpatrick',
      name: 'AI Fitzpatrick Skin Type Analysis',
      nameAr: 'تصنيف Fitzpatrick (I–VI)',
      category: 'skin_face_body',
      icon: '☀️',
      perfectPath: '/ai-api/products/fitzpatrick-skin-type',
      summary: 'يصنّف نوع البشرة I–VI حسب حساسية UV — مهم لتوصيات SPF · tanning · laser awareness.',
      perfectOffers: ['6-type Fitzpatrick scale', 'UV sensitivity context'],
      miraStatus: 'p1',
      miraPhase: 'Phase 1.5',
      when: 'مع Color Tones أو مدمج في skin report',
      why: [
        'سوق سعودي/GCC: SPF ووقاية شمس = trust',
        'ي enrich skin report بدون تعقيد UX',
        'Compliance-friendly (تعليمي لا طبي)',
      ],
      whyNot: ['يمكن infer جزئياً من skin analysis — ليس blocker'],
      how: {
        pattern: 'S2S task أو bundled في skin dst_actions',
        endpoints: ['تحقق: fitzpatrick task في console'],
        server: ['Extend perfect-corp.service mapYouCamResults', 'SkinReport.fitzpatrickType'],
        flutter: ['Badge في result_screen · tips SPF'],
        steps: ['دمج في نفس skin session · zero extra capture'],
      },
      cost: { model: 'credits', usd: '0.05–0.20', note: 'أو included في skin bundle' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Medical disclaimer — «استشارة dermatologist»'],
      gate: 'Privacy policy update · no medical claims',
      scores: { value: 7, effort: 3, fit: 8 },
    },
    {
      id: 'skin_simulation',
      name: 'AI Skin Simulation',
      nameAr: 'محاكاة تحسّن البشرة (7 · 14 · 21 يوم)',
      category: 'skin_face_body',
      icon: '📈',
      perfectPath: '/ai-api/products/skin-simulation',
      summary: 'Before/after timeline: كيف قد تبدو البشرة بعد 7/14/21 يوم من routine — retention hook قوي.',
      perfectOffers: ['7 · 14 · 21 day progression', 'Product efficacy visualization'],
      miraStatus: 'p1',
      miraPhase: 'Phase 2 · Retention',
      when: 'بعد Marketplace skincare live · Wave 1 makeup gate',
      why: [
        'Retention: المستخدمة ترجع كل أسبوع لـ «track progress»',
        'يربط product recommendation → visual payoff',
        'Unique retention hook — Perfect ي simulate skincare timeline',
      ],
      whyNot: ['Expectation management — ليس guarantee طبي', 'تكلفة API + UX design للـ timeline'],
      how: {
        pattern: 'S2S task · src + product/routine params',
        endpoints: ['skin-simulation task (console docs)'],
        server: ['SkinSimulationService', 'POST /api/v1/ai/skin-simulation'],
        flutter: ['ProgressTrackerScreen · push notifications day 7/14/21'],
        steps: [
          '1. Baseline skin scan',
          '2. User selects routine from MIRA recommendations',
          '3. Generate 3 simulation frames',
          '4. Weekly rescan compare actual vs simulated',
        ],
      },
      cost: { model: 'credits_per_run', usd: '0.25–0.80/run', note: '3 frames may = 1 credit bundle' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Regulatory: «نتائج فردية vary» disclaimer'],
      gate: 'Legal review · A/B retention +15%',
      scores: { value: 8, effort: 6, fit: 9 },
    },
    {
      id: 'face_attributes',
      name: 'AI Face Attributes & Ratio Analyzer',
      nameAr: 'تحليل ملامح الوجه والنسب (50+ attribute)',
      category: 'skin_face_body',
      icon: '📐',
      perfectPath: '/ai-api/products/face-attribute-analysis',
      summary: 'شكل الوجه · العيون · الأنف · الشفاه · 11 facial ratios — personalization للمكياج والنظارات.',
      perfectOffers: ['50+ attributes', '11 ratios', 'Face shape · eye shape · lip shape'],
      miraStatus: 'p1',
      miraPhase: 'Phase 2 · MCE enrichment',
      when: 'Wave 1 makeup — لت personalized «أين تضعي الهايلايت»',
      why: [
        'MCE prompts أدق: «عينك almond → eyeliner technique X»',
        'يربط مع glasses/contacts try-on لاحقاً',
        'Face-map-engine.ts يستفيد من ground truth',
      ],
      whyNot: ['MediaPipe يعطي landmarks — لكن لا semantic labels'],
      how: {
        pattern: 'S2S task',
        endpoints: ['face-attribute task'],
        server: ['face-map-engine.ts enrich', 'MCE fact extractor'],
        flutter: ['Optional «تقرير ملامحك» premium section'],
        steps: ['Parallel with skin · cache في user profile Firestore'],
      },
      cost: { model: 'credits', usd: '0.15–0.45/scan', note: '' },
      overlap: { fashn: '—', mediapipe: 'landmarks vs semantics' },
      risks: ['Body dysmorphia sensitivity — tone positive'],
      gate: 'MCE quality eval · no «flaws» language',
      scores: { value: 7, effort: 4, fit: 8 },
    },
    {
      id: 'aging_simulation',
      name: 'AI Aging Simulation',
      nameAr: 'محاكاة العمر (Past · Present · Future)',
      category: 'skin_face_body',
      icon: '⏳',
      perfectPath: '/ai-api/products/aging-simulation',
      summary: 'ترى نفسك كطفلة · الآن · مستقبل — engagement viral · anti-aging skincare narrative.',
      perfectOffers: ['Age progression slider', 'Past / Current / Future portraits'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Marketing',
      when: 'Post-launch viral campaign · ليس core loop',
      why: ['Shareable content · TikTok/Instagram', 'يدعم anti-aging product line'],
      whyNot: ['Sensitive emotionally', 'ليس core value prop ميرا'],
      how: {
        pattern: 'S2S single photo',
        server: ['Optional endpoint · rate limit heavy'],
        flutter: ['Share card · watermark MIRA'],
        steps: ['Marketing feature flag · 3 free/month premium'],
      },
      cost: { model: 'credits', usd: '0.20–0.60', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Privacy · children photos prohibited'],
      gate: 'Age 18+ · consent',
      scores: { value: 5, effort: 3, fit: 6 },
    },
    {
      id: 'ai_smile',
      name: 'AI Smile / Expression Changer',
      nameAr: 'إضافة ابتسامة · تغيير الت expression',
      category: 'skin_face_body',
      icon: '😊',
      perfectPath: '/ai-api/products/ai-smile',
      summary: 'يحوّل neutral face → natural smile — polish لصور profile أو before/after.',
      perfectOffers: ['Natural smile synthesis', 'Expression changer'],
      miraStatus: 'p3',
      miraPhase: 'Optional polish',
      when: 'Never critical path',
      why: ['Nice-to-have for share cards'],
      whyNot: ['Low ROI vs core analysis'],
      how: { pattern: 'S2S', server: ['Low priority'], flutter: ['—'], steps: [] },
      cost: { model: 'credits', usd: '0.10–0.30', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Uncanny valley'],
      gate: '—',
      scores: { value: 3, effort: 2, fit: 4 },
    },
    {
      id: 'face_lift',
      name: 'AI Face Lift',
      nameAr: 'محاكاة face lift',
      category: 'skin_face_body',
      icon: '⚠️',
      perfectPath: '/ai-api/products/face-lift',
      summary: 'Before/after face lift simulation — aesthetic clinic use case.',
      perfectOffers: ['Instant lift visualization'],
      miraStatus: 'exclude',
      miraPhase: '—',
      when: 'لا — خارج positioning ميرا',
      why: [],
      whyNot: [
        'ميرا = beauty intelligence · ليس cosmetic surgery simulator',
        'Brand risk · regulatory · ethical (body image)',
        'لا يخدم Analyze → Recommend → Try → Buy loop',
      ],
      how: { pattern: '—', server: [], flutter: [], steps: [] },
      cost: { model: '—', usd: '—', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Reputation damage'],
      gate: 'Excluded by brand policy',
      scores: { value: 1, effort: 3, fit: 1 },
    },
    {
      id: 'face_reshape',
      name: 'AI Face Reshape',
      nameAr: 'محاكاة rhinoplasty · fillers · brow lift',
      category: 'skin_face_body',
      icon: '⚠️',
      perfectPath: '/ai-api/products/face-reshape',
      summary: 'Simulates surgical aesthetic procedures on photo.',
      perfectOffers: ['Rhinoplasty · fillers · lip · brow'],
      miraStatus: 'exclude',
      miraPhase: '—',
      when: 'لا',
      why: [],
      whyNot: ['Same as face_lift — خارج العلامة', 'Conflicts with «celebrate your beauty» narrative'],
      how: { pattern: '—', server: [], flutter: [], steps: [] },
      cost: { model: '—', usd: '—', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['High'],
      gate: 'Excluded',
      scores: { value: 1, effort: 3, fit: 1 },
    },
    {
      id: 'body_reshape',
      name: 'AI Body Reshape',
      nameAr: 'تعديل الجسم في الصورة',
      category: 'skin_face_body',
      icon: '⚠️',
      perfectPath: '/ai-api/products/body-reshape',
      summary: 'Slimming / body contour in photos.',
      perfectOffers: ['Waist · arms slimming'],
      miraStatus: 'exclude',
      miraPhase: '—',
      when: 'لا',
      why: [],
      whyNot: ['Body image harm', 'ميرا focus face/beauty not body editing', 'App Store scrutiny'],
      how: { pattern: '—', server: [], flutter: [], steps: [] },
      cost: { model: '—', usd: '—', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Critical brand risk'],
      gate: 'Excluded',
      scores: { value: 0, effort: 3, fit: 0 },
    },
    {
      id: 'breast_augmentation',
      name: 'AI Breast Augmentation Simulator',
      nameAr: 'محاكاة breast augmentation',
      category: 'skin_face_body',
      icon: '🚫',
      perfectPath: '/ai-api/products/breast-augmentation',
      summary: 'Surgical simulation — clinic vertical.',
      perfectOffers: ['Chest augmentation preview'],
      miraStatus: 'exclude',
      miraPhase: '—',
      when: 'ممنوع',
      why: [],
      whyNot: ['خارج نطاق ميرا بالكامل', 'No marketplace fit', 'Legal/ethical'],
      how: { pattern: '—', server: [], flutter: [], steps: [] },
      cost: { model: '—', usd: '—', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Maximum'],
      gate: 'Hard exclude',
      scores: { value: 0, effort: 0, fit: 0 },
    },

    /* ─── BEAUTY ─── */
    {
      id: 'makeup_vto',
      name: 'AI Makeup Virtual Try-On',
      nameAr: 'تجربة المكياج الافتراضية (13 فئة)',
      category: 'beauty',
      icon: '💄',
      perfectPath: '/ai-api/products/makeup-virtual-try-on',
      summary:
        '13 فئة مكياج · AR + AI face analysis · color/texture simulation — **Hero Wave 1 · المنصة الوحيدة للمكياج في ميرا**.',
      perfectOffers: [
        '13 makeup categories (foundation · lip · eye · blush…)',
        'Real-time AR + photo mode',
        'API Document + Playground',
        'Credits-based — تدفعين على الاستخدام لا عقد MAU سنوي',
      ],
      miraStatus: 'p0',
      miraPhase: 'Wave 1 · Hero — Perfect فقط',
      when: 'Q3–Q4 2026 — أول ميزة try-on بعد skin · Playground ثم Render',
      why: [
        'Provider واحد: skin + makeup + fashion من نفس Console و API key',
        'Credits — تكلفة متناسبة مع النمو (لا $15k+ سنوي مقدماً)',
        '13 categories جاهزة — lip → full face بدون SDK ثالث',
        'Analyze → Recommend → Try → Buy loop كامل على Perfect',
      ],
      whyNot: [
        'Latency: API async في photo mode — optimize UX loading states',
        'Live camera: قد يحتاج Perfect Makeup SDK — تحقق Playground',
        'Vendor concentration — acceptable لأن Perfect = استراتيجية ميرا',
      ],
      how: {
        pattern: 'Perfect Makeup VTO API/SDK — Playground → S2S على Render',
        endpoints: ['Makeup VTO API · Makeup AR SDK (console docs)'],
        server: [
          'mira-api/src/ai/services/perfect-corp-makeup.service.ts',
          'mira-api/src/ai/providers/makeup-vto.provider.ts',
          'POST /api/v1/ai/makeup-try-on',
        ],
        flutter: [
          'lib/features/makeup_tryon/',
          'MakeupTryOnScreen · shade picker · live/photo modes',
        ],
        steps: [
          '1. Playground: lip + foundation POC (free trials)',
          '2. Render: PerfectMakeupProvider · same auth as skin',
          '3. Flutter: camera → Render → preview → Marketplace buy',
          '4. Wave 1 gate: 200 users · 4.0+ rating · then expand categories',
        ],
      },
      cost: { model: 'credits_per_session', usd: '0.05–0.25/session', note: 'Dashboard credits · scales with usage' },
      overlap: { fashn: '—', mediapipe: 'quality gate + optional live mesh' },
      risks: ['UX latency on slow network', 'Inclusive QA Fitzpatrick I–VI'],
      gate: 'Playground POC · 200 real users · product-market fit',
      scores: { value: 10, effort: 7, fit: 10 },
    },
    {
      id: 'makeup_transfer',
      name: 'AI Makeup Transfer',
      nameAr: 'نقل مكياج من صورة → وجهك',
      category: 'beauty',
      icon: '✨',
      perfectPath: '/ai-api/products/makeup-transfer',
      summary: 'Extract makeup look from reference photo (celebrity/influencer) → apply to user selfie — differentiator فريد لـ Perfect.',
      perfectOffers: ['Single photo reference → transfer', '«Find your perfect match in a click»'],
      miraStatus: 'p1',
      miraPhase: 'Wave 1.5 · Perfect',
      when: 'بعد Makeup VTO lip POC · unique differentiator',
      why: [
        'Feature حصرية في Perfect — viral content',
        '«مكياج فلانة على وجهي» → share → download',
        'يربط influencer/partners marketplace',
        'Reference → ثم Makeup VTO لتجربة shades من Marketplace',
      ],
      whyNot: ['Copyright on reference images', 'Quality varies on lighting mismatch'],
      how: {
        pattern: 'S2S: src user photo + ref makeup photo',
        endpoints: ['makeup-transfer task'],
        server: ['MakeupTransferService', 'POST /api/v1/ai/makeup-transfer'],
        flutter: ['Upload reference · shade picker بعد Transfer'],
        steps: [
          '1. User selfie (existing)',
          '2. Pick reference from gallery or influencer pack',
          '3. Perfect transfer → preview',
          '4. MIRA: decompose → recommend products → Makeup VTO try shades',
        ],
      },
      cost: { model: 'credits', usd: '0.20–0.50/transfer', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Reference image licensing'],
      gate: 'Partner content only · no random web scrape',
      scores: { value: 9, effort: 5, fit: 10 },
    },
    {
      id: 'look_vto',
      name: 'AI Look Virtual Try-On',
      nameAr: 'تجربة Look كامل (full-face coordinated)',
      category: 'beauty',
      icon: '👑',
      perfectPath: '/ai-api/products/look-virtual-try-on',
      summary: 'One-click full makeup looks (Romantic · Gothic · Office…) — UX أبسط من category-by-category.',
      perfectOffers: ['Curated full looks', 'Single tap apply', 'Playground'],
      miraStatus: 'p1',
      miraPhase: 'Wave 1 · Perfect',
      when: 'مع Makeup VTO full suite · Perfect look API',
      why: [
        'Onboarding: «جربي look جاهز» قبل customization',
        'Marketplace: sell «MIRA curated looks»',
        'Lower cognitive load for new users',
      ],
      whyNot: ['يحتاج catalog curation · 20+ looks Arabic market'],
      how: {
        pattern: 'API look preset IDs',
        server: ['LookCatalogService · sync with Marketplace'],
        flutter: ['LookCarousel → try → buy products in look'],
        steps: ['Curate 20 looks Arabic market · map to SKUs · Perfect preset IDs'],
      },
      cost: { model: 'credits', usd: '0.10–0.30/look', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Look quality on diverse skin tones'],
      gate: 'Inclusive testing Fitzpatrick I–VI',
      scores: { value: 8, effort: 4, fit: 9 },
    },
    {
      id: 'nail_vto',
      name: 'AI Nail Virtual Try-On',
      nameAr: 'تجربة طلاء الأظافر',
      category: 'beauty',
      icon: '💅',
      perfectPath: '/ai-api/products/nail-virtual-try-on',
      summary: 'Virtual nail color/texture on hand photo — Wave 4 في Phase 2 roadmap.',
      perfectOffers: ['Unlimited colors · textures', 'Hand tracking'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Wave 4',
      when: 'بعد Gate W3 · مع accessories',
      why: ['Completes «full beauty» platform', 'Nail SKU marketplace'],
      whyNot: ['Not hero feature', 'Hand capture UX different from face'],
      how: {
        pattern: 'S2S hand photo',
        server: ['NailTryOnProvider'],
        flutter: ['Hand capture guide · Wave 4 screen'],
        steps: ['Reuse Perfect API pattern from docs playground'],
      },
      cost: { model: 'credits', usd: '0.08–0.25', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Hand detection failures'],
      gate: 'Wave 4 gate',
      scores: { value: 6, effort: 5, fit: 7 },
    },
    {
      id: 'contact_lens_vto',
      name: 'AI Contact Lens Virtual Try-On',
      nameAr: 'تجربة عدسات لاصقة',
      category: 'beauty',
      icon: '👁',
      perfectPath: '/ai-api/products/contact-lens-virtual-try-on',
      summary: 'Try colored contact lenses on live/photo face — Wave 3 Phase 2.',
      perfectOffers: ['Multiple lens colors', 'Mobile UI demo'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Wave 3',
      when: 'With glasses/contacts wave',
      why: ['GCC market loves colored lenses', 'Pairs with eye makeup looks'],
      whyNot: ['Medical device regulations in some markets'],
      how: {
        pattern: 'SDK/API eye region',
        server: ['LensTryOnProvider'],
        flutter: ['Eye category in AR hub'],
        steps: ['Partner with licensed lens brands only'],
      },
      cost: { model: 'credits', usd: '0.08–0.20', note: '' },
      overlap: { fashn: '—', mediapipe: 'eye landmarks' },
      risks: ['Regulatory labeling'],
      gate: 'Wave 3 · partner compliance',
      scores: { value: 6, effort: 5, fit: 7 },
    },
    {
      id: 'teeth_whitening',
      name: 'AI Teeth Whitening',
      nameAr: 'تبييض الأسنان في الصورة',
      category: 'beauty',
      icon: '🦷',
      perfectPath: '/ai-api/products/teeth-whitening',
      summary: 'Before/after teeth whitening preview — niche beauty vertical.',
      perfectOffers: ['Slider before/after', 'Natural whitening'],
      miraStatus: 'p3',
      miraPhase: 'Optional',
      when: 'Low priority',
      why: ['Smile polish for photos'],
      whyNot: ['Far from core', 'Dental claims sensitivity'],
      how: { pattern: 'S2S', server: ['Optional'], flutter: ['—'], steps: [] },
      cost: { model: 'credits', usd: '0.05–0.15', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Dental health claims'],
      gate: '—',
      scores: { value: 3, effort: 2, fit: 4 },
    },

    /* ─── FASHION ─── */
    {
      id: 'clothes_vto',
      name: 'AI Clothes Virtual Try-On',
      nameAr: 'تجربة الملابس (V3.0)',
      category: 'fashion',
      icon: '👗',
      perfectPath: '/ai-api/products/clothes-virtual-try-on',
      summary:
        'Photo-based garment try-on: src person + ref garment → dressed result. **Competes with FASHN** — ميرا today use FASHN+OpenAI for analyze not try-on.',
      perfectOffers: [
        'V3.0 API · garment_category: auto',
        'src_file_url + ref_file_url',
        'Playground · 2 free trials',
        'Categories: tops · bottoms · full body',
      ],
      miraStatus: 'evaluate',
      miraPhase: 'Phase 2 · Outfit Try',
      when: 'When adding «try this dress» beyond analyze',
      why: [
        'Single vendor stack possible (Perfect skin + clothes)',
        'Playground proves quality before FASHN try-on contract',
        'E-commerce partners expect visual try-on',
      ],
      whyNot: [
        'FASHN already integrated for segmentation/geometry',
        'Vision Platform architecture separates analyze (FASHN) vs narrative (OpenAI)',
        'Perfect clothes = photo async · not live · different UX',
        'Adding second fashion vendor = complexity',
      ],
      how: {
        pattern: 'S2S V3: { src_file_url, ref_file_url, garment_category: "auto" }',
        endpoints: ['POST clothes V3 task (yce.perfectcorp.com playground)'],
        server: [
          'Alternative: PerfectClothesProvider vs fashn-geometry.provider.ts',
          'POST /api/v1/ai/vision/outfit/try-on (new)',
        ],
        flutter: ['OutfitTryOnScreen · after outfit analyze'],
        steps: [
          '1. User has outfit analyze result',
          '2. Pick garment from marketplace ref image',
          '3. Perfect or FASHN try-on job',
          '4. A/B quality · cost · latency',
          '5. Single winner in render.yaml',
        ],
      },
      cost: { model: 'credits', usd: '0.30–1.00/run', note: 'Compare FASHN pricing' },
      overlap: { fashn: '⚠️ Overlap — evaluate both', mediapipe: '—' },
      risks: ['Two fashion vendors', 'Garment drape quality on abaya/modest wear'],
      gate: 'Modest fashion QA · POC 50 garments',
      scores: { value: 8, effort: 7, fit: 7 },
    },
    {
      id: 'bag_vto',
      name: 'AI Bag Virtual Try-On',
      nameAr: 'تجربة الحقائب',
      category: 'fashion',
      icon: '👜',
      perfectPath: '/ai-api/products/bag-virtual-try-on',
      summary: 'Overlay bag on person photo — accessory upsell after outfit analyze.',
      perfectOffers: ['Position · scale · lighting match'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Wave 4 accessories',
      when: 'With jewelry/accessories wave',
      why: ['Marketplace accessory category', 'Completes outfit recommendation'],
      whyNot: ['Requires full outfit try-on first'],
      how: {
        pattern: 'S2S similar clothes',
        server: ['AccessoryTryOnOrchestrator'],
        flutter: ['Accessory carousel on result screen'],
        steps: ['Partner SKU images as ref_file_url'],
      },
      cost: { model: 'credits', usd: '0.15–0.40', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Scale realism'],
      gate: 'Wave 4',
      scores: { value: 6, effort: 4, fit: 7 },
    },
    {
      id: 'hat_vto',
      name: 'AI Hat Virtual Try-On',
      nameAr: 'تجربة القبعات / الشماغ / الحجاب fashion',
      category: 'fashion',
      icon: '🧕',
      perfectPath: '/ai-api/products/hat-virtual-try-on',
      summary: 'Hat/headwear try-on — relevant for GCC (shmagh · hijab fashion · caps).',
      perfectOffers: ['Headwear positioning', 'Multiple styles'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Wave 3–4',
      when: 'After glasses wave',
      why: ['Local market: hijab · shmagh styling with outfit analyze', 'Differentiator for Arabic fashion'],
      whyNot: ['Niche vs core makeup hero'],
      how: {
        pattern: 'S2S headwear',
        server: ['HatTryOnProvider'],
        flutter: ['Modest fashion section'],
        steps: ['Curate regional headwear catalog'],
      },
      cost: { model: 'credits', usd: '0.12–0.35', note: '' },
      overlap: { fashn: '—', mediapipe: 'head pose' },
      risks: ['Cultural sensitivity in styling defaults'],
      gate: 'Local fashion advisor review',
      scores: { value: 7, effort: 4, fit: 8 },
    },
    {
      id: 'scarf_vto',
      name: 'AI Scarf Virtual Try-On',
      nameAr: 'تجربة الأوشحة',
      category: 'fashion',
      icon: '🧣',
      perfectPath: '/ai-api/products/scarf-virtual-try-on',
      summary: 'Scarf overlay — pairs with color palette analysis.',
      perfectOffers: ['Fabric drape simulation'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Wave 4',
      when: 'With accessories',
      why: ['Links Color Tones → «this scarf matches your palette»'],
      whyNot: ['Lower demand than hijab/hat'],
      how: { pattern: 'S2S', server: ['ScarfTryOnProvider'], flutter: ['Scarf shop integration'], steps: [] },
      cost: { model: 'credits', usd: '0.12–0.35', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['—'],
      gate: 'Wave 4',
      scores: { value: 5, effort: 4, fit: 7 },
    },
    {
      id: 'shoes_vto',
      name: 'AI Shoes Virtual Try-On',
      nameAr: 'تجربة الأحذية',
      category: 'fashion',
      icon: '👠',
      perfectPath: '/ai-api/products/shoes-virtual-try-on',
      summary: 'Shoe try-on on foot/leg photo — completes outfit from head to toe.',
      perfectOffers: ['Foot detection · shoe placement'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Wave 4',
      when: 'Full outfit commerce loop',
      why: ['E-commerce completion', 'Partner shoe brands'],
      whyNot: ['Foot capture friction', 'Harder than face AR'],
      how: { pattern: 'S2S foot photo', server: ['ShoesTryOnProvider'], flutter: ['Foot capture guide'], steps: [] },
      cost: { model: 'credits', usd: '0.15–0.45', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Pose requirements'],
      gate: 'Wave 4',
      scores: { value: 5, effort: 5, fit: 6 },
    },

    /* ─── JEWELRY · WATCH ─── */
    {
      id: 'watch_vto',
      name: 'AI Watch Virtual Try-On',
      nameAr: 'تجربة الساعات على المعصم',
      category: 'jewelry_watch',
      icon: '⌚',
      perfectPath: '/ai-api/products/watch-virtual-try-on',
      summary:
        'Realistic watch on wrist · accurate scale · lighting integration — luxury/fashion expansion (screenshots user provided).',
      perfectOffers: [
        'Watch scale relative to wrist',
        'Lighting integration with wrist photo',
        'Smart · analog · luxury styles',
        'Built for ecommerce brands',
      ],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Luxury vertical',
      when: 'Post core beauty · partner with watch retailers',
      why: [
        'High AOV marketplace category',
        'GCC luxury watch market',
        'Unique luxury/fashion module على Perfect',
        'API-first · clear playground (user screenshot)',
      ],
      whyNot: ['Not core for launch', 'Needs wrist capture UX'],
      how: {
        pattern: 'S2S wrist photo + watch ref',
        endpoints: ['watch VTO task · Get API Key from console'],
        server: ['WatchTryOnService', 'POST /api/v1/ai/watch-try-on'],
        flutter: ['WristCaptureScreen · catalog from partners'],
        steps: [
          '1. Wrist photo with guide overlay',
          '2. Select watch from partner catalog',
          '3. Perfect render → share / buy',
        ],
      },
      cost: { model: 'credits', usd: '0.20–0.50', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Partner image assets quality'],
      gate: 'Luxury partner pilot · 3 brands',
      scores: { value: 7, effort: 5, fit: 7 },
    },

    /* ─── HAIR ─── */
    {
      id: 'hair_color_vto',
      name: 'AI Hair Color Virtual Try-On',
      nameAr: 'تجربة صبغة الشعر',
      category: 'hair',
      icon: '💇',
      perfectPath: '/ai-api/products/hair-color-virtual-try-on',
      summary: 'Virtual hair color on photo/live — Phase 2 Wave 3 (hair · glasses · contacts).',
      perfectOffers: ['Unlimited colors', 'Hair mask segmentation'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Wave 3',
      when: 'Gate after makeup + filters',
      why: ['Completes beauty transformation', 'Salon/product partners'],
      whyNot: ['Hijab coverage limits audience for some styles'],
      how: {
        pattern: 'SDK/API hair mask',
        server: ['HairTryOnProvider · perfect-corp-hair.service.ts'],
        flutter: ['Wave 3 Hair hub'],
        steps: ['Playground POC · Perfect Hair Color API'],
      },
      cost: { model: 'credits', usd: '0.15–0.40', note: '' },
      overlap: { fashn: '—', mediapipe: 'hair region optional' },
      risks: ['Hijab — offer «visible hair only» mode respectfully'],
      gate: 'Wave 3 gate',
      scores: { value: 7, effort: 6, fit: 7 },
    },
    {
      id: 'hair_style_vto',
      name: 'AI Hair Style Virtual Try-On',
      nameAr: 'تجربة قصّات الشعر',
      category: 'hair',
      icon: '✂️',
      perfectPath: '/ai-api/products/hairstyle-virtual-try-on',
      summary: 'Try different hairstyles on face photo — salon booking use case.',
      perfectOffers: ['Style catalog', 'Length · volume simulation'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Wave 3',
      when: 'With hair color wave',
      why: ['Salon marketplace vertical', 'High engagement'],
      whyNot: ['Complex hair physics', 'Cultural modesty defaults'],
      how: { pattern: 'S2S/API', server: ['HairStyleProvider'], flutter: ['Style gallery'], steps: [] },
      cost: { model: 'credits', usd: '0.20–0.55', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Quality on curly/textured hair — inclusive QA'],
      gate: 'Wave 3',
      scores: { value: 6, effort: 6, fit: 6 },
    },
    {
      id: 'beard_vto',
      name: 'AI Beard / Facial Hair Try-On',
      nameAr: 'تجربة اللحية / الشعر الذقني',
      category: 'hair',
      icon: '🧔',
      perfectPath: '/ai-api/products/beard-virtual-try-on',
      summary: 'Beard styles for men — optional Mira Men line or skip.',
      perfectOffers: ['Beard styles · colors'],
      miraStatus: 'p3',
      miraPhase: 'Future · optional',
      when: 'Only if Mira expands to men\'s grooming',
      why: ['Market expansion'],
      whyNot: ['Current brand = women-focused Arabic beauty'],
      how: { pattern: 'S2S', server: ['—'], flutter: ['—'], steps: [] },
      cost: { model: 'credits', usd: '0.10–0.30', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Brand focus dilution'],
      gate: 'Strategy decision men\'s line',
      scores: { value: 3, effort: 4, fit: 3 },
    },

    /* ─── IMAGE · VIDEO ─── */
    {
      id: 'image_enhance',
      name: 'AI Image Enhancement',
      nameAr: 'تحسين الصور بالذكاء الاصطناعي',
      category: 'image_video',
      icon: '🖼',
      perfectPath: '/ai-api/products/image-enhancement',
      summary: 'General photo enhancement — background · quality · retouch.',
      perfectOffers: ['Auto enhance', 'Background tools'],
      miraStatus: 'p3',
      miraPhase: 'Utility',
      when: 'Low priority — youcam-image-variants.ts covers pre-processing',
      why: ['Pre-process before skin API'],
      whyNot: ['Already have internal variants builder', 'Not user-facing feature'],
      how: { pattern: 'Internal only', server: ['youcam-image-variants.ts ✅'], flutter: ['—'], steps: [] },
      cost: { model: '—', usd: '—', note: 'Internal preprocessing' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['—'],
      gate: 'Already partial via variants',
      scores: { value: 4, effort: 2, fit: 5 },
    },
    {
      id: 'video_ar',
      name: 'AI Video / Live AR Filters',
      nameAr: 'فلاتر فيديو / AR حية',
      category: 'image_video',
      icon: '🎬',
      perfectPath: '/ai-api/products/video-effects',
      summary: 'Video effects and filters — Phase 2 Wave 2 (filters preview mode).',
      perfectOffers: ['Video processing', 'Filter preview'],
      miraStatus: 'p2',
      miraPhase: 'Phase 2 · Wave 2',
      when: 'After makeup Wave 1 gate',
      why: ['Social sharing · WOW moments', 'Phase 2 AR rollout W2'],
      whyNot: ['Video = higher compute cost · credits'],
      how: {
        pattern: 'Perfect Video/Filter API',
        server: ['PerfectVideoFilterProvider'],
        flutter: ['Filter preview mode · Wave 2'],
        steps: ['Playground POC · Perfect filter API'],
      },
      cost: { model: 'credits', usd: '0.10–0.40/video', note: '' },
      overlap: { fashn: '—', mediapipe: '—' },
      risks: ['Performance on mid Android'],
      gate: 'Wave 2 gate',
      scores: { value: 6, effort: 7, fit: 7 },
    },
  ];

  const STRATEGY = {
    headline: 'Perfect Corp = المنصة الوحيدة لتوسيع ميرا — Skin · Makeup · Fashion · Watch · Hair',
    policy:
      'هذه الوثيقة **Perfect فقط**. التوسع = خدمات YouCam API · credits · provider واحد. لا third-party AR SDK في الخطة الحالية.',
    rules: [
      'Perfect Corp: تحليل · try-on · makeup · fashion · watch — **كل شيء عبر Render S2S**',
      'MediaPipe: quality gate + live face mesh على الجهاز (مجاني) — capture فقط · ليس makeup render',
      'FASHN + OpenAI: تحليل إطلالة + MCE narrative — حتى تقييم Perfect Clothes V3',
      'MIRA Engine: orchestrator — أي خدمة Perfect جديدة = provider interface على Render',
      'Flutter: **لا PERFECT_API_KEY** — كل calls عبر mira-api',
    ],
    waves: [
      {
        wave: 'Wave 0 · الآن',
        focus: 'Skin Analysis ✅ + Color Tones + Fitzpatrick',
        perfect: ['skin_analysis', 'facial_color_tones', 'fitzpatrick'],
      },
      {
        wave: 'Wave 1 · Q4 2026',
        focus: '💄 Makeup Hero — Perfect فقط',
        perfect: ['makeup_vto', 'makeup_transfer', 'look_vto', 'skin_simulation'],
      },
      {
        wave: 'Wave 2 · Q1 2027',
        focus: '✨ Filters · 💇 Hair · 👁 Contacts',
        perfect: ['video_ar', 'hair_color_vto', 'hair_style_vto', 'contact_lens_vto'],
      },
      {
        wave: 'Wave 3 · Q2 2027',
        focus: '👗 Fashion · ⌚ Watch · 👜 Accessories',
        perfect: ['clothes_vto', 'watch_vto', 'bag_vto', 'hat_vto', 'nail_vto', 'shoes_vto'],
      },
    ],
    recommendation:
      '**Perfect-first:** Playground كل خدمة → Render provider → Flutter feature module. Makeup VTO = Hero Wave 1. Credits تتصاعد مع الاستخدام — لا عقد MAU سنوي مقدماً.',
  };

  const ROADMAP = [
    {
      phase: 'Q3 2026 · الآن',
      items: [
        '✅ Skin Analysis (live على Render)',
        '🔬 Facial Color Tones (P0)',
        '☀️ Fitzpatrick enrich',
        '💄 Makeup VTO — Playground POC (lip + foundation)',
      ],
    },
    {
      phase: 'Q4 2026 · Wave 1',
      items: [
        '💄 Makeup VTO live (Perfect · 13 categories تدريجياً)',
        '✨ Makeup Transfer',
        '👑 Look VTO curated',
        '📈 Skin Simulation beta',
      ],
    },
    {
      phase: 'Q1 2027 · Wave 2–3',
      items: [
        '✨ Video filters (Perfect)',
        '💇 Hair color/style',
        '👁 Contact lenses',
        '👗 Clothes try-on (Perfect V3 · evaluate vs FASHN analyze)',
      ],
    },
    {
      phase: 'Q2 2027 · Wave 4',
      items: [
        '⌚ Watch VTO · 👜 Bag · 🧕 Hat',
        '💅 Nails · 👠 Shoes · 🧣 Scarf',
      ],
    },
  ];

  const INTEGRATION_PATTERN = {
    title: 'نموذج الدمج الموحّد في mira-api',
    layers: [
      {
        name: '1. Provider Interface',
        code: `// mira-api/src/ai/providers/{feature}.provider.ts
export interface XxxProvider {
  run(input: Buffer | XxxInput): Promise<XxxResult>;
}`,
      },
      {
        name: '2. Perfect Corp Adapter',
        code: `// mira-api/src/ai/services/perfect-corp-{feature}.service.ts
// - upload file → task → poll (S2S v2.0)
// - NEVER expose PERFECT_API_KEY to Flutter
// - zero buffer after processing`,
      },
      {
        name: '3. Gateway Controller',
        code: `// POST /api/v1/ai/{feature}
// Auth: Firebase Bearer
// Multipart or JSON per Perfect docs`,
      },
      {
        name: '4. MIRA Intelligence Merge',
        code: `// intelligence.service.ts → BeautyReport
// Merge Perfect raw + MCE + undertone + marketplace`,
      },
      {
        name: '5. Flutter Feature Module',
        code: `// lib/features/{feature}/
// datasources → MiraApiConfig only
// UI + Arabic error messages (mira_api_error_message.dart)`,
      },
    ],
    envVars: [
      'PERFECT_API_KEY / PERFECT_CORP_API_KEY',
      'PERFECT_BASE_URL (default: yce-api-01.makeupar.com/s2s/v2.0)',
      'PERFECT_CORP_DST_ACTIONS (skin only today)',
      'PERFECT_CORP_FALLBACK_MOCK=false (production)',
      'SKIN_PROVIDER=perfect_corp',
    ],
  };

  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function fmt(usd) {
    if (typeof usd !== 'number') return usd;
    return '$' + usd.toLocaleString('en-US');
  }

  function statusBadge(status) {
    const s = STATUS_LABELS[status] || { label: status, cls: 'p3' };
    return `<span class="perfect-badge ${s.cls}">${s.label}</span>`;
  }

  function catLabel(id) {
    const c = CATEGORIES.find((x) => x.id === id);
    return c ? `${c.icon} ${c.label}` : id;
  }

  function borderClass(status) {
    if (status === 'live') return 'live-border';
    if (status === 'p0' || status === 'p1') return 'p0-border';
    if (status === 'exclude') return 'skip-border';
    return '';
  }

  function renderServiceCard(svc) {
    const whyList = svc.why.map((w) => `<li>${w}</li>`).join('') || '<li>—</li>';
    const whyNotList =
      svc.whyNot.length > 0
        ? `<h4>لماذا لا (أو لاحقاً)</h4><ul>${svc.whyNot.map((w) => `<li>${w}</li>`).join('')}</ul>`
        : '';
    const steps =
      svc.how.steps && svc.how.steps.length
        ? `<ol>${svc.how.steps.map((st) => `<li>${st}</li>`).join('')}</ol>`
        : '<p class="muted-inline">—</p>';
    const serverList = (svc.how.server || [])
      .map((x) => `<li><code>${x}</code></li>`)
      .join('');
    const flutterList = (svc.how.flutter || [])
      .map((x) => `<li><code>${x}</code></li>`)
      .join('');
    const endpoints =
      svc.how.endpoints && svc.how.endpoints.length
        ? `<div class="integration-code">${svc.how.endpoints.join('\n')}</div>`
        : '';

    return `
      <article class="service-card ${borderClass(svc.miraStatus)}" id="svc-${svc.id}" data-category="${svc.category}" data-status="${svc.miraStatus}">
        <div class="service-header">
          <h3>${svc.icon} ${svc.nameAr} <span class="muted-inline">· ${svc.name}</span></h3>
          <div>${statusBadge(svc.miraStatus)}</div>
        </div>
        <div class="service-meta">
          <span class="phase-badge p1">${catLabel(svc.category)}</span>
          <span class="phase-badge cost">${svc.miraPhase}</span>
          <span class="muted-inline">Value ${svc.scores.value}/10 · Effort ${svc.scores.effort}/10 · Fit ${svc.scores.fit}/10</span>
        </div>
        <p>${svc.summary}</p>
        <p><strong>متى:</strong> ${svc.when}</p>

        <div class="service-grid">
          <div class="service-block">
            <h4>ماذا تقدّم Perfect Corp</h4>
            <ul>${svc.perfectOffers.map((o) => `<li>${o}</li>`).join('')}</ul>
          </div>
          <div class="service-block">
            <h4>لماذا ميرا تحتاجها</h4>
            <ul>${whyList}</ul>
            ${whyNotList}
          </div>
          <div class="service-block">
            <h4>التكلفة (تقدير)</h4>
            <p><strong>${svc.cost.model}</strong> · ${svc.cost.usd}</p>
            <p class="muted-inline">${svc.cost.note || ''}</p>
          </div>
          <div class="service-block">
            <h4>تداخل · مخاطر</h4>
            <p>FASHN: ${svc.overlap.fashn}<br>MediaPipe: ${svc.overlap.mediapipe}</p>
            <ul>${svc.risks.map((r) => `<li>⚠ ${r}</li>`).join('')}</ul>
            <p><strong>Gate:</strong> ${svc.gate}</p>
          </div>
        </div>

        <h4 style="margin-top:18px;">كيف نضيفها في ميرا</h4>
        <p><strong>Pattern:</strong> ${svc.how.pattern || '—'}</p>
        ${endpoints}
        <div class="service-grid">
          <div class="service-block">
            <h4>Server (mira-api)</h4>
            <ul>${serverList || '<li>TBD</li>'}</ul>
          </div>
          <div class="service-block">
            <h4>Flutter</h4>
            <ul>${flutterList || '<li>TBD</li>'}</ul>
          </div>
        </div>
        <div class="service-block" style="margin-top:12px;">
          <h4>خطوات التنفيذ</h4>
          ${steps}
        </div>
        <p class="muted-inline" style="margin-top:10px;">
          Perfect: <a href="${SPEC.perfectConsole}${svc.perfectPath}" target="_blank" rel="noopener">${svc.perfectPath}</a>
        </p>
      </article>`;
  }

  function renderVerdict(root) {
    const live = SERVICES.filter((s) => s.miraStatus === 'live').length;
    const p0p1 = SERVICES.filter((s) => ['p0', 'p1', 'evaluate'].includes(s.miraStatus)).length;
    const exclude = SERVICES.filter((s) => s.miraStatus === 'exclude').length;

    const s = el('section', { id: 'verdict' });
    s.innerHTML = `
      <div class="hero-perfect">
        <span class="badge">PERFECT CORP · YOUCAM API · STRATEGY · ${SPEC.version}</span>
        <h1>خدمات بيرفكت<br /><span style="font-size:0.85em;color:var(--muted)">دراسة استراتيجية لكل API — متى · لماذا · كيف في ميرا</span></h1>
        <p class="lead">
          <strong>Perfect Corp / YouCam فقط.</strong> هذه الوثيقة تحلّل <strong>${SERVICES.length} خدمة</strong>:
          ما نفعّله الآن · ما نوسّعه · ما نرفضه · وكيف يمر عبر Render — credits · provider واحد · بدون SDK خارجي.
        </p>
        <div class="stats-row">
          <div class="stat-box"><div class="num">${live}</div><div class="lbl">Live الآن</div></div>
          <div class="stat-box"><div class="num">${p0p1}</div><div class="lbl">P0/P1/تقييم</div></div>
          <div class="stat-box"><div class="num">${exclude}</div><div class="lbl">خارج العلامة</div></div>
          <div class="stat-box"><div class="num">${CATEGORIES.length}</div><div class="lbl">فئات</div></div>
        </div>
      </div>

      <div class="card ok" style="margin-top:24px;border:2px solid var(--ok);">
        <h3 style="margin-top:0;">✅ الحكم التنفيذي</h3>
        <p><strong>Perfect Corp today:</strong> Skin Analysis S2S v2.0 على Render — production.</p>
        <p><strong>Next P0:</strong> Facial Color Tones + Fitzpatrick + **Makeup VTO Playground POC**.</p>
        <p><strong>Wave 1 Hero:</strong> Perfect Makeup (13 فئة) + Transfer + Look — توسيع التطبيق من نفس المنصة.</p>
        <p style="margin-bottom:0;"><strong>Hard exclude:</strong> Face/body surgery simulators — لا تتماشى مع علامة ميرا.</p>
      </div>

      <div class="disclaimer-box" style="margin-top:16px;">
        ⚠️ مرجع engineering داخلي · ${SPEC.date} · Console:
        <a href="${SPEC.perfectConsole}" target="_blank" rel="noopener">yce.perfectcorp.com</a> ·
        S2S: <code>${SPEC.s2sBase}</code>
      </div>
    `;
    root.appendChild(s);
  }

  function renderMatrix(root) {
    const rows = SERVICES.sort((a, b) => b.scores.value - a.scores.value)
      .map(
        (s) => `<tr class="${s.miraStatus === 'exclude' ? 'muted-row' : ''}">
          <td>${s.icon} ${s.nameAr}</td>
          <td>${statusBadge(s.miraStatus)}</td>
          <td>${s.when.substring(0, 40)}${s.when.length > 40 ? '…' : ''}</td>
          <td>${s.scores.value}<span class="score-bar" style="width:${s.scores.value * 8}px"></span></td>
          <td>${s.scores.effort}</td>
          <td>${s.scores.fit}</td>
          <td><a href="#svc-${s.id}">تفاصيل</a></td>
        </tr>`
      )
      .join('');

    const s = el('section', { id: 'matrix' });
    s.innerHTML = `
      <h2>مصفوفة القرار — كل الخدمات</h2>
      <p>مرتبة حسب Value · انقر «تفاصيل» للتحليل الكامل.</p>
      <table class="task-table matrix-table">
        <thead>
          <tr>
            <th>الخدمة</th>
            <th>الحالة</th>
            <th>متى</th>
            <th>Value</th>
            <th>Effort</th>
            <th>Fit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    root.appendChild(s);
  }

  function renderStrategy(root) {
    const waveCards = STRATEGY.waves
      .map(
        (w) => `
      <div class="roadmap-phase card">
        <h4>${w.wave}</h4>
        <p><strong>${w.focus}</strong></p>
        <ul>${w.perfect.map((id) => {
          const svc = SERVICES.find((s) => s.id === id);
          return svc ? `<li>${svc.icon} ${svc.nameAr}</li>` : `<li>${id}</li>`;
        }).join('')}</ul>
      </div>`
      )
      .join('');

    const s = el('section', { id: 'strategy' });
    s.innerHTML = `
      <h2>استراتيجية Perfect — توسيع ميرا من منصة واحدة</h2>
      <p>${STRATEGY.headline}</p>
      <div class="card ok" style="margin:16px 0;border:2px solid var(--ok);">
        <p style="margin:0;">${STRATEGY.policy}</p>
      </div>
      <ul>${STRATEGY.rules.map((r) => `<li>${r}</li>`).join('')}</ul>

      <h3 style="margin-top:28px;">موجات Perfect — ماذا نفعّل ومتى</h3>
      <div class="roadmap-lane">${waveCards}</div>

      <div class="card" style="margin-top:20px;">
        <p style="margin:0;"><strong>التوصية:</strong> ${STRATEGY.recommendation}</p>
      </div>

      <h3 style="margin-top:28px;">👗 Fashion — Perfect Clothes vs FASHN (تحليل فقط اليوم)</h3>
      <table class="task-table">
        <thead><tr><th></th><th>Perfect Clothes V3</th><th>FASHN (current)</th></tr></thead>
        <tbody>
          <tr><td>الاستخدام اليوم في ميرا</td><td>🔜 try-on</td><td>✅ Analyze + geometry + recolor</td></tr>
          <tr><td>Try-on dressed result</td><td>✅ src + ref garment photo</td><td>Analyze path live</td></tr>
          <tr><td>Integration</td><td>Perfect credits · S2S</td><td>Vision Platform · render.yaml</td></tr>
          <tr><td>قرار</td><td colspan="2">Perfect Clothes POC · modest/abaya QA · ثم دمج أو استبدال تدريجي</td></tr>
        </tbody>
      </table>

      <div class="flow-loop" style="margin-top:24px;">
Analyze (Perfect Skin + Color)
    ↓
Explain (OpenAI MCE)
    ↓
Recommend (MIRA Engine + Marketplace)
    ↓
Try (Perfect Makeup · Fashion · Watch · Hair)    ← كلها Perfect
    ↓
Buy (Marketplace)
      </div>
    `;
    root.appendChild(s);
  }

  function renderRoadmap(root) {
    const lanes = ROADMAP.map(
      (r) => `
      <div class="roadmap-phase">
        <h4>${r.phase}</h4>
        <ul>${r.items.map((i) => `<li>${i}</li>`).join('')}</ul>
      </div>`
    ).join('');

    const s = el('section', { id: 'roadmap' });
    s.innerHTML = `
      <h2>خارطة الزمن — متى نفعّل ماذا</h2>
      <div class="roadmap-lane">${lanes}</div>
    `;
    root.appendChild(s);
  }

  function renderCatalog(root) {
    const s = el('section', { id: 'catalog' });
    const categoryOptions = CATEGORIES.map(
      (c) => `<option value="${c.id}">${c.icon} ${c.label}</option>`
    ).join('');

    const statusOptions = Object.entries(STATUS_LABELS)
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
      .join('');

    s.innerHTML = `
      <h2>دليل الخدمات — تحليل كل API</h2>

      <div class="filter-bar">
        <input type="search" id="svcSearch" placeholder="ابحثي: مكياج · ساعة · بشرة…" />
        <select id="svcCategory">
          <option value="">كل الفئات</option>
          ${categoryOptions}
        </select>
        <select id="svcStatus">
          <option value="">كل الحالات</option>
          ${statusOptions}
        </select>
        <span id="svcCount" class="muted-inline"></span>
      </div>

      <div id="serviceList">
        ${CATEGORIES.map((cat) => {
          const items = SERVICES.filter((x) => x.category === cat.id);
          return `
            <h3 style="margin-top:32px;color:${cat.color}">${cat.icon} ${cat.label} (${items.length})</h3>
            ${items.map((svc) => renderServiceCard(svc)).join('')}
          `;
        }).join('')}
      </div>
    `;
    root.appendChild(s);
    initFilters();
  }

  function renderIntegration(root) {
    const layers = INTEGRATION_PATTERN.layers
      .map(
        (l) => `
      <div class="service-block" style="margin-bottom:14px;">
        <h4>${l.name}</h4>
        <div class="integration-code">${l.code}</div>
      </div>`
      )
      .join('');

    const s = el('section', { id: 'integration' });
    s.innerHTML = `
      <h2>${INTEGRATION_PATTERN.title}</h2>
      <p>كل خدمة Perfect جديدة تتبع نفس المسار — **keys على Render فقط**.</p>
      ${layers}
      <h3>Environment Variables (Render)</h3>
      <ul>${INTEGRATION_PATTERN.envVars.map((v) => `<li><code>${v}</code></li>`).join('')}</ul>
      <div class="flow-loop" style="margin-top:20px;">
Flutter (no Perfect key)
    → POST /api/v1/ai/{feature} + Firebase Auth
        → mira-api Provider
            → Perfect Corp S2S (upload → task → poll)
                → MIRA Intelligence merge
                    → JSON response (no image stored)
      </div>
    `;
    root.appendChild(s);
  }

  function renderCosts(root) {
    const byPriority = {
      live: SERVICES.filter((s) => s.miraStatus === 'live'),
      next: SERVICES.filter((s) => ['p0', 'p1'].includes(s.miraStatus)),
      evaluate: SERVICES.filter((s) => s.miraStatus === 'evaluate'),
    };

    const s = el('section', { id: 'costs' });
    s.innerHTML = `
      <h2>نموذج التكلفة — Perfect Credits فقط</h2>
      <table class="task-table">
        <thead>
          <tr><th>النموذج</th><th>الخدمات</th><th>متى</th><th>مثال</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Credits / per scan</strong></td>
            <td>Skin · Color · Fitzpatrick</td>
            <td>Phase 1 · live</td>
            <td>~$0.12–0.40/scan</td>
          </tr>
          <tr>
            <td><strong>Credits / per session</strong></td>
            <td>Makeup VTO · Look · Transfer</td>
            <td>Wave 1 · Q4 2026</td>
            <td>~$0.05–0.50/session</td>
          </tr>
          <tr>
            <td><strong>Credits / per try-on</strong></td>
            <td>Clothes · Watch · Bag · Hair</td>
            <td>Wave 2–4</td>
            <td>~$0.15–1.00/run</td>
          </tr>
          <tr>
            <td><strong>مجاني on-device</strong></td>
            <td>MediaPipe capture gate</td>
            <td>Always</td>
            <td>$0</td>
          </tr>
        </tbody>
      </table>

      <h3 style="margin-top:24px;">تقدير شهري — Perfect فقط (500 MAU نشط)</h3>
      <table class="task-table">
        <thead><tr><th>الخدمة (Perfect)</th><th>Runs/شهر</th><th>USD/شهر (range)</th></tr></thead>
        <tbody>
          <tr><td>Skin Analysis ✅</td><td>~600</td><td>$72 – $240</td></tr>
          <tr><td>Facial Color Tones (P0)</td><td>~400</td><td>$40 – $140</td></tr>
          <tr><td>Makeup VTO (P0 Hero)</td><td>~800</td><td>$40 – $200</td></tr>
          <tr><td>Makeup Transfer (P1)</td><td>~150</td><td>$30 – $75</td></tr>
          <tr><td>Look VTO (P1)</td><td>~200</td><td>$20 – $60</td></tr>
          <tr style="font-weight:800;background:#fdf5f9">
            <td>مجموع Perfect (تقدير)</td>
            <td>—</td>
            <td>~$200 – $715/شهر</td>
          </tr>
        </tbody>
      </table>
      <p class="muted-inline">Credits من Dashboard · <a href="${SPEC.perfectConsole}" target="_blank" rel="noopener">yce.perfectcorp.com</a> · Playground free trials قبل كل integration.</p>

      <div class="card" style="margin-top:20px;">
        <h4 style="margin-top:0;">Playground قبل العقد</h4>
        <p style="margin:0;">كل خدمة في YouCam Console فيها <strong>Playground</strong> + free trials (مثل Clothes V3: 2 trials).
        استخدميها لـ POC قبل Render integration — Screenshots المرسلة تؤكد: API Dashboard · credits · curl/Node/Python snippets.</p>
      </div>
    `;
    root.appendChild(s);
  }

  function initFilters() {
    const search = document.getElementById('svcSearch');
    const cat = document.getElementById('svcCategory');
    const status = document.getElementById('svcStatus');
    const count = document.getElementById('svcCount');
    const cards = document.querySelectorAll('.service-card');

    function apply() {
      const q = (search.value || '').trim().toLowerCase();
      const c = cat.value;
      const st = status.value;
      let visible = 0;
      cards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        const matchQ = !q || text.includes(q);
        const matchC = !c || card.dataset.category === c;
        const matchS = !st || card.dataset.status === st;
        const show = matchQ && matchC && matchS;
        card.classList.toggle('hidden-service', !show);
        if (show) visible++;
      });
      count.textContent = `${visible} / ${cards.length} خدمة`;
    }

    search.addEventListener('input', apply);
    cat.addEventListener('change', apply);
    status.addEventListener('change', apply);
    apply();
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
    renderVerdict(root);
    renderMatrix(root);
    renderStrategy(root);
    renderRoadmap(root);
    renderCatalog(root);
    renderIntegration(root);
    renderCosts(root);
    initNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
