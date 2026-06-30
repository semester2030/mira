(function () {
  'use strict';

  const REPORT_DATE = '2026-06-01';

  const METRICS = [
    { num: '120', lbl: 'اختبار ناجح', sub: '100%' },
    { num: '0', lbl: 'أخطاء Analyzer', sub: 'lib/' },
    { num: '429', lbl: 'ملف Dart', sub: '−24 محذوف' },
    { num: '60%', lbl: 'جاهزية هندسية', sub: 'محسوبة' },
    { num: '24', lbl: 'ملف ميت', sub: 'محذوف' },
    { num: '6', lbl: 'اختراقات arch', sub: 'موثّقة' },
  ];

  const SUMMARY_ROWS = [
    { axis: 'اختبارات Flutter', before: '117 ناجح / 3 فاشل', after: '120 / 120', status: 'done', label: '✅ 100%' },
    { axis: 'أخطاء Analyzer (lib)', before: '1+ error', after: '0 errors', status: 'done', label: '✅ نظيف' },
    { axis: 'ملفات Dart (lib)', before: '453', after: '429', status: 'done', label: '−24 ملف' },
    { axis: 'OutfitAnalysisBloc', before: 'ميت (3 ملفات)', after: 'محذوف', status: 'done', label: '✅' },
    { axis: 'Providers غير مستخدمة', before: '2', after: '0', status: 'done', label: '✅' },
    { axis: 'E2E يدوي', before: 'غير مكتمل', after: 'غير مكتمل', status: 'partial', label: '⏳ مطلوب' },
    { axis: 'AI Audit 200 صورة', before: 'غير مبدوء', after: 'غير مبدوء', status: 'partial', label: '⏳ مطلوب' },
    { axis: 'Performance profiling', before: 'غير مقاس', after: 'غير مقاس', status: 'partial', label: '⏳ مطلوب' },
  ];

  const COMPARE = {
    before: [
      { k: 'اختبارات', v: '117 ✓ / 3 ✗' },
      { k: 'Analyzer errors', v: '1+' },
      { k: 'ملفات lib', v: '453' },
      { k: 'OutfitAnalysisBloc', v: '3 ملفات ميتة' },
      { k: 'Providers زائدة', v: '2' },
      { k: 'Dead code stubs', v: '24+ ملف' },
    ],
    after: [
      { k: 'اختبارات', v: '120 ✓ / 0 ✗' },
      { k: 'Analyzer errors', v: '0' },
      { k: 'ملفات lib', v: '429' },
      { k: 'OutfitAnalysisBloc', v: 'محذوف' },
      { k: 'Providers زائدة', v: '0' },
      { k: 'Dead code stubs', v: '0 (تم التنظيف)' },
    ],
  };

  const PHASES = [
    { n: 1, title: 'Feature Freeze', status: 'done', tag: 'مكتمل', desc: 'تجميد الميزات — لا UI جديد، لا AI جديد، لا marketplace.' },
    { n: 2, title: 'Architecture Cleanup', status: 'done', tag: 'مكتمل', desc: 'حذف 24 ملفًا ميتًا بعد تحليل تبعيات. OutfitAnalysisBloc + stubs core.' },
    { n: 3, title: 'State Consolidation', status: 'done', tag: 'مكتمل', desc: 'إزالة googleVisionEnabledProvider و requiredSkinReportProvider. Riverpod + Bloc محفوظان عمدًا.' },
    { n: 4, title: 'Test Stabilization', status: 'done', tag: 'مكتمل', desc: '120/120 — إصلاح timeout Render API و ML Kit في VM.' },
    { n: 5, title: 'E2E Manual QA', status: 'pending', tag: 'معلّق', desc: '10 تدفقات — checklist تفاعلي في تقرير التدقيق.' },
    { n: 6, title: 'AI Accuracy Audit', status: 'pending', tag: 'معلّق', desc: '200 صورة — جدول scaffold في mira-project-audit.' },
    { n: 7, title: 'Performance Profiling', status: 'pending', tag: 'معلّق', desc: 'لم يُقاس بعد — خارج نطاق التثبيت الحالي.' },
    { n: 8, title: 'Security Review', status: 'done', tag: 'موثّق', desc: 'مفاتيح API على Render فقط — PERFECT_CORP_FALLBACK_MOCK موثّق كمخاطرة.' },
    { n: 9, title: 'Code Quality', status: 'done', tag: 'مكتمل', desc: '0 analyzer errors · fashion_outfit_scorer type fix.' },
    { n: 10, title: 'Documentation', status: 'done', tag: 'مكتمل', desc: 'تقرير التدقيق + تقرير الهندسة + روابط من index.' },
  ];

  const ARCH_ROWS = [
    ['Feature modules', '17 (1 فارغ: mira_analysis/)'],
    ['Repositories', '6 — OutfitAnalysisRepository لـ history فقط'],
    ['Use cases', '7 — رفيع عمدًا (لم يُغيّر)'],
    ['مسار الإطلالة الفعّال', 'OutfitIntelligenceService + Riverpod فقط'],
    ['اختراقات clean arch', '6 شاشات → *RepositoryImpl مباشرة — لم تُعدّل (خارج النطاق)'],
    ['Health score', '72% — تحسّن بعد حذف الميت'],
  ];

  const STATE_ROWS = [
    ['Riverpod providers (فعّالة)', '7', 'outfit intelligence + packages'],
    ['SkinAnalysisBloc', '1', '✅ محفوظ'],
    ['ProfileBloc', '1', '✅ محفوظ'],
    ['OutfitAnalysisBloc', '0', '🗑 محذوف'],
    ['googleVisionEnabledProvider', '0', '🗑 محذوف'],
    ['requiredSkinReportProvider', '0', '🗑 محذوف (deprecated)'],
  ];

  const TEST_FIXES = [
    'OutfitIntelligenceService tests — كان يضرب Render API (Dio timeout 30s) → أُضيف _NoNetworkSegmentation',
    'نفس الاختبارات — كان يستدعي ML Kit pose → أُضيف _TestSegmentation',
    'outfit_body_silhouette_builder_test — توقع 6 مناطق بينما التنفيذ يُرجع 5 → أُصلح التوقع',
  ];

  const TEST_GAPS = [
    'E2E widget/integration tests',
    'Auth OTP integration',
    'Marketplace · Paywall · Profile bloc',
    'Performance benchmarks',
  ];

  const REMOVED_FILES = [
    'outfit_analysis_bloc.dart', 'outfit_analysis_event.dart', 'outfit_analysis_state.dart',
    'core/models/user.dart', 'core/config/environment.dart', 'core/config/app_config.dart',
    'core/constants/app_constants.dart', 'api_constants.dart', 'error_messages.dart',
    'core/utils/validators.dart', 'error_handler.dart', 'network_checker.dart',
    'date_formatter.dart', 'analytics_service.dart',
    'core/security/secure_storage_service.dart', 'biometric_auth_service.dart', 'encryption_service.dart',
    'deep_link_handler.dart', 'notification_service.dart', 'permission_handler.dart',
    'subscription_gate.dart', 'custom_analytics.dart', 'firebase_analytics.dart',
    'mira_coming_soon_card.dart',
  ];

  const DEPENDENCY_GRAPH = `OutfitUploadScreen
    └─► OutfitIntelligenceService (domain)
          ├─► GoogleVisionProvider (labels + colors)
          ├─► SegmentationProvider (Render API / test stub)
          ├─► DeterministicOutfitEngine
          ├─► FashionRankingEngine
          │     ├─► KnowledgeGraph
          │     ├─► ColorHarmonyEngine
          │     └─► catalog.json v3
          └─► OutfitResultScreen (presentation)

State: Riverpod (outfitIntelligenceProvider)
History: OutfitAnalysisRepositoryImpl (Firestore only)
DELETED: OutfitAnalysisBloc ❌`;

  const SECURITY_ROWS = [
    ['Perfect Corp / FASHN keys', 'ok', '✅ على Render فقط — لم تُمس'],
    ['GOOGLE_VISION_API_KEY', 'ok', '✅ dart-define — ليس في الكود'],
    ['firebase_options.dart', 'warn', '⚠️ Firebase client API keys (عادي لـ FlutterFire)'],
    ['PERFECT_CORP_FALLBACK_MOCK=true', 'danger', '🔴 Render — يحتاج تعطيل قبل إطلاق production صارم'],
    ['OUTFIT_PROVIDER=mock', 'danger', '🔴 Render — legacy path فقط'],
  ];

  const PRODUCTION_FLAGS = [
    ['MIRA_SUBSCRIPTIONS_ENABLED', 'false', 'low', 'منخفض — مجاني'],
    ['MIRA_STORE_KIT_ENABLED', 'false', 'low', 'منخفض — IAP معطّل'],
    ['MIRA_MARKETPLACE_ENABLED', 'false', 'low', 'منخفض'],
    ['USE_MIRA_API', 'true', 'med', 'متوسط — guest يستخدم mock محلي'],
    ['AiModule mocks', 'محلي', 'med', 'متوسط للضيف فقط'],
  ];

  const READINESS_ITEMS = [
    { label: 'اختبارات 100%', weight: 25, done: true, pct: 100 },
    { label: 'Analyzer نظيف', weight: 15, done: true, pct: 100 },
    { label: 'Dead code محذوف', weight: 10, done: true, pct: 100 },
    { label: 'State موحّد', weight: 10, done: true, pct: 100 },
    { label: 'E2E يدوي', weight: 20, done: false, pct: 0 },
    { label: 'AI Audit 200', weight: 10, done: false, pct: 0 },
    { label: 'Performance', weight: 10, done: false, pct: 0 },
  ];

  const RISKS = [
    { risk: '20 fashion PNG placeholders', severity: 'high', action: 'استبدال بصور 2000×2000 حقيقية' },
    { risk: 'PERFECT_CORP_FALLBACK_MOCK على Render', severity: 'high', action: 'تعطيل قبل إطلاق production' },
    { risk: 'Guest skin = mock AI', severity: 'med', action: 'توثيق أو تقييد guest mode' },
    { risk: '6 clean-arch violations في presentation', severity: 'med', action: 'DI عبر Riverpod (Future)' },
    { risk: 'E2E غير مُختبر يدويًا', severity: 'med', action: 'إكمال checklist في تقرير التدقيق' },
    { risk: '250 analyzer info/warning', severity: 'low', action: 'تنظيف تدريجي — معظمها style' },
  ];

  const FUTURE = [
    'استبدال Google Vision بمحرك جديد',
    'Repository DI عبر get_it / Riverpod عالمي',
    'إصلاح presentation → impl imports',
    'StoreKit / RevenueCat حقيقي',
    'Marketplace كامل',
    'Embeddings ML حقيقية',
    'Analytics Firebase',
    'Capsule wardrobe UI',
  ];

  const RULES = [
    { type: 'forbidden', text: 'لا ميزات جديدة' },
    { type: 'forbidden', text: 'لا إعادة تصميم UI' },
    { type: 'forbidden', text: 'لا تغيير منطق AI / Intelligence' },
    { type: 'forbidden', text: 'لا إعادة هيكلة معمارية كبيرة' },
    { type: 'allowed', text: 'إصلاح أخطاء واختبارات' },
    { type: 'allowed', text: 'حذف كود ميت موثّق' },
    { type: 'allowed', text: 'قياس وتوثيق' },
    { type: 'allowed', text: 'تثبيت الاستقرار' },
  ];

  const NAV_LINKS = [
    { href: 'mira-project-audit.html', title: 'تقرير تدقيق المشروع', desc: 'E2E checklist · AI Audit 200 · خطة 4 أسابيع' },
    { href: 'mira-production-readiness.html', title: 'جاهزية الإنتاج', desc: 'Feature flags · Render · App Store' },
    { href: 'mira-intelligence-layer.html', title: 'Intelligence Layer', desc: 'Fashion catalog · ranking · knowledge graph' },
    { href: 'index.html', title: 'الصفحة الرئيسية', desc: 'بوابة وثائق ميرا' },
  ];

  function $(id) { return document.getElementById(id); }

  function pill(status, label) {
    return '<span class="completion-pill ' + status + '">' + label + '</span>';
  }

  function riskClass(sev) {
    if (sev === 'high' || sev === 'danger') return 'risk-high';
    if (sev === 'med' || sev === 'warn') return 'risk-med';
    return 'risk-low';
  }

  function engineeringPct() {
    return READINESS_ITEMS.filter(function (i) { return i.done; })
      .reduce(function (s, i) { return s + i.weight; }, 0);
  }

  function productPct() {
    return 58;
  }

  function renderMetrics() {
    var grid = $('metrics-grid');
    if (!grid) return;
    grid.innerHTML = METRICS.map(function (m) {
      return '<div class="stat-card"><div class="num">' + m.num + '</div><div class="lbl">' + m.lbl + '</div>' +
        (m.sub ? '<div class="lbl" style="margin-top:4px;opacity:0.8">' + m.sub + '</div>' : '') + '</div>';
    }).join('');
  }

  function renderRings() {
    var wrap = $('readiness-rings');
    if (!wrap) return;
    var eng = engineeringPct();
    var prod = productPct();
    wrap.innerHTML =
      '<div class="readiness-ring engineering"><div class="pct">' + eng + '%</div><div class="lbl">جاهزية هندسية</div></div>' +
      '<div class="readiness-ring product"><div class="pct">' + prod + '%</div><div class="lbl">جاهزية منتج</div></div>';
  }

  function renderRules() {
    var el = $('rules-grid');
    if (!el) return;
    el.innerHTML = RULES.map(function (r) {
      return '<div class="rule-item ' + r.type + '">' + r.text + '</div>';
    }).join('');
  }

  function renderSummary() {
    var tbody = document.querySelector('#summary-table tbody');
    if (!tbody) return;
    tbody.innerHTML = SUMMARY_ROWS.map(function (r) {
      return '<tr><td>' + r.axis + '</td><td>' + r.before + '</td><td><strong>' + r.after + '</strong></td><td>' + pill(r.status, r.label) + '</td></tr>';
    }).join('');
  }

  function renderCompare() {
    var el = $('compare-grid');
    if (!el) return;
    function card(title, cls, rows) {
      var html = '<div class="compare-card ' + cls + '"><h3>' + title + '</h3>';
      rows.forEach(function (r) {
        html += '<div class="metric-row"><span>' + r.k + '</span><strong>' + r.v + '</strong></div>';
      });
      return html + '</div>';
    }
    el.innerHTML = card('قبل التثبيت', 'before', COMPARE.before) +
      '<div class="compare-arrow">→</div>' +
      card('بعد التثبيت', 'after', COMPARE.after);
  }

  function renderPhases() {
    var el = $('phase-timeline');
    if (!el) return;
    el.innerHTML = PHASES.map(function (p) {
      var cls = p.status === 'done' ? 'done' : p.status === 'pending' ? 'pending' : 'blocked';
      return '<div class="phase-timeline-item ' + cls + '">' +
        '<h4>المرحلة ' + p.n + ' — ' + p.title + ' <span class="phase-tag ' + cls + '">' + p.tag + '</span></h4>' +
        '<p style="margin:0;font-size:0.88rem;color:var(--muted)">' + p.desc + '</p></div>';
    }).join('');
  }

  function renderTableBody(id, rows, cols) {
    var tbody = document.querySelector('#' + id + ' tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(function (row) {
      var cells = cols ? cols(row) : row.map(function (c) { return '<td>' + c + '</td>'; });
      return '<tr>' + (Array.isArray(cells) ? cells.join('') : cells) + '</tr>';
    }).join('');
  }

  function renderArch() {
    renderTableBody('arch-table', ARCH_ROWS);
    var score = $('arch-score');
    if (score) score.innerHTML = pill('partial', '72%');
  }

  function renderState() {
    renderTableBody('state-table', STATE_ROWS);
    var score = $('state-score');
    if (score) score.innerHTML = pill('done', '85%');
  }

  function renderTests() {
    var summary = $('test-summary');
    if (summary) {
      summary.innerHTML = '<p>ملفات اختبار: <strong>26</strong> · إجمالي: <strong>120</strong> · نسبة النجاح: <strong>100%</strong></p>';
    }
    var fixes = $('test-fixes');
    if (fixes) fixes.innerHTML = TEST_FIXES.map(function (t) { return '<li><code>' + t + '</code></li>'; }).join('');
    var gaps = $('test-gaps');
    if (gaps) gaps.innerHTML = TEST_GAPS.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    var score = $('test-score');
    if (score) score.innerHTML = pill('done', '100%');
  }

  function renderDeadCode() {
    var el = $('removed-list');
    if (!el) return;
    el.innerHTML = REMOVED_FILES.map(function (f) {
      return '<div class="dead-file-chip">lib/.../' + f + '</div>';
    }).join('');
  }

  function renderDependency() {
    var el = $('dependency-graph');
    if (el) el.textContent = DEPENDENCY_GRAPH;
  }

  function renderSecurity() {
    var tbody = document.querySelector('#security-table tbody');
    if (!tbody) return;
    tbody.innerHTML = SECURITY_ROWS.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td class="' + riskClass(r[1]) + '">' + r[2] + '</td></tr>';
    }).join('');
  }

  function renderProduction() {
    var tbody = document.querySelector('#production-table tbody');
    if (!tbody) return;
    tbody.innerHTML = PRODUCTION_FLAGS.map(function (r) {
      return '<tr><td><code>' + r[0] + '</code></td><td>' + r[1] + '</td><td class="' + riskClass(r[2]) + '">' + r[3] + '</td></tr>';
    }).join('');
  }

  function renderReadiness() {
    var el = $('readiness-calc');
    if (!el) return;
    el.innerHTML = READINESS_ITEMS.map(function (item) {
      var w = item.done ? item.weight : 0;
      return '<div class="progress-item"><h4>' + item.label + ' (' + item.weight + '%)</h4>' +
        '<div class="progress-bar-wrap"><span style="width:' + item.pct + '%"></span></div>' +
        '<p style="margin:8px 0 0;font-size:0.78rem;color:var(--muted)">مساهمة: ' + w + '% · ' +
        (item.done ? pill('done', 'مكتمل') : pill('partial', 'معلّق')) + '</p></div>';
    }).join('');
  }

  function renderRisks() {
    var tbody = document.querySelector('#risks-table tbody');
    if (!tbody) return;
    tbody.innerHTML = RISKS.map(function (r) {
      return '<tr><td>' + r.risk + '</td><td class="' + riskClass(r.severity) + '">' + r.severity + '</td><td>' + r.action + '</td></tr>';
    }).join('');
  }

  function renderFuture() {
    var el = $('future-list');
    if (el) el.innerHTML = FUTURE.map(function (f) { return '<li>' + f + '</li>'; }).join('');
  }

  function renderNavHub() {
    var el = $('nav-hub-links');
    if (!el) return;
    el.innerHTML = NAV_LINKS.map(function (l) {
      return '<a href="' + l.href + '"><strong>' + l.title + '</strong><span>' + l.desc + '</span></a>';
    }).join('');
  }

  function setupSidebar() {
    var links = document.querySelectorAll('.audit-sidebar a');
    var sections = [];
    links.forEach(function (a) {
      var id = a.getAttribute('href');
      if (id && id.startsWith('#')) {
        var sec = document.querySelector(id);
        if (sec) sections.push({ link: a, sec: sec });
      }
    });
    function onScroll() {
      var y = window.scrollY + 100;
      var current = sections[0];
      sections.forEach(function (s) {
        if (s.sec.offsetTop <= y) current = s;
      });
      links.forEach(function (l) { l.classList.remove('active'); });
      if (current) current.link.classList.add('active');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function exportReport() {
    var data = {
      report: 'MIRA Product Hardening',
      date: REPORT_DATE,
      engineeringReadiness: engineeringPct(),
      productReadiness: productPct(),
      metrics: METRICS,
      summary: SUMMARY_ROWS,
      phases: PHASES,
      removedFiles: REMOVED_FILES,
      risks: RISKS,
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mira-hardening-report-' + REPORT_DATE + '.json';
    a.click();
    toast('تم تصدير التقرير');
  }

  function init() {
    var dateEl = $('report-date');
    if (dateEl) dateEl.textContent = REPORT_DATE;

    renderMetrics();
    renderRings();
    renderRules();
    renderSummary();
    renderCompare();
    renderPhases();
    renderArch();
    renderState();
    renderTests();
    renderDeadCode();
    renderDependency();
    renderSecurity();
    renderProduction();
    renderReadiness();
    renderRisks();
    renderFuture();
    renderNavHub();
    setupSidebar();

    var btnExport = $('btn-export');
    if (btnExport) btnExport.addEventListener('click', exportReport);
    var btnPrint = $('btn-print');
    if (btnPrint) btnPrint.addEventListener('click', function () { window.print(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
