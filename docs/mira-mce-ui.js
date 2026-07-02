/**
 * MIRA Consultation Engine — واجهة تفاعلية
 * يعتمد على window.MIRA_MCE فقط
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2800);
  }

  let activePhase = 1;
  let activeLayer = 'flutter';
  let demoIntent = 'skin_hydration';
  let demoQuestionIdx = 0;
  let riskFilter = 'all';

  function renderHero() {
    const M = window.MIRA_MCE;
    if (!M) return;
    const el = document.getElementById('mce-hero-stats');
    if (!el) return;
    el.innerHTML = `
      <div class="mce-stat"><span class="v">${M.PHASES.length}</span><span class="l">مراحل تنفيذ</span></div>
      <div class="mce-stat"><span class="v">${M.ENDPOINTS.length}</span><span class="l">نقاط API</span></div>
      <div class="mce-stat"><span class="v">4</span><span class="l">طبقات معمارية</span></div>
      <div class="mce-stat"><span class="v">~4k</span><span class="l">توكن/دورة مستهدف</span></div>
      <div class="mce-stat warn"><span class="v">${M.VERDICT.score}/10</span><span class="l">ملاءمة استراتيجية</span></div>`;
  }

  function renderVerdict() {
    const V = window.MIRA_MCE?.VERDICT;
    const el = document.getElementById('mce-verdict');
    if (!V || !el) return;
    el.innerHTML = `
      <div class="mce-verdict-box">
        <h4>الحكم المعماري</h4>
        <p class="mce-verdict-label">${esc(V.labelAr)}</p>
        <p style="font-size:0.9rem;line-height:1.85;margin:12px 0">${esc(V.summaryAr)}</p>
        <div class="mce-pillar-grid">${V.pillarsAr
          .map(
            (p) => `<div class="mce-pillar">
              <span class="ico">${p.icon}</span>
              <strong>${esc(p.title)}</strong>
              <p>${esc(p.body)}</p>
            </div>`,
          )
          .join('')}</div>
      </div>`;
  }

  function renderGoldenRules() {
    const rules = window.MIRA_MCE?.GOLDEN_RULES || [];
    const el = document.getElementById('mce-golden-rules');
    if (!el) return;
    el.innerHTML = rules
      .map(
        (r, i) => `<div class="mce-rule-card" data-rule="${i}">
          <div class="mce-rule-head">
            <span class="mce-rule-num">${i + 1}</span>
            <strong>${esc(r.titleAr)}</strong>
          </div>
          <p>${esc(r.bodyAr)}</p>
          <div class="mce-forbidden">⛔ ممنوع: ${esc(r.forbiddenAr)}</div>
        </div>`,
      )
      .join('');
    el.querySelectorAll('.mce-rule-card').forEach((card) => {
      card.addEventListener('click', () => {
        card.classList.toggle('open');
      });
    });
  }

  function renderPipeline() {
    const el = document.getElementById('mce-pipeline');
    if (!el) return;
    el.innerHTML = `<pre class="mce-pipeline-pre">صورة المستخدمة
    ↓
① محركات التحليل (موجودة — لا تُعاد)
   Perfect Corp → تقرير البشرة
   FASHN Geometry + OpenAI Semantic → إطلالة
   FASHN Edit + QEL → تلوين Atelier
    ↓
② لقطة سياق (Context Snapshot) — معرّف ثابت · حقائق مُوقَّعة
    ↓
③ MCE — OpenAI يشرح ويستشير فقط (لا رؤية · لا FASHN)
    ↓
④ إجابة + استشهادات + أسئلة متابعة + (اختياري) توصيات</pre>`;
  }

  function renderLayerTabs() {
    const el = document.getElementById('mce-layer-tabs');
    if (!el) return;
    const layers = window.MIRA_MCE?.LAYERS || {};
    el.innerHTML = Object.keys(layers)
      .map(
        (k) =>
          `<button type="button" class="mce-tab-btn ${k === activeLayer ? 'active' : ''}" data-layer="${k}">${layers[k].icon} ${esc(layers[k].titleAr)}</button>`,
      )
      .join('');
    el.querySelectorAll('.mce-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeLayer = btn.dataset.layer;
        renderLayerTabs();
        renderLayerPanel();
      });
    });
  }

  function renderLayerPanel() {
    const L = window.MIRA_MCE?.LAYERS?.[activeLayer];
    const el = document.getElementById('mce-layer-panel');
    if (!L || !el) return;
    el.innerHTML = `
      <div class="mce-layer-path"><code>${esc(L.path)}</code></div>
      <ul class="mce-layer-list">${L.items
        .map((it) => `<li><strong>${esc(it.name)}</strong> — ${esc(it.desc)}</li>`)
        .join('')}</ul>`;
  }

  function renderImplementation() {
    const impl = window.MIRA_MCE?.IMPLEMENTATION;
    const el = document.getElementById('mce-implementation');
    if (!impl || !el) return;
    const phases = impl.phases || {};
    el.innerHTML = `<p style="font-size:0.84rem;color:var(--muted);margin:0 0 12px">آخر تحديث تنفيذ: <strong>${esc(impl.updatedAt)}</strong></p>
      <div class="mce-impl-grid">${Object.keys(phases)
        .map((k) => {
          const p = phases[k];
          const done = p.status === 'done';
          return `<div class="mce-impl-card ${done ? 'done' : ''}">
            <span class="mce-impl-badge">${esc(p.labelAr)}</span>
            <strong>المرحلة ${k}</strong>
            ${p.resultsAr?.length ? `<ul>${p.resultsAr.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p style="font-size:0.84rem;color:var(--muted)">لم تُنفَّذ بعد</p>'}
            ${p.verifyAr ? `<div class="mce-verify">🔍 ${esc(p.verifyAr)}</div>` : ''}
          </div>`;
        })
        .join('')}</div>`;
  }

  function renderPhases() {
    const phases = window.MIRA_MCE?.PHASES || [];
    const nav = document.getElementById('mce-phase-nav');
    const panel = document.getElementById('mce-phase-panel');
    if (!nav || !panel) return;

    nav.innerHTML = phases
      .map(
        (p) => `<button type="button" class="mce-phase-btn ${p.n === activePhase ? 'active' : ''} ${p.status === 'done' ? 'done' : ''}" data-phase="${p.n}">
          <span class="num">${p.n}</span>
          <span class="title">${esc(p.titleAr)}</span>
          <span class="dur">${p.status === 'done' ? '✅ ' : ''}${esc(p.durationAr)}</span>
        </button>`,
      )
      .join('');

    nav.querySelectorAll('.mce-phase-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activePhase = parseInt(btn.dataset.phase, 10);
        renderPhases();
      });
    });

    const p = phases.find((x) => x.n === activePhase) || phases[0];
    if (!p) return;

    panel.innerHTML = `
      <div class="mce-phase-detail">
        <span class="mce-phase-badge">${p.status === 'done' ? '✅ مكتمل' : p.status === 'planned' ? '📋 مخطّط' : '⏳ جاري'}</span>
        <h4>المرحلة ${p.n}: ${esc(p.titleAr)}</h4>
        <p class="goal"><strong>الهدف:</strong> ${esc(p.goalAr)}</p>
        <h5>المخرجات</h5>
        <ul>${p.deliverablesAr.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
        <div class="mce-exit">${esc(p.exitAr)}</div>
        <h5>ملفات رئيسية</h5>
        <ul class="mce-files">${p.filesAr.map((f) => `<li><code>${esc(f)}</code></li>`).join('')}</ul>
      </div>`;
  }

  function renderEndpoints() {
    const eps = window.MIRA_MCE?.ENDPOINTS || [];
    const el = document.getElementById('mce-endpoints-tbody');
    if (!el) return;
    el.innerHTML = eps
      .map(
        (e) => `<tr>
          <td><code class="mce-method">${e.method}</code></td>
          <td><code dir="ltr">${esc(e.path)}</code></td>
          <td>${esc(e.descAr)}</td>
        </tr>`,
      )
      .join('');
  }

  function renderRisks() {
    const risks = window.MIRA_MCE?.RISKS || [];
    const filtered = riskFilter === 'all' ? risks : risks.filter((r) => r.severity === riskFilter);
    const el = document.getElementById('mce-risks-tbody');
    if (!el) return;
    const cls = { حرج: 'bad', عالي: 'warn', متوسط: '' };
    el.innerHTML = filtered
      .map(
        (r) => `<tr class="${cls[r.severity] || ''}">
          <td><strong>${esc(r.severity)}</strong></td>
          <td>${esc(r.riskAr)}</td>
          <td style="font-size:0.84rem">${esc(r.impactAr)}</td>
          <td style="font-size:0.84rem;color:#15803d">${esc(r.mitAr)}</td>
        </tr>`,
      )
      .join('');
  }

  function bindRiskFilter() {
    document.querySelectorAll('[data-mce-risk-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        riskFilter = btn.dataset.mceRiskFilter;
        document.querySelectorAll('[data-mce-risk-filter]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderRisks();
      });
    });
  }

  function renderMemory() {
    const mem = window.MIRA_MCE?.MEMORY_MODEL || [];
    const el = document.getElementById('mce-memory');
    if (!el) return;
    el.innerHTML = mem
      .map(
        (m) => `<div class="mce-memory-card">
          <span class="tier">${esc(m.tier)}</span>
          <p>${esc(m.descAr)}</p>
          <span class="ttl">⏱ ${esc(m.ttlAr)}</span>
        </div>`,
      )
      .join('');
  }

  function calcCost() {
    const D = window.MIRA_MCE?.COST_DEFAULTS || {};
    const mau = Number(document.getElementById('mce-cost-mau')?.value || D.mau);
    const adoption = Number(document.getElementById('mce-cost-adoption')?.value || 30) / 100;
    const turns = Number(document.getElementById('mce-cost-turns')?.value || D.turnsPerSession);
    const sessions = Number(document.getElementById('mce-cost-sessions')?.value || D.sessionsPerUser);

    const users = Math.round(mau * adoption);
    const totalTurns = users * sessions * turns;
    const inputCost = (totalTurns * D.inputTokens * D.miniInputPer1M) / 1e6;
    const outputCost = (totalTurns * D.outputTokens * D.miniOutputPer1M) / 1e6;
    const total = inputCost + outputCost;
    const perUser = users ? total / users : 0;

    const out = document.getElementById('mce-cost-result');
    if (out) {
      out.innerHTML = `
        <div class="mce-cost-row"><span>مستخدمات نشطات (MCE)</span><strong>${users.toLocaleString('ar-SA')}</strong></div>
        <div class="mce-cost-row"><span>إجمالي الدورات/شهر</span><strong>${totalTurns.toLocaleString('ar-SA')}</strong></div>
        <div class="mce-cost-row"><span>تكلفة LLM تقريبية</span><strong>$${total.toFixed(0)} / شهر</strong></div>
        <div class="mce-cost-row highlight"><span>لكل مستخدمة/شهر</span><strong>$${perUser.toFixed(3)}</strong></div>
        <p class="mce-cost-note">نموذج gpt-4o-mini · ~${D.inputTokens} إدخال + ~${D.outputTokens} إخراج/دورة · بدون ضغط = ×3 تقريباً</p>`;
    }
  }

  function bindCostSliders() {
    const map = {
      'mce-cost-mau': 'mce-val-mau',
      'mce-cost-adoption': 'mce-val-adoption',
      'mce-cost-sessions': 'mce-val-sessions',
      'mce-cost-turns': 'mce-val-turns',
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      const label = document.getElementById(map[id]);
      if (!el) return;
      const updateLabel = () => {
        if (label) label.textContent = el.value;
        calcCost();
      };
      el.addEventListener('input', updateLabel);
      updateLabel();
    });
  }

  function renderDemo() {
    const intents = window.MIRA_MCE?.DEMO_INTENTS || {};
    const tabs = document.getElementById('mce-demo-tabs');
    if (tabs) {
      tabs.innerHTML = Object.keys(intents)
        .map(
          (k) =>
            `<button type="button" class="mce-demo-tab ${k === demoIntent ? 'active' : ''}" data-intent="${k}">${esc(intents[k].labelAr)}</button>`,
        )
        .join('');
      tabs.querySelectorAll('.mce-demo-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          demoIntent = btn.dataset.intent;
          demoQuestionIdx = 0;
          renderDemo();
        });
      });
    }

    const d = intents[demoIntent];
    if (!d) return;

    const ctx = document.getElementById('mce-demo-context');
    if (ctx) ctx.textContent = d.contextAr;

    const chips = document.getElementById('mce-demo-questions');
    if (chips) {
      chips.innerHTML = d.questionsAr
        .map(
          (q, i) =>
            `<button type="button" class="mce-q-chip ${i === demoQuestionIdx ? 'active' : ''}" data-q="${i}">${esc(q)}</button>`,
        )
        .join('');
      chips.querySelectorAll('.mce-q-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          demoQuestionIdx = parseInt(btn.dataset.q, 10);
          renderDemoAnswer();
          renderDemo();
        });
      });
    }
    renderDemoAnswer();
  }

  function renderDemoAnswer() {
    const d = window.MIRA_MCE?.DEMO_INTENTS?.[demoIntent];
    const bubble = document.getElementById('mce-demo-answer');
    const cites = document.getElementById('mce-demo-cites');
    if (!d || !bubble) return;

    bubble.innerHTML = '';
    const q = d.questionsAr[demoQuestionIdx] || d.questionsAr[0];
    const userLine = document.createElement('div');
    userLine.className = 'mce-chat-user';
    userLine.textContent = q;
    bubble.appendChild(userLine);

    const botLine = document.createElement('div');
    botLine.className = 'mce-chat-bot';
    botLine.innerHTML = `<span class="conf ${d.confidence}">ثقة: ${d.confidence === 'high' ? 'عالية' : 'متوسطة'}</span>${esc(d.answerAr)}`;
    bubble.appendChild(botLine);

    if (cites) {
      cites.innerHTML = d.citesAr.map((c) => `<span class="mce-cite">${esc(c)}</span>`).join('');
    }
  }

  function renderSecurity() {
    const el = document.getElementById('mce-security');
    if (!el) return;
    const items = [
      'كل استعلام مقيّد بـ userId — لا تعداد جلسات',
      'لا صور في endpoints الاستشارة — معمارياً ممنوع',
      'رسائل مشفّرة at-rest (سياسة احتفاظ 12 شهر)',
      'حذف كامل: DELETE session + audit log',
      'قاصر: ChildSafety → تقييد عمق المكياج',
      'LLM_API_KEY سيرفر فقط — لا Flutter',
      'حقن برومبت: رسالة المستخدم في user role منفصل',
    ];
    el.innerHTML = `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  }

  function renderFuture() {
    const el = document.getElementById('mce-future');
    if (!el) return;
    const items = [
      { icon: '🎙️', t: 'استشارة صوتية', d: 'نفس Orchestrator — محول STT/TTS' },
      { icon: '👗', t: 'ذاكرة خزانة', d: 'قطع محفوظة في snapshot' },
      { icon: '🛍️', t: 'سوق ذكي', d: 'ConsultationRecommendation → Partner' },
      { icon: '⭐', t: 'اشتراك stylist', d: 'planTier + حدود + نموذج 4o' },
      { icon: '👩‍💼', t: 'تصعيد خبير', d: 'escalationRequested → طابور بشري' },
    ];
    el.innerHTML = items
      .map((x) => `<div class="mce-future-card"><span>${x.icon}</span><strong>${esc(x.t)}</strong><p>${esc(x.d)}</p></div>`)
      .join('');
  }

  function renderAll() {
    renderImplementation();
    renderHero();
    renderVerdict();
    renderGoldenRules();
    renderPipeline();
    renderLayerTabs();
    renderLayerPanel();
    renderPhases();
    renderEndpoints();
    renderRisks();
    renderMemory();
    renderDemo();
    renderSecurity();
    renderFuture();
    bindRiskFilter();
    bindCostSliders();
  }

  window.initMceConsultation = function () {
    renderAll();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('mce-consultation')) renderAll();
    });
  } else if (document.getElementById('mce-consultation')) {
    renderAll();
  }
})();
