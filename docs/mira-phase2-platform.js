/**
 * MIRA Phase 2 Platform — Official Implementation & Cost Reference
 * من «محلل بشرة وإطلالة» إلى «منصة Analyze → Recommend → Try → Buy»
 */
(function () {
  'use strict';

  const SPEC = {
    version: '1.0.0',
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

  const IMPL_PHASES = [
    {
      id: 'P2.0',
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
      title: 'P2.2 — Full Makeup Suite',
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
        <li><a href="#ar-features">7 ميزات AR بالتفصيل</a></li>
        <li><a href="#banuba-vs-visage">Banuba vs Visage</a></li>
        <li><a href="#mira-loop">Analyze → Recommend → Try → Buy</a></li>
        <li><a href="#marketplace">Marketplace · الربط التجاري</a></li>
        <li><a href="#implementation">خطة التنفيذ P2.0–P2.6</a></li>
        <li><a href="#costs">التكلفة · حاسبة تفاعلية</a></li>
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
      <div class="grid-2">
        <div class="card">
          <h4 style="margin-top:0;">✅ داخل النطاق</h4>
          <ul>
            <li>Banuba SDK integration (Flutter)</li>
            <li>7 AR features (حسب الأولوية)</li>
            <li>MIRA Try-on Orchestrator</li>
            <li>Marketplace Try → Buy flow</li>
            <li>Shade recommendation من Perfect Corp data</li>
            <li>Fusion outfit + makeup</li>
          </ul>
        </div>
        <div class="card">
          <h4 style="margin-top:0;">❌ خارج النطاق</h4>
          <ul>
            <li>بناء Face Mesh engine داخلي</li>
            <li>استبدال Perfect Corp بـ Banuba للبشرة</li>
            <li>استبدال MediaPipe للcapture</li>
            <li>Dense mesh 10K–100K</li>
            <li>Medical-grade diagnosis</li>
          </ul>
        </div>
      </div>
    `;
    root.appendChild(s);
  }

  function renderArFeatures(root) {
    const s = el('section', { id: 'ar-features' });
    let blocks = AR_FEATURES.map(
      (f) => `
      <div class="impl-phase card">
        <h3>${f.icon} ${f.title} <span class="phase-badge p2">أولوية ${f.priority}</span> · ROI: ${f.roi}</h3>
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
    s.innerHTML = `<h2>٥. ميزات AR — تفصيل تنفيذي</h2>${blocks}`;
    root.appendChild(s);
  }

  function renderBanubaVisage(root) {
    const s = el('section', { id: 'banuba-vs-visage' });
    const rows = BANUBA_VS_VISAGE.map(
      (r) => `<tr><td>${r.feature}</td><td>${r.banuba}</td><td>${r.visage}</td></tr>`
    ).join('');
    s.innerHTML = `
      <h2>٦. Banuba vs Visage</h2>
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
      <h2>٧. Analyze → Recommend → Try → Buy</h2>
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
      <h2>٨. Marketplace — شرط Phase 2</h2>
      <div class="card" style="border-right:4px solid var(--warn);">
        <p><strong>⚠️ Banuba قبل Marketplace live = wow بدون revenue.</strong></p>
        <p style="margin-bottom:0;">الترتيب: Soft Launch Phase 1 → Marketplace live → Banuba POC → expand.</p>
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
      (p) => `
      <div class="impl-phase card">
        <h3>${p.title} <span class="phase-badge cost">${p.weeks} أسابيع</span></h3>
        <p><strong>الهدف:</strong> ${p.goal}</p>
        <p><strong>Gate:</strong> ${p.gate}</p>
        <p><strong>تكلفة:</strong> ${fmt(p.cost.min)} – ${fmt(p.cost.max)}</p>
        <table class="task-table">
          <thead><tr><th>المهمة</th><th>Owner</th><th>Proof</th></tr></thead>
          <tbody>${p.tasks.map((t) => `<tr><td>${t.task}</td><td>${t.owner}</td><td><code>${t.proof}</code></td></tr>`).join('')}</tbody>
        </table>
      </div>`
    ).join('');
    s.innerHTML = `<h2>٩. خطة التنفيذ P2.0 → P2.6</h2>${phases}`;
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
      <h2>١٠. التكلفة — تقدير engineering</h2>
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
        <label for="scopeSelect">نطاق Phase 2</label>
        <select id="scopeSelect">
          <option value="poc">P2.1 POC — Lip try-on فقط</option>
          <option value="makeup">P2.1 + P2.2 — Makeup كامل</option>
          <option value="standard" selected>Standard — Makeup + Filters + Hair + Glasses</option>
          <option value="full">Full — كل الـ 7 ميزات + Fusion</option>
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
    `;
    root.appendChild(s);
    initCostCalculator(totalMin, totalMax);
  }

  function initCostCalculator(baseMin, baseMax) {
    const scopes = {
      poc: { min: 43000, max: 77000, months: 4 },
      makeup: { min: 88000, max: 145000, months: 8 },
      standard: { min: baseMin, max: baseMax, months: 12 },
      full: { min: 320000, max: 520000, months: 18 },
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
        <div>مدة تقديرية: <strong>${sc.months} شهر</strong></div>
        <div class="big">${fmt(Math.round(totalMin))} – ${fmt(Math.round(totalMax))}</div>
        <div>${sar(Math.round(totalMin))} – ${sar(Math.round(totalMax))} SAR · شامل SDK ${sc.months} شهر</div>
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
      <h2>١١. المخاطر</h2>
      <table class="task-table">
        <thead><tr><th>الخطر</th><th>الاحتمال</th><th>التخفيف</th></tr></thead>
        <tbody>
          <tr><td>Banuba pricing أعلى من التقدير</td><td class="risk-med">متوسط</td><td>POC قبل عقد سنوي · Visage كبديل</td></tr>
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
      <h2>١٢. متطلبات قبل بدء Phase 2</h2>
      <table class="task-table">
        <thead><tr><th>#</th><th>المتطلب</th><th>الحالة</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Phase 1 Soft Launch live</td><td><span class="status-pill partial">~82%</span></td></tr>
          <tr><td>2</td><td>E2E Perfect Corp production validated</td><td><span class="status-pill partial">pending</span></td></tr>
          <tr><td>3</td><td>Marketplace enabled + 10 SKUs</td><td><span class="status-pill missing">required</span></td></tr>
          <tr><td>4</td><td>Banuba trial SDK + Flutter POC</td><td><span class="status-pill missing">P2.1</span></td></tr>
          <tr><td>5</td><td>Legal: AR preview disclaimer</td><td><span class="status-pill missing">required</span></td></tr>
          <tr><td>6</td><td>Budget approved: $225K–$392K + SDK</td><td><span class="status-pill missing">stakeholder</span></td></tr>
          <tr><td>7</td><td>Partner contracts (1 beauty + 1 optical)</td><td><span class="status-pill missing">commercial</span></td></tr>
        </tbody>
      </table>
      <div class="card ok" style="margin-top:20px;">
        <h4 style="margin-top:0;">✅ قرار الدخول للسوق العالمي</h4>
        <p style="margin:0;">
          <strong>Phase 1 professional launch</strong> أولاً → ثم Phase 2 بالترتيب P2.0→P2.6.
          لا تدخلوا السوق بـ AR نصف مكتمل — ادخلوا Phase 1 مكتمل · Phase 2 كـ «MIRA Try» major release.
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
