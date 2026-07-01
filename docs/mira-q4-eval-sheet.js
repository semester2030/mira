/**
 * Phase Q4 — Atelier Human Evaluation Sheet (100-case production scale)
 * Reference: mira-vision-platform.html#atelier-q4-eval
 */
(function () {
  const STORAGE_KEY = 'mira-q4-eval-v2';
  const STORAGE_KEY_LEGACY = 'mira-q4-eval-v1';
  const TARGET_CASES = 100;
  const PHASE1_TARGET = 50;
  const PHASE1_MIN_COMPLETE = 25;
  const PHASE1_PASS_RATE_GO = 75;
  const PASS_TARGET = 85;
  const PASS_RATE_TARGET = 85;

  /** 50 سيناريو Q4 Phase 1 — تنوع قطع وألوان (بدون درجات — تُملأ من التطبيق). */
  const PHASE1_SCENARIOS = [
    { id: '001', piece: 'فستان', beforeColor: 'أزرق', afterColor: 'أسود', notes: 'فستان · تحويل داكن' },
    { id: '002', piece: 'فستان', beforeColor: 'أزرق', afterColor: 'أبيض', notes: 'فستان · فاتح على داكن' },
    { id: '003', piece: 'فستان', beforeColor: 'سماوي', afterColor: 'كحلي', notes: 'فستان · أزرق → كحلي' },
    { id: '004', piece: 'فستان', beforeColor: 'أحمر', afterColor: 'أسود', notes: 'فستان · أحمر قوي' },
    { id: '005', piece: 'فستان', beforeColor: 'بيج', afterColor: 'خمري', notes: 'فستان · محايد → خمري' },
    { id: '006', piece: 'فستان', beforeColor: 'خمري', afterColor: 'أخضر زمردي', notes: 'فستان · أخضر' },
    { id: '007', piece: 'فستان', beforeColor: 'أخضر', afterColor: 'أسود', notes: 'فستان · أخضر → أسود' },
    { id: '008', piece: 'بلوزة', beforeColor: 'أبيض', afterColor: 'كحلي', notes: 'بلوزة قطن · upper' },
    { id: '009', piece: 'بلوزة', beforeColor: 'وردي', afterColor: 'نبيتي', notes: 'بلوزة · وردي → نبيتي' },
    { id: '010', piece: 'بلوزة', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'بلوزة · رمادي' },
    { id: '011', piece: 'بلوزة', beforeColor: 'ذهبي', afterColor: 'بيج', notes: 'بلوزة · لامع → مطفي' },
    { id: '012', piece: 'بلوزة', beforeColor: 'أزرق', afterColor: 'تركواز', notes: 'بلوزة · أزرق فاتح' },
    { id: '013', piece: 'بلوزة', beforeColor: 'أسود', afterColor: 'أحمر', notes: 'بلوزة · داكن → أحمر' },
    { id: '014', piece: 'بلوزة', beforeColor: 'كريمي', afterColor: 'زيتوني', notes: 'بلوزة · محايد' },
    { id: '015', piece: 'بلوزة', beforeColor: 'مرجاني', afterColor: 'خمري', notes: 'بلوزة · دافئ' },
    { id: '016', piece: 'بنطلون', beforeColor: 'أسود', afterColor: 'كحلي', notes: 'بنطلون · lower' },
    { id: '017', piece: 'بنطلون', beforeColor: 'بيج', afterColor: 'بني', notes: 'بنطلون · بيج' },
    { id: '018', piece: 'بنطلون', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'بنطلون · رمادي' },
    { id: '019', piece: 'بنطلون', beforeColor: 'أبيض', afterColor: 'زيتوني', notes: 'بنطلون · فاتح' },
    { id: '020', piece: 'بنطلون', beforeColor: 'كحلي', afterColor: 'أسود', notes: 'بنطلون · كحلي' },
    { id: '021', piece: 'جينز', beforeColor: 'دنيم', afterColor: 'أسود', notes: 'جينز · دنيم → أسود' },
    { id: '022', piece: 'جينز', beforeColor: 'دنيم', afterColor: 'كحلي', notes: 'جينز · دنيم فاتح' },
    { id: '023', piece: 'عباءة', beforeColor: 'أسود', afterColor: 'كحلي', notes: 'عباءة · outer · مطفي' },
    { id: '024', piece: 'عباءة', beforeColor: 'بيج', afterColor: 'خمري', notes: 'عباءة · محايد' },
    { id: '025', piece: 'عباءة', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'عباءة · رمادي' },
    { id: '026', piece: 'عباءة', beforeColor: 'أبيض', afterColor: 'كريمي', notes: 'عباءة · فاتح' },
    { id: '027', piece: 'عباءة', beforeColor: 'زيتوني', afterColor: 'أسود', notes: 'عباءة · زيتوني' },
    { id: '028', piece: 'عباءة', beforeColor: 'وردي', afterColor: 'نبيتي', notes: 'عباءة · وردي' },
    { id: '029', piece: 'فستان', beforeColor: 'أسود', afterColor: 'ذهبي', notes: 'فستان سهرة · لامع' },
    { id: '030', piece: 'فستان', beforeColor: 'أبيض', afterColor: 'فضي', notes: 'فستان · فضي' },
    { id: '031', piece: 'فستان', beforeColor: 'كحلي', afterColor: 'أسود', notes: 'فستان · كحلي' },
    { id: '032', piece: 'فستان', beforeColor: 'تركواز', afterColor: 'أزرق', notes: 'فستان · تركواز' },
    { id: '033', piece: 'فستان', beforeColor: 'نبيتي', afterColor: 'أسود', notes: 'فستان · نبيتي' },
    { id: '034', piece: 'فستان', beforeColor: 'زيتوني', afterColor: 'بيج', notes: 'فستان · زيتوني' },
    { id: '035', piece: 'فستان', beforeColor: 'بني', afterColor: 'خمري', notes: 'فستان · بني' },
    { id: '036', piece: 'جاكيت', beforeColor: 'أسود', afterColor: 'كحلي', notes: 'جاكيت · upper' },
    { id: '037', piece: 'جاكيت', beforeColor: 'بيج', afterColor: 'زيتوني', notes: 'جاكيت · محايد' },
    { id: '038', piece: 'جاكيت', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'جاكيت · رمادي' },
    { id: '039', piece: 'جاكيت', beforeColor: 'أحمر', afterColor: 'أسود', notes: 'جاكيت · أحمر' },
    { id: '040', piece: 'جاكيت', beforeColor: 'كحلي', afterColor: 'بني', notes: 'جاكيت · كحلي' },
    { id: '041', piece: 'تنورة', beforeColor: 'أسود', afterColor: 'خمري', notes: 'تنورة · lower' },
    { id: '042', piece: 'تنورة', beforeColor: 'أبيض', afterColor: 'كحلي', notes: 'تنورة · أبيض' },
    { id: '043', piece: 'تنورة', beforeColor: 'بيج', afterColor: 'ذهبي', notes: 'تنورة · بيج' },
    { id: '044', piece: 'تنورة', beforeColor: 'وردي', afterColor: 'نبيتي', notes: 'تنورة · وردي' },
    { id: '045', piece: 'تنورة', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'تنورة · رمادي' },
    { id: '046', piece: 'فستان', beforeColor: 'أصفر', afterColor: 'ذهبي', notes: 'حافة · فاتح → لامع' },
    { id: '047', piece: 'بلوزة', beforeColor: 'أسود', afterColor: 'أبيض', notes: 'حافة · تباين عالي' },
    { id: '048', piece: 'فستان', beforeColor: 'فضي', afterColor: 'أسود', notes: 'حافة · معدني' },
    { id: '049', piece: 'عباءة', beforeColor: 'كحلي', afterColor: 'أسود', notes: 'حافة · عباءة داكنة' },
    { id: '050', piece: 'فستان', beforeColor: 'خمري', afterColor: 'أسود', notes: 'حافة · خمري كلاسيك' },
  ];

  const SEED_CASES = PHASE1_SCENARIOS.slice(0, 7);

  const SCORE_KEYS = ['identity', 'fabric', 'edge', 'shape', 'colorQ', 'realism'];
  const CORE_KEYS = ['identity', 'fabric', 'edge', 'shape'];

  let cases = [];
  let ui = { page: 1, pageSize: 25, filter: 'phase1', search: '' };
  let saveTimer = null;

  function emptyCase(seed) {
    return {
      id: seed?.id || nextId(),
      piece: seed?.piece ?? '',
      beforeColor: seed?.beforeColor ?? '',
      afterColor: seed?.afterColor ?? '',
      beforePath: seed?.beforePath ?? '',
      afterPath: seed?.afterPath ?? '',
      identity: seed?.identity ?? '',
      fabric: seed?.fabric ?? '',
      edge: seed?.edge ?? '',
      shape: seed?.shape ?? '',
      colorQ: seed?.colorQ ?? '',
      realism: seed?.realism ?? '',
      final: seed?.final || 'pending',
      qelScore: seed?.qelScore ?? '',
      qelGate: seed?.qelGate || 'pending',
      notes: seed?.notes ?? '',
    };
  }

  function build50Phase1Template() {
    return PHASE1_SCENARIOS.map((s) =>
      emptyCase({
        id: s.id,
        piece: s.piece,
        beforeColor: s.beforeColor,
        afterColor: s.afterColor,
        beforePath: `~/qel-dataset/${s.id}/before.jpg`,
        afterPath: `~/qel-dataset/${s.id}/after.jpg`,
        notes: s.notes || '',
      }),
    );
  }

  function build100Template() {
    const rows = [];
    for (let i = 1; i <= TARGET_CASES; i++) {
      const id = String(i).padStart(3, '0');
      const seed = SEED_CASES.find((s) => s.id === id);
      rows.push(
        emptyCase({
          id,
          piece: seed?.piece ?? '',
          beforeColor: seed?.beforeColor ?? '',
          afterColor: seed?.afterColor ?? '',
          beforePath: `~/qel-dataset/${id}/before.jpg`,
          afterPath: `~/qel-dataset/${id}/after.jpg`,
        }),
      );
    }
    return rows;
  }

  function build7Seed() {
    return SEED_CASES.map((s) => emptyCase(s));
  }

  function nextId() {
    const nums = cases.map((c) => parseInt(c.id, 10)).filter((n) => !Number.isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1).padStart(3, '0');
  }

  function parseScore(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1 || n > 10) return null;
    return n;
  }

  function coreAverage(row) {
    const vals = CORE_KEYS.map((k) => parseScore(row[k])).filter((v) => v !== null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }

  function rowStatus(row) {
    const hasPaths = Boolean(row.beforePath?.trim() && row.afterPath?.trim());
    const hasCore = CORE_KEYS.every((k) => parseScore(row[k]) !== null);
    const hasFinal = row.final === 'pass' || row.final === 'fail';
    if (hasPaths && hasCore && hasFinal) return 'complete';
    if (hasPaths || hasCore || hasFinal) return 'partial';
    return 'empty';
  }

  function identityFail(row) {
    const id = parseScore(row.identity);
    return id !== null && id < 6;
  }

  function qelAgrees(row) {
    if (row.final !== 'pass' && row.final !== 'fail') return null;
    if (row.qelGate !== 'pass' && row.qelGate !== 'fail') return null;
    return (row.final === 'pass') === (row.qelGate === 'pass');
  }

  function suggestFinal(row) {
    const id = parseScore(row.identity);
    const fab = parseScore(row.fabric);
    const edge = parseScore(row.edge);
    const shape = parseScore(row.shape);
    if (id === null && fab === null && edge === null && shape === null) return 'pending';
    if (id !== null && id < 6) return 'fail';
    if (fab !== null && fab < 5) return 'fail';
    if (edge !== null && edge < 5) return 'fail';
    if (shape !== null && shape < 5) return 'fail';
    if (
      id !== null &&
      fab !== null &&
      edge !== null &&
      shape !== null &&
      id >= 6 &&
      fab >= 5 &&
      edge >= 5 &&
      shape >= 5
    ) {
      return 'pass';
    }
    const core = coreAverage(row);
    if (core !== null && core >= 6.5 && (id === null || id >= 6)) return 'pass';
    if (core !== null && core < 5.5) return 'fail';
    return 'pending';
  }

  function load() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem(STORAGE_KEY_LEGACY);
        if (raw) localStorage.setItem(STORAGE_KEY, raw);
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          cases = parsed.map((c) => emptyCase(c));
          return;
        }
      }
    } catch (_) {
      /* ignore */
    }
    cases = build50Phase1Template();
  }

  function phase1Cases() {
    return cases.filter((c) => {
      const n = parseInt(c.id, 10);
      return !Number.isNaN(n) && n >= 1 && n <= PHASE1_TARGET;
    });
  }

  function computePhase1Stats() {
    const subset = phase1Cases();
    const complete = subset.filter((c) => rowStatus(c) === 'complete').length;
    const evaluated = subset.filter((c) => c.final === 'pass' || c.final === 'fail');
    const pass = subset.filter((c) => c.final === 'pass').length;
    const fail = subset.filter((c) => c.final === 'fail').length;
    const rate = evaluated.length ? Math.round((pass / evaluated.length) * 1000) / 10 : null;
    const identityFails = subset.filter(identityFail).length;
    const qelPairs = subset.map(qelAgrees).filter((v) => v !== null);
    const qelAgree = qelPairs.filter(Boolean).length;
    const qelRate = qelPairs.length ? Math.round((qelAgree / qelPairs.length) * 1000) / 10 : null;

    let decision = 'pending';
    let decisionClass = 'pending';
    let decisionDetail = `أكملي ${PHASE1_MIN_COMPLETE} Case على الأقل في 001–050`;

    if (complete >= PHASE1_MIN_COMPLETE) {
      if (rate !== null && rate >= PHASE1_PASS_RATE_GO) {
        decision = 'go';
        decisionClass = 'go';
        decisionDetail = `✅ متابعة إلى 100 — ${complete}/50 مكتمل · ${rate}% PASS`;
      } else if (rate !== null) {
        decision = 'no-go';
        decisionClass = 'no-go';
        decisionDetail = `⛔ أوقفي — اضبطي QEL/prompt قبل 100 (${rate}% < ${PHASE1_PASS_RATE_GO}%)`;
      }
    } else if (complete > 0) {
      decisionDetail = `⏳ ${complete}/${PHASE1_MIN_COMPLETE} مكتمل — استمري حتى ${PHASE1_MIN_COMPLETE}`;
    }

    return {
      complete,
      evaluated: evaluated.length,
      pass,
      fail,
      rate,
      identityFails,
      qelRate,
      decision,
      decisionClass,
      decisionDetail,
      pctComplete: Math.round((complete / PHASE1_TARGET) * 100),
    };
  }

  function renderPhase1Live() {
    const p1 = computePhase1Stats();
    const el = (id) => document.getElementById(id);
    if (el('q4-p1-complete')) el('q4-p1-complete').textContent = `${p1.complete} / ${PHASE1_TARGET}`;
    if (el('q4-p1-pass')) el('q4-p1-pass').textContent = String(p1.pass);
    if (el('q4-p1-rate')) el('q4-p1-rate').textContent = p1.rate !== null ? p1.rate + '%' : '—';
    if (el('q4-p1-identity')) el('q4-p1-identity').textContent = String(p1.identityFails);
    if (el('q4-p1-qel')) el('q4-p1-qel').textContent = p1.qelRate !== null ? p1.qelRate + '%' : '—';
    if (el('q4-p1-progress-fill')) {
      el('q4-p1-progress-fill').style.width = p1.pctComplete + '%';
    }
    const dec = el('q4-p1-decision');
    if (dec) {
      dec.className = 'q4-p1-decision ' + p1.decisionClass;
      dec.textContent = p1.decisionDetail;
    }
    const proof = el('q4-p1-proof-live');
    if (proof) {
      const ts = new Date().toLocaleString('ar-SA');
      proof.innerHTML =
        `<strong>إثبات حي من السجل</strong> — آخر تحديث: ${ts}<br />` +
        `Cases 001–050: مكتمل <strong>${p1.complete}</strong> · PASS <strong>${p1.pass}</strong> · FAIL <strong>${p1.fail}</strong> · ` +
        `Pass Rate <strong>${p1.rate ?? '—'}%</strong> · Identity Fail <strong>${p1.identityFails}</strong> · ` +
        `QEL↔Human <strong>${p1.qelRate ?? '—'}%</strong>`;
    }
  }

  window.refreshQ4Phase1Live = renderPhase1Live;

  function saveNow() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  }

  function saveDebounced() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 280);
  }

  function findCaseIndex(id) {
    return cases.findIndex((c) => c.id === id);
  }

  function filteredCases() {
    const q = ui.search.trim().toLowerCase();
    return cases.filter((row) => {
      if (q) {
        const hay = [row.id, row.piece, row.beforeColor, row.afterColor, row.notes, row.beforePath, row.afterPath]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const st = rowStatus(row);
      switch (ui.filter) {
        case 'phase1':
          return parseInt(row.id, 10) >= 1 && parseInt(row.id, 10) <= PHASE1_TARGET;
        case 'complete':
          return st === 'complete';
        case 'incomplete':
          return st !== 'complete';
        case 'pass':
          return row.final === 'pass';
        case 'fail':
          return row.final === 'fail';
        case 'pending':
          return row.final === 'pending';
        case 'identity-fail':
          return identityFail(row);
        case 'no-paths':
          return !row.beforePath?.trim() || !row.afterPath?.trim();
        default:
          return true;
      }
    });
  }

  function computeStats() {
    const complete = cases.filter((c) => rowStatus(c) === 'complete').length;
    const evaluated = cases.filter((c) => c.final === 'pass' || c.final === 'fail');
    const pass = cases.filter((c) => c.final === 'pass').length;
    const fail = cases.filter((c) => c.final === 'fail').length;
    const pending = cases.length - pass - fail;
    const rate = evaluated.length ? Math.round((pass / evaluated.length) * 1000) / 10 : null;

    const avgScored = (key) => {
      const vals = cases.map((c) => parseScore(c[key])).filter((v) => v !== null);
      if (!vals.length) return null;
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    };

    const identityFails = cases.filter(identityFail).length;
    const qelPairs = cases.map(qelAgrees).filter((v) => v !== null);
    const qelAgree = qelPairs.filter(Boolean).length;
    const qelRate = qelPairs.length ? Math.round((qelAgree / qelPairs.length) * 1000) / 10 : null;

    const launchReady =
      cases.length >= TARGET_CASES &&
      complete >= TARGET_CASES &&
      pass >= PASS_TARGET &&
      rate !== null &&
      rate >= PASS_RATE_TARGET;

    let verdict = 'قيد التجميع';
    let verdictClass = '';
    if (rate !== null && evaluated.length >= TARGET_CASES) {
      if (rate >= PASS_RATE_TARGET) {
        verdict = 'ممتاز — جاهز للتوسع A+';
        verdictClass = 'excellent';
      } else if (rate >= 75) {
        verdict = 'جيد — يحتاج تحسين QEL';
        verdictClass = 'good';
      } else {
        verdict = 'لا تطلق — أقل من 75%';
        verdictClass = 'block';
      }
    } else if (evaluated.length > 0) {
      verdict = `تجميع ${evaluated.length}/${TARGET_CASES}`;
      verdictClass = 'good';
    }

    return {
      total: cases.length,
      complete,
      pass,
      fail,
      pending,
      rate,
      avgScored,
      identityFails,
      qelRate,
      qelAgree,
      qelPairs: qelPairs.length,
      launchReady,
      verdict,
      verdictClass,
    };
  }

  function avgCoreScored() {
    const vals = cases.map((c) => coreAverage(c)).filter((v) => v !== null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }

  function scoreDistribution(key) {
    const buckets = Array(10).fill(0);
    cases.forEach((c) => {
      const s = parseScore(c[key]);
      if (s !== null) buckets[s - 1]++;
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((n, i) => ({ score: i + 1, n, pct: Math.round((n / max) * 100) }));
  }

  function renderProgress(s) {
    const pct = Math.min(100, Math.round((s.complete / TARGET_CASES) * 100));
    const fill = document.getElementById('q4-progress-fill');
    const text = document.getElementById('q4-progress-text');
    const target = document.getElementById('q4-pass-target');
    if (fill) {
      fill.style.width = pct + '%';
      fill.className = 'q4-progress-fill' + (pct >= 100 ? ' ok' : '');
    }
    if (text) text.textContent = `التقدّم: ${s.complete} / ${TARGET_CASES} مكتمل (${pct}%)`;
    if (target) target.textContent = `هدف PASS: ${s.pass} / ${PASS_TARGET}`;

    const badge = document.getElementById('q4-launch-badge');
    if (badge) {
      if (s.launchReady) {
        badge.innerHTML =
          '<span class="q4-launch-badge ready">✅ جاهز للإطلاق — 100/100 مكتمل · ≥85% PASS</span>';
      } else {
        const missing = Math.max(0, TARGET_CASES - s.complete);
        const passGap = Math.max(0, PASS_TARGET - s.pass);
        badge.innerHTML = `<span class="q4-launch-badge not-ready">⏳ غير جاهز — ${missing} Case ناقص · ${passGap} PASS إضافي مطلوب</span>`;
      }
    }
  }

  function renderStats() {
    const s = computeStats();
    renderProgress(s);

    const statsEl = document.getElementById('q4-eval-stats');
    const benchEl = document.getElementById('q4-eval-benchmark');
    const distEl = document.getElementById('q4-eval-distribution');
    if (!statsEl) return;

    const rateClass = s.rate === null ? '' : s.rate >= PASS_RATE_TARGET ? 'ok' : s.rate >= 75 ? 'warn' : 'bad';

    statsEl.innerHTML = [
      ['Cases', `${s.total}/${TARGET_CASES}`, s.total >= TARGET_CASES ? 'ok' : 'warn'],
      ['مكتمل ✓', s.complete, s.complete >= TARGET_CASES ? 'ok' : ''],
      ['PASS', s.pass, 'ok'],
      ['FAIL', s.fail, s.fail ? 'bad' : ''],
      ['Pending', s.pending, ''],
      ['Pass Rate', s.rate !== null ? s.rate + '%' : '—', rateClass],
      ['Identity Fail', s.identityFails, s.identityFails ? 'bad' : 'ok'],
      ['QEL توافق', s.qelRate !== null ? s.qelRate + '%' : '—', ''],
      ['Avg Identity', s.avgScored('identity') ?? '—', ''],
      ['Avg Core Ø', avgCoreScored() ?? '—', ''],
    ]
      .map(
        ([lbl, val, cls]) =>
          `<div class="q4-stat ${cls}"><span class="val">${val}</span><span class="lbl">${lbl}</span></div>`,
      )
      .join('');

    if (benchEl) {
      benchEl.innerHTML = `
        <div class="bench excellent"><strong>≥ ${PASS_RATE_TARGET}% PASS</strong><br />ممتاز — baseline Q4 مقبول (≥${PASS_TARGET}/${TARGET_CASES})</div>
        <div class="bench good"><strong>75–84%</strong><br />جيد — ضبط threshold / prompt</div>
        <div class="bench block"><strong>&lt; 75%</strong><br />لا تطلق A+ / beta واسع</div>
        <div class="bench ${s.verdictClass}"><strong>الحكم الحالي</strong><br />${s.verdict}${s.rate !== null ? ` (${s.rate}%)` : ''}</div>`;
    }

    if (distEl) {
      distEl.innerHTML = CORE_KEYS.map((key) => {
        const dist = scoreDistribution(key);
        const labeled = { identity: 'Identity', fabric: 'Fabric', edge: 'Edge', shape: 'Shape' }[key];
        const bars = dist
          .filter((d) => d.n > 0)
          .map(
            (d) =>
              `<div class="bar-row"><span>${d.score}</span><div class="bar"><div class="bar-fill" style="width:${d.pct}%"></div></div><span>${d.n}</span></div>`,
          )
          .join('');
        return `<div class="q4-dist-card"><strong>${labeled}</strong>${bars || '<div style="color:var(--muted);margin-top:6px">لا بيانات</div>'}</div>`;
      }).join('');
    }
    renderPhase1Live();
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function renderTable() {
    const tbody = document.getElementById('q4-eval-tbody');
    if (!tbody) return;

    const visible = filteredCases();
    const totalPages = Math.max(1, Math.ceil(visible.length / ui.pageSize));
    if (ui.page > totalPages) ui.page = totalPages;

    const start = (ui.page - 1) * ui.pageSize;
    const pageRows = visible.slice(start, start + ui.pageSize);

    const countEl = document.getElementById('q4-filter-count');
    if (countEl) {
      countEl.textContent = `عرض ${pageRows.length} من ${visible.length} (إجمالي ${cases.length})`;
    }

    tbody.innerHTML = pageRows
      .map((row) => {
        const st = rowStatus(row);
        const rowClass = [
          row.final === 'pass' ? 'row-pass' : row.final === 'fail' ? 'row-fail' : '',
          st === 'complete' ? 'row-complete' : st === 'partial' ? 'row-incomplete' : '',
          identityFail(row) ? 'row-warn' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const core = coreAverage(row);
        const scoreCells = SCORE_KEYS.map(
          (k) =>
            `<td><input type="number" class="score" min="1" max="10" step="1" data-case-id="${esc(row.id)}" data-field="${k}" value="${row[k] !== '' && row[k] !== null ? row[k] : ''}" placeholder="—" /></td>`,
        ).join('');

        const dotClass = st === 'complete' ? 'complete' : st === 'partial' ? 'partial' : 'empty';

        return `<tr class="${rowClass}" data-case-id="${esc(row.id)}">
          <td class="sticky-id">${esc(row.id)}<span class="q4-status-dot ${dotClass}" title="${st}"></span></td>
          <td><input type="text" data-case-id="${esc(row.id)}" data-field="piece" value="${esc(row.piece)}" /></td>
          <td><input type="text" data-case-id="${esc(row.id)}" data-field="beforeColor" value="${esc(row.beforeColor)}" /></td>
          <td><input type="text" data-case-id="${esc(row.id)}" data-field="afterColor" value="${esc(row.afterColor)}" /></td>
          <td><input type="text" class="path" data-case-id="${esc(row.id)}" data-field="beforePath" value="${esc(row.beforePath)}" placeholder="~/qel-dataset/001/before.jpg" /></td>
          <td><input type="text" class="path" data-case-id="${esc(row.id)}" data-field="afterPath" value="${esc(row.afterPath)}" placeholder="~/qel-dataset/001/after.jpg" /></td>
          ${scoreCells}
          <td>
            <select data-case-id="${esc(row.id)}" data-field="final">
              <option value="pending" ${row.final === 'pending' ? 'selected' : ''}>—</option>
              <option value="pass" ${row.final === 'pass' ? 'selected' : ''}>PASS</option>
              <option value="fail" ${row.final === 'fail' ? 'selected' : ''}>FAIL</option>
            </select>
          </td>
          <td><input type="number" class="score" min="0" max="1" step="0.001" data-case-id="${esc(row.id)}" data-field="qelScore" value="${row.qelScore !== '' ? row.qelScore : ''}" placeholder="0.85" /></td>
          <td>
            <select data-case-id="${esc(row.id)}" data-field="qelGate">
              <option value="pending" ${row.qelGate === 'pending' ? 'selected' : ''}>—</option>
              <option value="pass" ${row.qelGate === 'pass' ? 'selected' : ''}>Accept</option>
              <option value="fail" ${row.qelGate === 'fail' ? 'selected' : ''}>422</option>
              <option value="na" ${row.qelGate === 'na' ? 'selected' : ''}>N/A</option>
            </select>
          </td>
          <td class="core-cell"><strong>${core ?? '—'}</strong></td>
          <td><input type="text" data-case-id="${esc(row.id)}" data-field="notes" value="${esc(row.notes)}" style="max-width:120px" placeholder="ملاحظات" /></td>
          <td><button type="button" class="btn btn-secondary q4-del" data-case-id="${esc(row.id)}" style="padding:4px 8px;font-size:0.75rem">✕</button></td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('change', onCellChange);
      el.addEventListener('input', onCellChange);
    });
    tbody.querySelectorAll('.q4-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.caseId;
        if (cases.length <= 1) return;
        const i = findCaseIndex(id);
        if (i < 0) return;
        cases.splice(i, 1);
        saveNow();
        renderAll();
      });
    });

    renderPagination(visible.length, totalPages);
    renderStats();
  }

  function renderPagination(totalVisible, totalPages) {
    const el = document.getElementById('q4-pagination');
    if (!el) return;

    const pages = [];
    const maxButtons = 7;
    let startPage = Math.max(1, ui.page - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    startPage = Math.max(1, endPage - maxButtons + 1);

    for (let p = startPage; p <= endPage; p++) {
      pages.push(
        `<button type="button" class="page-btn ${p === ui.page ? 'active' : ''}" data-page="${p}">${p}</button>`,
      );
    }

    el.innerHTML = `
      <div>
        <button type="button" class="page-btn" data-page="prev" ${ui.page <= 1 ? 'disabled' : ''}>← السابق</button>
        <button type="button" class="page-btn" data-page="next" ${ui.page >= totalPages ? 'disabled' : ''}>التالي →</button>
      </div>
      <div class="pages">${pages.join('')}</div>
      <span>صفحة ${ui.page} / ${totalPages}</span>`;

    el.querySelectorAll('.page-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.page;
        if (p === 'prev') ui.page = Math.max(1, ui.page - 1);
        else if (p === 'next') ui.page = Math.min(totalPages, ui.page + 1);
        else ui.page = Number(p);
        renderTable();
        document.getElementById('q4-eval-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function onCellChange(e) {
    const el = e.target;
    const id = el.dataset.caseId;
    const field = el.dataset.field;
    const idx = findCaseIndex(id);
    if (idx < 0 || !field) return;
    cases[idx][field] = el.value;
    saveDebounced();

    if (SCORE_KEYS.includes(field) || field === 'final') {
      renderStats();
      const coreCell = document.querySelector(`tr[data-case-id="${CSS.escape(id)}"] .core-cell strong`);
      if (coreCell) coreCell.textContent = coreAverage(cases[idx]) ?? '—';
    }
  }

  function renderLegend() {
    const el = document.getElementById('q4-eval-legend');
    if (!el) return;
    el.innerHTML = `
      <p><strong>قواعد التقييم — 100 صورة (Human):</strong></p>
      <ul style="margin:8px 0;padding-right:20px;line-height:1.85">
        <li><strong>الهدف:</strong> ${TARGET_CASES} Case حقيقية · ≥ <strong>${PASS_TARGET} PASS</strong> (${PASS_RATE_TARGET}%) للإطلاق.</li>
        <li><strong>Identity</strong> — وجه · جسم · يدين · إضاءة: أي تغيّر = Fail مباشر (&lt;6/10).</li>
        <li><strong>Fabric · Edge · Shape</strong> — حرجة (≥5/10) · Color · Realism ثانوية إذا Core ناجح.</li>
        <li><strong>مكتمل ✓</strong> = مسارات Before+After + 4 درجات Core + Final PASS/FAIL.</li>
        <li><strong>هيكل المجلد:</strong> <code>~/qel-dataset/001/before.jpg</code> + <code>after.jpg</code> … حتى 100.</li>
        <li><strong>QEL Score/Gate</strong> — من شارة التطبيق بعد «تطبيق التلوين».</li>
      </ul>
      <p style="margin-top:10px"><strong>Workflow:</strong> «إنشاء قالب 100» → جرّبي في التطبيق → املئي الدرجات → Export manifest → <code>QEL_CALIBRATION_DATASET=~/qel-manifest.json npm run test:qel-calibration</code></p>`;
  }

  function renderAll() {
    renderTable();
    renderLegend();
  }

  function exportCsv() {
    const headers = [
      'ID',
      'Piece',
      'BeforeColor',
      'AfterColor',
      'BeforePath',
      'AfterPath',
      'Identity',
      'Fabric',
      'Edge',
      'Shape',
      'Color',
      'Realism',
      'CoreAvg',
      'Final',
      'QELScore',
      'QELGate',
      'Status',
      'Notes',
    ];
    const rows = cases.map((c) =>
      [
        c.id,
        c.piece,
        c.beforeColor,
        c.afterColor,
        c.beforePath,
        c.afterPath,
        c.identity,
        c.fabric,
        c.edge,
        c.shape,
        c.colorQ,
        c.realism,
        coreAverage(c) ?? '',
        c.final,
        c.qelScore,
        c.qelGate,
        rowStatus(c),
        c.notes,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
    const s = computeStats();
    const meta = `# MIRA Q4 Eval · ${cases.length} cases · complete ${s.complete}/${TARGET_CASES} · pass ${s.pass} · rate ${s.rate ?? 'n/a'}%\n`;
    download('mira-q4-atelier-100eval.csv', '\uFEFF' + meta + headers.join(',') + '\n' + rows.join('\n'), 'text/csv');
  }

  function exportManifest() {
    const entries = cases
      .filter((c) => c.beforePath && c.afterPath && (c.final === 'pass' || c.final === 'fail'))
      .map((c) => ({
        id: `${c.id}-${slug(c.beforeColor)}-${slug(c.afterColor)}`,
        humanAccept: c.final === 'pass',
        originalPath: c.beforePath,
        editedPath: c.afterPath,
        humanScores: {
          identity: parseScore(c.identity),
          fabric: parseScore(c.fabric),
          edge: parseScore(c.edge),
          shape: parseScore(c.shape),
          color: parseScore(c.colorQ),
          realism: parseScore(c.realism),
        },
        qelScore: c.qelScore !== '' ? Number(c.qelScore) : null,
        qelGate: c.qelGate,
        notes: c.notes,
        visionContext: {
          regionRole: 'upper',
          garmentLabelAr: c.piece || 'فستان',
        },
      }));

    const s = computeStats();
    const manifest = {
      schemaVersion: 'qel-evaluation-manifest.v1',
      exportedAt: new Date().toISOString(),
      description: `MIRA Atelier Q4 — ${cases.length} cases · ${entries.length} labeled · pass rate ${s.rate ?? 'n/a'}%`,
      targetCases: TARGET_CASES,
      passTarget: PASS_TARGET,
      stats: {
        total: cases.length,
        complete: s.complete,
        pass: s.pass,
        fail: s.fail,
        passRate: s.rate,
        identityFails: s.identityFails,
        qelAgreementRate: s.qelRate,
      },
      entries,
    };
    download('qel-manifest-100.json', JSON.stringify(manifest, null, 2), 'application/json');
  }

  function slug(s) {
    return String(s || 'na')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 24) || 'na';
  }

  function download(name, body, type) {
    const blob = new Blob([body], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportPathTemplate() {
    const headers = 'ID,Piece,BeforeColor,AfterColor,BeforePath,AfterPath\n';
    const rows = [];
    for (let i = 1; i <= TARGET_CASES; i++) {
      const id = String(i).padStart(3, '0');
      const seed = SEED_CASES.find((s) => s.id === id);
      rows.push(
        [
          id,
          seed?.piece || '',
          seed?.beforeColor || '',
          seed?.afterColor || '',
          `~/qel-dataset/${id}/before.jpg`,
          `~/qel-dataset/${id}/after.jpg`,
        ].join(','),
      );
    }
    download('qel-100-paths-template.csv', '\uFEFF' + headers + rows.join('\n'), 'text/csv');
  }

  function applySuggestAll() {
    cases.forEach((c) => {
      const s = suggestFinal(c);
      if (s !== 'pending') c.final = s;
    });
    saveNow();
    renderAll();
  }

  function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function importCsvPaths(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
    if (!lines.length) throw new Error('empty');
    const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const idIdx = header.findIndex((h) => h === 'id');
    const bPathIdx = header.findIndex((h) => h.includes('beforepath') || h === 'before_path');
    const aPathIdx = header.findIndex((h) => h.includes('afterpath') || h === 'after_path');
    const pieceIdx = header.findIndex((h) => h === 'piece');
    const bColIdx = header.findIndex((h) => h === 'beforecolor' || h === 'before');
    const aColIdx = header.findIndex((h) => h === 'aftercolor' || h === 'after');

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const id = (idIdx >= 0 ? cols[idIdx] : cols[0])?.trim().padStart(3, '0');
      if (!id) continue;
      let row = cases.find((c) => c.id === id);
      if (!row) {
        row = emptyCase({ id });
        cases.push(row);
      }
      if (bPathIdx >= 0 && cols[bPathIdx]) row.beforePath = cols[bPathIdx].trim();
      if (aPathIdx >= 0 && cols[aPathIdx]) row.afterPath = cols[aPathIdx].trim();
      if (pieceIdx >= 0 && cols[pieceIdx]) row.piece = cols[pieceIdx].trim();
      if (bColIdx >= 0 && cols[bColIdx]) row.beforeColor = cols[bColIdx].trim();
      if (aColIdx >= 0 && cols[aColIdx]) row.afterColor = cols[aColIdx].trim();
    }
    cases.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
    saveNow();
    renderAll();
  }

  function importJson(data) {
    const list = Array.isArray(data) ? data : data.entries || data.cases;
    if (!Array.isArray(list) || !list.length) throw new Error('empty');
    cases = list.map((c) =>
      emptyCase({
        id: String(c.id || '').split('-')[0] || c.id,
        piece: c.piece || c.visionContext?.garmentLabelAr || '',
        beforeColor: c.beforeColor || '',
        afterColor: c.afterColor || '',
        beforePath: c.originalPath || c.beforePath || '',
        afterPath: c.editedPath || c.afterPath || '',
        identity: c.humanScores?.identity ?? c.identity ?? '',
        fabric: c.humanScores?.fabric ?? c.fabric ?? '',
        edge: c.humanScores?.edge ?? c.edge ?? '',
        shape: c.humanScores?.shape ?? c.shape ?? '',
        colorQ: c.humanScores?.color ?? c.colorQ ?? '',
        realism: c.humanScores?.realism ?? c.realism ?? '',
        final: c.humanAccept === true ? 'pass' : c.humanAccept === false ? 'fail' : c.final || 'pending',
        qelScore: c.qelScore ?? '',
        qelGate: c.qelGate || 'pending',
        notes: c.notes || '',
      }),
    );
    saveNow();
    renderAll();
  }

  function exportManifestPhase1() {
    const prev = cases;
    const subset = phase1Cases().filter(
      (c) => c.beforePath && c.afterPath && (c.final === 'pass' || c.final === 'fail'),
    );
    const p1 = computePhase1Stats();
    const entries = subset.map((c) => ({
      id: `${c.id}-${slug(c.beforeColor)}-${slug(c.afterColor)}`,
      humanAccept: c.final === 'pass',
      originalPath: c.beforePath,
      editedPath: c.afterPath,
      humanScores: {
        identity: parseScore(c.identity),
        fabric: parseScore(c.fabric),
        edge: parseScore(c.edge),
        shape: parseScore(c.shape),
        color: parseScore(c.colorQ),
        realism: parseScore(c.realism),
      },
      qelScore: c.qelScore !== '' ? Number(c.qelScore) : null,
      qelGate: c.qelGate,
      notes: c.notes,
      visionContext: { regionRole: 'upper', garmentLabelAr: c.piece || 'فستان' },
    }));
    const manifest = {
      schemaVersion: 'qel-evaluation-manifest.v1',
      phase: 'Q4-P1',
      exportedAt: new Date().toISOString(),
      description: `Q4 Phase 1 — cases 001-050 · ${entries.length} labeled`,
      phase1Stats: p1,
      entries,
    };
    download('qel-manifest-phase1-050.json', JSON.stringify(manifest, null, 2), 'application/json');
    void prev;
  }

  function bindToolbar() {
    document.getElementById('q4-btn-init50')?.addEventListener('click', () => {
      if (
        !confirm(
          'إنشاء قالب Q4 Phase 1 — 50 Case (001–050)؟ سيتم استبدال الجدول الحالي.',
        )
      )
        return;
      cases = build50Phase1Template();
      saveNow();
      ui.page = 1;
      ui.filter = 'phase1';
      renderAll();
    });

    document.getElementById('q4-btn-export-p1')?.addEventListener('click', exportManifestPhase1);

    document.getElementById('q4-btn-init100')?.addEventListener('click', () => {
      const msg =
        cases.length > 7
          ? `إنشاء قالب ${TARGET_CASES} Case؟ سيتم استبدال الجدول الحالي (${cases.length} صف).`
          : `إنشاء قالب ${TARGET_CASES} Case مع مسارات ~/qel-dataset/001…100؟`;
      if (!confirm(msg)) return;
      cases = build100Template();
      saveNow();
      ui.page = 1;
      renderAll();
    });

    document.getElementById('q4-btn-add')?.addEventListener('click', () => {
      cases.push(emptyCase({ id: nextId() }));
      saveNow();
      ui.page = Math.ceil(cases.length / ui.pageSize);
      renderAll();
    });

    document.getElementById('q4-btn-export-template')?.addEventListener('click', exportPathTemplate);
    document.getElementById('q4-btn-export-csv')?.addEventListener('click', exportCsv);
    document.getElementById('q4-btn-export-manifest')?.addEventListener('click', exportManifest);

    document.getElementById('q4-btn-reset7')?.addEventListener('click', () => {
      if (confirm('إعادة الجدول إلى 7 Cases الأساسية؟ سيتم مسح التعديلات المحفوظة.')) {
        cases = build7Seed();
        saveNow();
        ui.page = 1;
        renderAll();
      }
    });

    const fileInput = document.getElementById('q4-import-file');
    document.getElementById('q4-btn-import')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importJson(JSON.parse(reader.result));
        } catch (_) {
          alert('تعذّر استيراد الملف — تأكدي من JSON صالح');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    const csvInput = document.getElementById('q4-import-csv-file');
    document.getElementById('q4-btn-import-csv')?.addEventListener('click', () => csvInput?.click());
    csvInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importCsvPaths(reader.result);
        } catch (_) {
          alert('تعذّر استيراد CSV — الأعمدة: ID, BeforePath, AfterPath');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('q4-search')?.addEventListener('input', (e) => {
      ui.search = e.target.value;
      ui.page = 1;
      renderTable();
    });

    document.getElementById('q4-filter')?.addEventListener('change', (e) => {
      ui.filter = e.target.value;
      ui.page = 1;
      renderTable();
    });

    document.getElementById('q4-page-size')?.addEventListener('change', (e) => {
      ui.pageSize = Number(e.target.value) || 25;
      ui.page = 1;
      renderTable();
    });
  }

  window.initQ4EvalSheet = function () {
    if (!document.getElementById('q4-eval-tbody')) return;
    load();
    bindToolbar();
    renderAll();
    if (window.initQ4Phase1) window.initQ4Phase1();
  };

  window.getQ4Phase1Stats = computePhase1Stats;
  window.Q4_PHASE1_SCENARIOS = PHASE1_SCENARIOS;
})();
