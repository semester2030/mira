/**
 * MIRA Project Audit — interactive data & UI
 * Integration Phase · Product Hardening · يونيو 2026
 */
(function () {
  'use strict';

  const STORAGE = {
    e2e: 'mira_audit_e2e_v1',
    ai: 'mira_audit_ai_v1',
    week: 'mira_audit_week_v1',
    dead: 'mira_audit_dead_v1',
  };

  // ─── Inventory data ───────────────────────────────────────────
  const INVENTORY = {
    dartFiles: 429,
    featureModules: 17,
    riverpodProviders: 7,
    riverpodUnused: 0,
    blocs: 2,
    blocsDead: 0,
    aiProviders: 4,
    entities: 43,
    dataModels: 10,
    modelsUnused: 1,
    repositories: 6,
    dataSources: 12,
    useCases: 7,
    namedRoutes: 33,
    domainServices: 32,
    coreServices: 5,
    coreStubs: 0,
    flutterTests: 26,
    testsPass: 120,
    testsFail: 0,
    apiSpecs: 22,
    fashionPieces: 20,
    fashionTarget: 1230,
  };

  const READINESS = [
    { label: 'الهندسة البرمجية', pct: 85, note: 'قوية لكن مُجزّأة' },
    { label: 'اكتمال الميزات', pct: 70, note: 'core flows موجودة' },
    { label: 'جودة AI (مقاسة)', pct: 0, note: 'لم يُقاس بعد', unknown: true },
    { label: 'جودة المحتوى البصري', pct: 15, note: 'placeholders' },
    { label: 'Monetization', pct: 20, note: 'mock IAP' },
    { label: 'Marketplace', pct: 10, note: 'coming soon' },
    { label: 'الاختبارات', pct: 100, note: '120/120 — E2E يدوي متبقي' },
    { label: 'الأداء', pct: 0, note: 'لم يُقاس', unknown: true },
    { label: 'الجاهزية الإجمالية', pct: 58, note: 'Product Hardening مطلوب', highlight: true },
  ];

  const E2E_FLOWS = [
    { id: 'e2e-1', step: 1, flow: 'إنشاء حساب (OTP)', status: 'ok', risk: 'Saudi phone validation', platform: 'both' },
    { id: 'e2e-2', step: 2, flow: 'تحليل البشرة', status: 'warn', risk: 'ضيف = mock AI · مسجّل = Perfect Corp', platform: 'both' },
    { id: 'e2e-3', step: 3, flow: 'حفظ التقرير', status: 'ok', risk: 'Firestore — يحتاج اختبار يدوي', platform: 'both' },
    { id: 'e2e-4', step: 4, flow: 'تحليل الإطلالة', status: 'ok', risk: 'Vision API key مطلوب', platform: 'both' },
    { id: 'e2e-5', step: 5, flow: 'اختيار المناسبة', status: 'ok', risk: 'occasion_select_screen', platform: 'both' },
    { id: 'e2e-6', step: 6, flow: 'ظهور التقرير', status: 'ok', risk: 'piece map يعتمد validation', platform: 'both' },
    { id: 'e2e-7', step: 7, flow: 'الاشتراك / Paywall', status: 'warn', risk: 'MIRA_SUBSCRIPTIONS_ENABLED=false · IAP mock', platform: 'both' },
    { id: 'e2e-8', step: 8, flow: 'إعادة التحليل', status: 'ok', risk: 'OutfitAnalysisCacheService', platform: 'both' },
    { id: 'e2e-9', step: 9, flow: 'تغيير الباقة', status: 'warn', risk: 'mock purchase فقط', platform: 'both' },
    { id: 'e2e-10', step: 10, flow: 'تسجيل الخروج', status: 'ok', risk: '—', platform: 'both' },
  ];

  const COMPLETE_FEATURES = [
    { area: 'Auth (هاتف OTP)', pct: 100, files: 'auth_repository_impl · login_screen' },
    { area: 'Onboarding + Privacy', pct: 100, files: 'onboarding_screen · privacy_consent_screen' },
    { area: 'تحليل البشرة (مسجّل + backend)', pct: 90, files: 'Perfect Corp عبر Render' },
    { area: 'تحليل الإطلالة (المسار الرئيسي)', pct: 85, files: 'OutfitIntelligenceService → Vision → segmentation' },
    { area: 'نتيجة الإطلالة UI', pct: 85, files: 'hero · piece map · luxury cards · insights' },
    { area: 'Fashion catalog pipeline', pct: 100, files: 'catalog v3 · sync · graph · ranking (هندسيًا)' },
    { area: 'Navigation', pct: 100, files: '33 route · AnalysisNavigation' },
    { area: 'Guest mode', pct: 100, files: 'GuestSessionService · guest_banner' },
    { area: 'Profile + Settings', pct: 100, files: 'edit · notifications · delete account' },
    { area: 'Dashboard', pct: 100, files: 'analysis · tips · points' },
    { area: 'Packages (منطق الرصيد)', pct: 100, files: 'PackageCreditService · Riverpod (محلي)' },
    { area: 'mira-api intelligence', pct: 95, files: '15+ engine specs' },
  ];

  const PLACEHOLDERS = [
    { item: '20 PNG fashion assets', severity: 'high', detail: '~2 KB لكل صورة · الهدف 2000×2000 · 20/1230 قطعة' },
    { item: 'Embeddings 512D', severity: 'high', detail: 'hash stub في fashion_embedding_data.dart' },
    { item: 'Multi-angle PNGs', severity: 'med', detail: '_back · _45 · _detail في catalog — 0 ملفات فعلية' },
    { item: 'Render OUTFIT_PROVIDER=mock', severity: 'high', detail: 'render.yaml سطر 27–28' },
    { item: 'PERFECT_CORP_FALLBACK_MOCK=true', severity: 'high', detail: 'fallback صامت لـ mock في الإنتاج' },
    { item: 'Flutter AiModule mocks', severity: 'med', detail: 'افتراضي محليًا · guest skin = mock' },
    { item: 'Marketplace UI', severity: 'med', detail: 'الانطلاق قريباً · MIRA_MARKETPLACE_ENABLED=false' },
    { item: 'StoreKit / IAP', severity: 'high', detail: 'mock purchase في package_store_screen' },
    { item: 'Analytics', severity: 'med', detail: 'mira_analytics.dart = TODO فقط' },
    { item: '8 stub services', severity: 'low', detail: 'حُذفت في Product Hardening' },
    { item: 'features/mira_analysis/', severity: 'low', detail: 'مجلد فارغ — لم يُحذف بعد' },
  ];

  const ARCH_ISSUES = [
    { type: 'State Management مُجزّأ', detail: 'Riverpod (outfit+packages) + Bloc (skin+profile) + AiModule singleton · new_analysis_screen يخلط الاثنين' },
    { type: 'Clean Architecture اختراقات', detail: 'Presentation يستورد *_repository_impl مباشرة (marketplace · subscription · outfit history)' },
    { type: 'Use case layer رفيع', detail: '7 use cases فقط — معظم المنطق في domain services' },
    { type: 'مسار الإطلالة', detail: 'OutfitIntelligenceService + Riverpod فقط — OutfitAnalysisBloc محذوف ✅' },
    { type: 'Subscription repo في data/', detail: 'الواجهة ليست في domain/' },
  ];

  const DEAD_FILES = [
    'lib/features/outfit_analysis/presentation/blocs/outfit_analysis_bloc.dart',
    'lib/features/outfit_analysis/presentation/blocs/outfit_analysis_event.dart',
    'lib/features/outfit_analysis/presentation/blocs/outfit_analysis_state.dart',
    'lib/core/models/user.dart',
    'lib/core/config/environment.dart',
    'lib/core/config/app_config.dart',
    'lib/core/constants/app_constants.dart',
    'lib/core/constants/api_constants.dart',
    'lib/core/constants/error_messages.dart',
    'lib/core/utils/validators.dart',
    'lib/core/utils/error_handler.dart',
    'lib/core/utils/network_checker.dart',
    'lib/core/utils/date_formatter.dart',
    'lib/core/security/secure_storage_service.dart',
    'lib/core/security/encryption_helper.dart',
    'lib/core/security/biometric_auth.dart',
    'lib/core/services/deep_link_handler.dart',
    'lib/core/services/notification_service.dart',
    'lib/core/services/permission_handler.dart',
    'lib/core/subscription/subscription_gate.dart',
    'lib/core/analytics/custom_analytics.dart',
    'lib/core/analytics/firebase_analytics.dart',
    'lib/core/utils/analytics_service.dart',
    'features/mira_analysis/ (مجلد فارغ — لم يُحذف)',
  ];

  const DEAD_FILES_DELETED = true;

  const RIVERPOD = [
    { name: 'googleVisionOutfitServiceProvider', used: true },
    { name: 'outfitIntelligenceServiceProvider', used: true },
    { name: 'optionalSkinReportProvider', used: true },
    { name: 'outfitAnalysisModeProvider', used: true },
    { name: 'outfitIntelligenceNotifierProvider', used: true },
    { name: 'packageCreditServiceProvider', used: true },
    { name: 'userPackageProvider', used: true },
  ];

  const BLOCS = [
    { name: 'SkinAnalysisBloc', used: true, screens: 'analysis · history · new_analysis' },
    { name: 'ProfileBloc', used: true, screens: 'profile_screen' },
  ];

  const REPOS = [
    { domain: 'AuthRepository', impl: 'AuthRepositoryImpl', status: 'clean', note: 'use cases في login' },
    { domain: 'ProfileRepository', impl: 'ProfileRepositoryImpl', status: 'clean', note: 'ProfileService' },
    { domain: 'SkinAnalysisRepository', impl: 'SkinAnalysisRepositoryImpl', status: 'warn', note: 'تجاوز في new_analysis_screen' },
    { domain: 'OutfitAnalysisRepository', impl: 'OutfitAnalysisRepositoryImpl', status: 'warn', note: 'المسار الرئيسي يتجاوزه' },
    { domain: 'MarketplaceRepository', impl: 'MarketplaceRepositoryImpl', status: 'bad', note: 'impl مباشرة من UI' },
    { domain: 'SubscriptionRepository', impl: 'SubscriptionRepositoryImpl', status: 'bad', note: 'interface في data/' },
  ];

  const AI_TARGETS = [
    { metric: 'اكتشاف نوع القطعة', target: 85, current: null },
    { metric: 'دقة اللون (garment-only)', target: 80, current: null },
    { metric: 'مناسبة صحيحة', target: 85, current: null },
    { metric: 'اقتراح منطقي', target: 80, current: null },
    { metric: 'سبب عربي مقنع', target: 75, current: null },
  ];

  const PERFORMANCE = [
    { item: 'زمن تحليل الإطلالة', note: 'Vision + segmentation API + KMeans — أثقل مسار', priority: 'high' },
    { item: 'اختبارات timeout', note: 'أُصلح — _NoNetworkSegmentation + _TestSegmentation', priority: 'ok' },
    { item: 'حجم الصور', note: 'frozen capture + segmentation upload', priority: 'med' },
    { item: 'الكاش', note: 'OutfitAnalysisCacheService موجود ✅', priority: 'ok' },
    { item: 'Delight UI', note: 'معطّل افتراضيًا — قرار صحيح لـ iOS', priority: 'ok' },
    { item: 'Fashion assets', note: '20×2KB — خفيف بصريًا ضعيف', priority: 'med' },
    { item: 'Memory / Battery', note: 'face mesh + live capture — يحتاج profiling', priority: 'med' },
  ];

  const TEST_GAPS = [
    { area: 'Auth OTP flow', have: 'saudi_phone_test', miss: 'E2E integration' },
    { area: 'Skin analysis UI', have: 'beauty_score_engine', miss: 'repository + bloc' },
    { area: 'Profile', have: '—', miss: 'bloc events' },
    { area: 'Subscription', have: 'subscription_status', miss: 'paywall · webhook' },
    { area: 'Marketplace', have: '—', miss: 'كل شيء' },
    { area: 'Packages', have: 'package_credit_service', miss: 'purchase flow' },
    { area: 'Outfit E2E', have: 'intelligence partial', miss: 'result screen widget' },
    { area: 'Performance', have: '—', miss: 'benchmarks' },
  ];

  const FEATURE_FLAGS = [
    { flag: 'MIRA_DELIGHT_UI', default: 'false', effect: 'حركة UI معطّلة — iOS safe' },
    { flag: 'MIRA_SUBSCRIPTIONS_ENABLED', default: 'false', effect: 'كل شيء مجاني' },
    { flag: 'MIRA_STORE_KIT_ENABLED', default: 'false', effect: 'لا IAP حقيقي' },
    { flag: 'MIRA_PACKAGES_ENABLED', default: 'false', effect: 'باقات معطّلة' },
    { flag: 'MIRA_MARKETPLACE_ENABLED', default: 'false', effect: 'marketplace مخفي' },
  ];

  const WEEK_PLAN = [
    {
      week: 1,
      title: 'Feature Freeze + Cleanup',
      tasks: [
        'تجميد الميزات — لا إضافات جديدة ✓',
        'حذف الملفات الميتة (24 ملف) ✓',
        'دمج مسار الإطلالة — إزالة OutfitAnalysisBloc ✓',
        'إصلاح 3 اختبارات timeout ✓',
      ],
    },
    {
      week: 2,
      title: 'E2E Manual QA',
      tasks: [
        'تنفيذ 10 مسارات على iOS',
        'تنفيذ 10 مسارات على Android',
        'توثيق كل bug في جدول E2E',
        'لا تنتقل للأسبوع 3 إذا تعطل مسار واحد',
      ],
    },
    {
      week: 3,
      title: 'AI Accuracy Audit',
      tasks: [
        'جمع 200 صورة متنوعة',
        'ملء جدول AI Audit',
        'حساب % لكل مقياس',
        'تحديد أضعف 3 نقاط',
      ],
    },
    {
      week: 4,
      title: 'Performance',
      tasks: [
        'قياس زمن skin على 3 أجهزة',
        'قياس زمن outfit على 3 أجهزة',
        'profiling ذاكرة live capture',
        'توثيق النتائج',
      ],
    },
  ];

  const POST_PLAN = [
    'استبدال / تحسين Google Vision',
    'استبدال 20 PNG بصور studio',
    'تفعيل StoreKit',
    'OUTFIT_PROVIDER=fashn على Render',
    'PERFECT_CORP_FALLBACK_MOCK=false',
  ];

  const FAKE_DATA_MAP = `المستخدم الضيف → Mock Skin AI (AiModule)
Render API outfit legacy → mock provider
FASHN provider → fallback mock عند أي خطأ
Fashion recommendations → منطق حقيقي على assets وهمية
Marketplace → seed/demo catalog
Package purchase → رصيد محلي بدون StoreKit
Similarity search → hash vectors`;

  // ─── Helpers ────────────────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch { return {}; }
  }
  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2800);
  }

  function severityClass(s) {
    return { high: 'risk-high', med: 'risk-med', low: 'risk-low', ok: 'risk-low' }[s] || '';
  }

  function statusPill(s) {
    const map = {
      ok: ['done', '✅ يعمل'],
      warn: ['partial', '⚠️ تحذير'],
      bad: ['fail', '❌ مشكلة'],
      unknown: ['unknown', '؟ غير مقاس'],
    };
    const [cls, lbl] = map[s] || map.unknown;
    return `<span class="completion-pill ${cls}">${lbl}</span>`;
  }

  function renderHardeningMini() {
    const stats = $('#hardening-mini-stats');
    if (stats) {
      const mini = [
        ['120', 'اختبار ✓'],
        ['0', 'أخطاء Analyzer'],
        ['24', 'ملف محذوف'],
        ['60%', 'جاهزية هندسية'],
      ];
      stats.innerHTML = mini.map(([n, l]) =>
        `<div class="stat-card"><div class="num">${n}</div><div class="lbl">${l}</div></div>`
      ).join('');
    }
    const rings = $('#hardening-mini-rings');
    if (rings) {
      rings.innerHTML = `
        <div class="readiness-ring engineering"><div class="pct">60%</div><div class="lbl">هندسة</div></div>
        <div class="readiness-ring product"><div class="pct">58%</div><div class="lbl">منتج</div></div>
      `;
    }
  }

  // ─── Render inventory stats ─────────────────────────────────
  function renderStats() {
    const el = $('#stat-grid');
    if (!el) return;
    const items = [
      ['429', 'ملف Dart'],
      ['17', 'Feature modules'],
      ['7', 'Riverpod providers'],
      ['2', 'Blocs'],
      ['43', 'Entities'],
      ['6', 'Repositories'],
      ['120', 'Tests ناجحة'],
      ['0', 'Tests فاشلة'],
      ['20', 'Fashion PNGs'],
      ['60%', 'جاهزية هندسية'],
    ];
    el.innerHTML = items.map(([n, l]) =>
      `<div class="stat-card"><div class="num">${n}</div><div class="lbl">${l}</div></div>`
    ).join('');
  }

  function renderReadiness() {
    const el = $('#readiness-dashboard');
    if (!el) return;
    el.innerHTML = READINESS.map((r) => `
      <div class="progress-item">
        <h4>${r.label} ${r.highlight ? '★' : ''}</h4>
        <div class="progress-bar-wrap"><span style="width:${r.unknown ? 5 : r.pct}%"></span></div>
        <p style="margin:8px 0 0;font-size:0.8rem;color:var(--muted)">
          ${r.unknown ? 'غير مقاس' : r.pct + '%'} — ${r.note}
        </p>
      </div>
    `).join('');
  }

  function renderTable(id, rows, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = rows.map(fn).join('');
  }

  function renderStaticTables() {
    renderTable('tbl-complete', COMPLETE_FEATURES, (r) => `
      <tr><td>${r.area}</td><td><strong>${r.pct}%</strong></td><td><code>${r.files}</code></td></tr>
    `);

    renderTable('tbl-placeholders', PLACEHOLDERS, (r) => `
      <tr>
        <td class="${severityClass(r.severity)}">${r.item}</td>
        <td>${r.detail}</td>
      </tr>
    `);

    renderTable('tbl-arch', ARCH_ISSUES, (r) => `
      <tr><td><strong>${r.type}</strong></td><td>${r.detail}</td></tr>
    `);

    renderTable('tbl-riverpod', RIVERPOD, (r) => `
      <tr>
        <td><code>${r.name}</code></td>
        <td>${r.used ? statusPill('ok') : statusPill('bad')}</td>
      </tr>
    `);

    renderTable('tbl-blocs', BLOCS, (r) => `
      <tr>
        <td><code>${r.name}</code></td>
        <td>${r.used ? statusPill('ok') : statusPill('bad')}</td>
        <td>${r.screens}</td>
      </tr>
    `);

    renderTable('tbl-repos', REPOS, (r) => `
      <tr>
        <td><code>${r.domain}</code></td>
        <td><code>${r.impl}</code></td>
        <td>${statusPill(r.status === 'clean' ? 'ok' : r.status === 'warn' ? 'warn' : 'bad')}</td>
        <td>${r.note}</td>
      </tr>
    `);

    renderTable('tbl-ai-targets', AI_TARGETS, (r) => `
      <tr>
        <td>${r.metric}</td>
        <td>≥${r.target}%</td>
        <td>${r.current == null ? '<span class="completion-pill unknown">غير مقاس</span>' : r.current + '%'}</td>
      </tr>
    `);

    renderTable('tbl-performance', PERFORMANCE, (r) => `
      <tr>
        <td class="${severityClass(r.priority === 'high' ? 'high' : r.priority === 'med' ? 'med' : 'low')}">${r.item}</td>
        <td>${r.note}</td>
      </tr>
    `);

    renderTable('tbl-test-gaps', TEST_GAPS, (r) => `
      <tr><td>${r.area}</td><td>${r.have}</td><td class="risk-med">${r.miss}</td></tr>
    `);

    renderTable('tbl-flags', FEATURE_FLAGS, (r) => `
      <tr><td><code>${r.flag}</code></td><td>${r.default}</td><td>${r.effect}</td></tr>
    `);

    const fakeEl = $('#fake-data-map');
    if (fakeEl) fakeEl.textContent = FAKE_DATA_MAP;
  }

  // ─── E2E checklist ──────────────────────────────────────────
  function renderE2E() {
    const tbody = $('#e2e-tbody');
    if (!tbody) return;
    const state = load(STORAGE.e2e);

    tbody.innerHTML = E2E_FLOWS.map((f) => {
      const ios = state[`${f.id}-ios`] || '';
      const android = state[`${f.id}-android`] || '';
      const notes = state[`${f.id}-notes`] || '';
      return `
        <tr data-id="${f.id}">
          <td><strong>${f.step}</strong></td>
          <td>${f.flow}</td>
          <td>${statusPill(f.status)}</td>
          <td style="font-size:0.82rem">${f.risk}</td>
          <td>
            <select class="e2e-ios" data-id="${f.id}">
              <option value="">— iOS —</option>
              <option value="pass" ${ios === 'pass' ? 'selected' : ''}>✅ نجح</option>
              <option value="fail" ${ios === 'fail' ? 'selected' : ''}>❌ فشل</option>
              <option value="skip" ${ios === 'skip' ? 'selected' : ''}>⏭ تخطي</option>
            </select>
          </td>
          <td>
            <select class="e2e-android" data-id="${f.id}">
              <option value="">— Android —</option>
              <option value="pass" ${android === 'pass' ? 'selected' : ''}>✅ نجح</option>
              <option value="fail" ${android === 'fail' ? 'selected' : ''}>❌ فشل</option>
              <option value="skip" ${android === 'skip' ? 'selected' : ''}>⏭ تخطي</option>
            </select>
          </td>
          <td><input type="text" class="e2e-notes" data-id="${f.id}" value="${notes}" placeholder="ملاحظات..." /></td>
        </tr>
      `;
    }).join('');

    tbody.addEventListener('change', onE2EChange);
    tbody.addEventListener('input', onE2EChange);
    updateE2EProgress();
  }

  function onE2EChange(e) {
    const t = e.target;
    const id = t.dataset.id;
    if (!id) return;
    const state = load(STORAGE.e2e);
    if (t.classList.contains('e2e-ios')) state[`${id}-ios`] = t.value;
    if (t.classList.contains('e2e-android')) state[`${id}-android`] = t.value;
    if (t.classList.contains('e2e-notes')) state[`${id}-notes`] = t.value;
    save(STORAGE.e2e, state);
    updateE2EProgress();
  }

  function updateE2EProgress() {
    const state = load(STORAGE.e2e);
    let done = 0;
    const total = E2E_FLOWS.length * 2;
    E2E_FLOWS.forEach((f) => {
      if (state[`${f.id}-ios`] === 'pass' || state[`${f.id}-ios`] === 'fail') done++;
      if (state[`${f.id}-android`] === 'pass' || state[`${f.id}-android`] === 'fail') done++;
    });
    const pct = total ? Math.round((done / total) * 100) : 0;
    const el = $('#e2e-progress');
    if (el) {
      el.innerHTML = `<div class="progress-bar-wrap"><span style="width:${pct}%"></span></div>
        <p style="margin-top:8px;font-size:0.85rem">${done}/${total} منصة-مسار مُختبر · ${pct}%</p>`;
    }
  }

  // ─── AI Audit 200 rows ────────────────────────────────────────
  const AI_ROW_COUNT = 200;

  function initAiAudit() {
    const tbody = $('#ai-tbody');
    if (!tbody) return;
    const state = load(STORAGE.ai);

    let html = '';
    for (let i = 1; i <= AI_ROW_COUNT; i++) {
      const key = `row-${i}`;
      const row = state[key] || {};
      html += aiRowHtml(i, row);
    }
    tbody.innerHTML = html;

    tbody.addEventListener('change', onAiChange);
    tbody.addEventListener('input', onAiChange);
    updateAiStats();
  }

  function aiRowHtml(i, row) {
    const yn = (v) => v || '';
    return `
      <tr data-row="${i}">
        <td>${i}</td>
        <td><input type="text" data-field="image" data-row="${i}" value="${yn(row.image)}" placeholder="اسم/رابط" /></td>
        <td><input type="text" data-field="garment" data-row="${i}" value="${yn(row.garment)}" /></td>
        <td>${ynSelect('detected', i, row.detected)}</td>
        <td>${ynSelect('color', i, row.color)}</td>
        <td>${ynSelect('occasion', i, row.occasion)}</td>
        <td>${ynSelect('suggest', i, row.suggest)}</td>
        <td>${ynSelect('reason', i, row.reason)}</td>
        <td><input type="text" data-field="notes" data-row="${i}" value="${yn(row.notes)}" /></td>
      </tr>
    `;
  }

  function ynSelect(field, row, val) {
    const opts = ['', 'Y', 'N'];
    const labels = ['—', '✓', '✗'];
    return `<select data-field="${field}" data-row="${row}">` +
      opts.map((o, idx) => `<option value="${o}" ${val === o ? 'selected' : ''}>${labels[idx]}</option>`).join('') +
      '</select>';
  }

  function onAiChange(e) {
    const t = e.target;
    const row = t.dataset.row;
    const field = t.dataset.field;
    if (!row || !field) return;
    const state = load(STORAGE.ai);
    if (!state[`row-${row}`]) state[`row-${row}`] = {};
    state[`row-${row}`][field] = t.value;
    save(STORAGE.ai, state);
    updateAiStats();
  }

  function updateAiStats() {
    const state = load(STORAGE.ai);
    const metrics = { detected: 0, color: 0, occasion: 0, suggest: 0, reason: 0 };
    const totals = { detected: 0, color: 0, occasion: 0, suggest: 0, reason: 0 };
    let filled = 0;

    for (let i = 1; i <= AI_ROW_COUNT; i++) {
      const row = state[`row-${i}`];
      if (!row || !row.image) continue;
      filled++;
      ['detected', 'color', 'occasion', 'suggest', 'reason'].forEach((m) => {
        if (row[m] === 'Y' || row[m] === 'N') {
          totals[m]++;
          if (row[m] === 'Y') metrics[m]++;
        }
      });
    }

    const el = $('#ai-stats');
    if (!el) return;
    const pct = (m) => totals[m] ? Math.round((metrics[m] / totals[m]) * 100) : '—';
    el.innerHTML = `
      <p><strong>${filled}</strong> / ${AI_ROW_COUNT} صورة مُدخلة</p>
      <div class="stat-grid" style="margin-top:12px">
        <div class="stat-card"><div class="num">${pct('detected')}${pct('detected') !== '—' ? '%' : ''}</div><div class="lbl">اكتشاف القطعة</div></div>
        <div class="stat-card"><div class="num">${pct('color')}${pct('color') !== '—' ? '%' : ''}</div><div class="lbl">دقة اللون</div></div>
        <div class="stat-card"><div class="num">${pct('occasion')}${pct('occasion') !== '—' ? '%' : ''}</div><div class="lbl">المناسبة</div></div>
        <div class="stat-card"><div class="num">${pct('suggest')}${pct('suggest') !== '—' ? '%' : ''}</div><div class="lbl">الاقتراح</div></div>
        <div class="stat-card"><div class="num">${pct('reason')}${pct('reason') !== '—' ? '%' : ''}</div><div class="lbl">السبب</div></div>
      </div>
    `;
  }

  function exportAiCsv() {
    const state = load(STORAGE.ai);
    const headers = ['#', 'image', 'garment', 'detected', 'color', 'occasion', 'suggest', 'reason', 'notes'];
    const lines = [headers.join(',')];
    for (let i = 1; i <= AI_ROW_COUNT; i++) {
      const r = state[`row-${i}`] || {};
      lines.push([i, r.image, r.garment, r.detected, r.color, r.occasion, r.suggest, r.reason, r.notes]
        .map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','));
    }
    download('mira-ai-audit.csv', lines.join('\n'), 'text/csv;charset=utf-8');
    toast('تم تصدير CSV');
  }

  // ─── Dead files checklist ─────────────────────────────────────
  function renderDeadFiles() {
    const el = $('#dead-files-list');
    if (!el) return;
    const state = load(STORAGE.dead);
    el.innerHTML = DEAD_FILES.map((f, i) => {
      const checked = DEAD_FILES_DELETED || state[i];
      return `
      <li>
        <input type="checkbox" id="dead-${i}" data-idx="${i}" ${checked ? 'checked' : ''} disabled />
        <label for="dead-${i}"><code style="font-size:0.78rem">${f}</code> ${DEAD_FILES_DELETED ? '<span class="completion-pill done">محذوف</span>' : ''}</label>
      </li>
    `;
    }).join('');

    if (!DEAD_FILES_DELETED) {
      el.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox') return;
        const s = load(STORAGE.dead);
        s[e.target.dataset.idx] = e.target.checked;
        save(STORAGE.dead, s);
        updateDeadProgress();
      });
    }
    updateDeadProgress();
  }

  function updateDeadProgress() {
    const state = load(STORAGE.dead);
    const done = DEAD_FILES_DELETED
      ? DEAD_FILES.length
      : DEAD_FILES.filter((_, i) => state[i]).length;
    const el = $('#dead-progress');
    if (el) {
      el.textContent = DEAD_FILES_DELETED
        ? `${done} / ${DEAD_FILES.length} ملف — تم الحذف في Product Hardening ✓`
        : `${done} / ${DEAD_FILES.length} ملف تمت مراجعته/حذفه`;
    }
  }

  // ─── Week plan ────────────────────────────────────────────────
  function renderWeekPlan() {
    const el = $('#week-plan');
    if (!el) return;
    const state = load(STORAGE.week);

    el.innerHTML = WEEK_PLAN.map((w) => `
      <div class="week-block">
        <h3><span class="week-tag">الأسبوع ${w.week}</span> ${w.title}</h3>
        <ul class="task-list">
          ${w.tasks.map((t, ti) => {
            const key = `w${w.week}-t${ti}`;
            return `<li>
              <input type="checkbox" id="${key}" data-key="${key}" ${state[key] ? 'checked' : ''} />
              <label for="${key}">${t}</label>
            </li>`;
          }).join('')}
        </ul>
      </div>
    `).join('') + `
      <div class="week-block">
        <h3><span class="week-tag">بعد الأسبوع 4</span> فقط عند استقرار النظام</h3>
        <ul class="task-list">
          ${POST_PLAN.map((t, i) => {
            const key = `post-${i}`;
            return `<li>
              <input type="checkbox" id="${key}" data-key="${key}" ${state[key] ? 'checked' : ''} />
              <label for="${key}">${t}</label>
            </li>`;
          }).join('')}
        </ul>
      </div>
    `;

    el.addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;
      const s = load(STORAGE.week);
      s[e.target.dataset.key] = e.target.checked;
      save(STORAGE.week, s);
    });
  }

  // ─── Export / reset ───────────────────────────────────────────
  function download(name, content, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportAll() {
    const data = {
      exportedAt: new Date().toISOString(),
      inventory: INVENTORY,
      e2e: load(STORAGE.e2e),
      ai: load(STORAGE.ai),
      week: load(STORAGE.week),
      dead: load(STORAGE.dead),
    };
    download('mira-project-audit-export.json', JSON.stringify(data, null, 2), 'application/json');
    toast('تم تصدير JSON كامل');
  }

  function resetStorage() {
    if (!confirm('مسح كل التقدّم المحفوظ محليًا؟')) return;
    Object.values(STORAGE).forEach((k) => localStorage.removeItem(k));
    location.reload();
  }

  // ─── Scroll spy ───────────────────────────────────────────────
  function initScrollSpy() {
    const links = $$('.audit-sidebar a[href^="#"]');
    const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach((a) => {
          a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
        });
      });
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });

    sections.forEach((s) => observer.observe(s));
  }

  // ─── Init ─────────────────────────────────────────────────────
  function init() {
    renderStats();
    renderHardeningMini();
    renderReadiness();
    renderStaticTables();
    renderE2E();
    initAiAudit();
    renderDeadFiles();
    renderWeekPlan();
    initScrollSpy();

    $('#btn-export-json')?.addEventListener('click', exportAll);
    $('#btn-export-csv')?.addEventListener('click', exportAiCsv);
    $('#btn-reset')?.addEventListener('click', resetStorage);
    $('#btn-print')?.addEventListener('click', () => window.print());

    const updated = $('#audit-date');
    if (updated) updated.textContent = new Date().toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
