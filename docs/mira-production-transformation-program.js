/**
 * MIRA — Production Transformation Program Portal
 * Governance site only — Phase 0 code is NOT executed from this document.
 */
(function () {
  'use strict';

  const PHASES = [
    {
      id: 0,
      status: 'done',
      badge: 'DONE · PASSED',
      badgeClass: 'ready',
      title: 'Truth, Safety & Production Integrity',
      titleAr: 'الحقيقة · السلامة · نزاهة الإنتاج',
      objective:
        'إزالة كل سلوك ينتج نتائج مضلّلة أو مزيفة أو غير قابلة للتحقق في الإنتاج.',
      workstreams: [
        '0.1 تعطيل silent mock fallback (Perfect + Outfit) — DONE',
        '0.2 مؤشر حيوية البشرة / Skin Vitality Index — DONE',
        '0.3 provenance + confidence — DONE',
        '0.4 disclaimer تجميلي — DONE',
        '0.5 redact rawYouCam — DONE',
        '0.6 عزل legacy outfit mock — DONE',
        '0.7 اختبارات Phase 0 — DONE (21)',
      ],
      acceptance: [
        'لا silent mock في production',
        'لا نتيجة مزيفة تظهر كحقيقية',
        'Beauty Score لم يعد يُعرض كجمال موضوعي',
        'إخلاء مسؤولية ظاهر',
        'provenance + confidence ممثّلان',
        'تخزين provider مُقلَّل',
        'إعداد الإنتاج يرفض قيمًا غير آمنة',
        'الاختبارات تمرّ',
        'مسار تراجع موثّق',
      ],
      evidence: [
        'render.yaml: PERFECT_CORP_FALLBACK_MOCK=false',
        'production-integrity.ts + main.ts assert',
        'perfect-corp-skin.provider.ts: no prod mock',
        'youcam-audit-redact.ts',
        'test:phase0-integrity OK · flutter phase0 + beauty engine OK',
      ],
      gate: 'موافقة صريحة قبل Phase 1',
    },
    {
      id: 1,
      status: 'done',
      badge: 'DONE · PASSED',
      badgeClass: 'ready',
      title: 'Architecture Stabilization & Provider Ports',
      titleAr: 'تثبيت المعمارية ومنافذ المزودين',
      objective: 'حدود قابلة للصيانة تسمح باستبدال أي مزود AI دون إعادة كتابة التطبيق.',
      workstreams: [
        '1.1 Skin/Fashion/ImageQuality/TryOn/Telemetry ports — DONE',
        '1.2 Adapters (Perfect · Vision · Disabled TryOn · Noop Telemetry) — DONE',
        '1.3 Skin + Fashion orchestrators — DONE',
        '1.4 Typed config + fail-fast — DONE',
        '1.5 CI foundation — DONE',
        '1.6 Architecture docs — DONE',
      ],
      acceptance: [
        'Domain عبر ports',
        'Skin عبر SkinAnalysisPort',
        'Fashion عبر FashionAnalysisPort',
        'Try-on معطّل بأمان',
        'Phase 0 سليمة',
        'CI + اختبارات',
      ],
      evidence: [
        'mira-api/src/ports/**',
        'test:phase1-ports OK (14)',
        'test:phase0-integrity OK (10)',
        '.github/workflows/mira-ci.yml',
      ],
      gate: 'موافقة صريحة قبل Phase 2',
    },
    {
      id: 2,
      status: 'done',
      badge: 'DONE · PASSED',
      badgeClass: 'ready',
      title: 'Capture Quality & Reliable Face Foundation',
      titleAr: 'جودة الالتقاط وأساس وجه موثوق',
      objective: 'لا تحليل بشرة/وجه على صورة غير مناسبة.',
      workstreams: [
        '2.1 ImageQuality model + real blur/brightness/exposure — DONE',
        '2.2 Live MediaPipe guidance AR/EN (no skin claims) — DONE',
        '2.3 Post-capture gate before upload + server re-check — DONE',
        '2.4 Face alignment (roll-limited, documented) — DONE',
        '2.5 qc-v1 quality→confidence — DONE',
        '2.6 Repeatability + Phase 0/1 regression tests — DONE',
      ],
      acceptance: [
        'صور غير مناسبة تُحجب قبل Perfect',
        'لا قيم جودة محايدة مزيفة كـ measured',
        'نفس الصورة → قياسات مستقرة',
        'الجودة والثقة مفسَّرتان وإصداريّتان',
      ],
      evidence: [
        'lib/.../image_quality/** · FaceImageProcessor.alignForAnalysis',
        'CaptureImageQualityAdapter iq-v2.0+qc-v1',
        'test:phase2-image-quality · flutter phase2_image_quality_test',
        'docs/architecture/image-quality.md · face-alignment.md · phase2-rollback.md',
      ],
      gate: 'موافقة صريحة قبل Phase 3',
    },
    {
      id: 3,
      status: 'done',
      badge: 'DONE · PASSED',
      badgeClass: 'ready',
      title: 'Credible Skin Intelligence',
      titleAr: 'ذكاء بشرة موثوق',
      objective: 'تحليل تجميلي شفاف بلا ادعاءات طبية وبلا تصنيع مقاييس ناقصة.',
      workstreams: [
        '3 Skin Intelligence production path — DONE',
        '3.5 Validation & Contracts — DONE',
      ],
      acceptance: [
        'تحليل تجميلي شفاف',
        'لا ادعاءات طبية',
        'عقود وتحقق 3.5',
      ],
      evidence: [
        '#phase3-report · #phase3_5-report',
        'npm run test:phase3-skin-intel · test:phase3.5',
      ],
      gate: 'مكتمل — تغييرات عبر حوكمة الجلد فقط',
    },
    {
      id: 4,
      status: 'done',
      badge: 'DONE · FACE FROZEN',
      badgeClass: 'ready',
      title: 'Explainable Facial Feature Intelligence',
      titleAr: 'ذكاء ملامح وجه قابل للشرح',
      objective: 'هندسة وملامح وتوصيات وتقرير وجه قابل للشرح ومجمّد.',
      workstreams: [
        '4A–4F Face pipelines — DONE',
        '4.5 Production Integration — DONE',
        'Face Intelligence v1.0.0 — FROZEN',
      ],
      acceptance: [
        'هندسة + ملامح + توصيات + تقرير',
        'تحقق 4F',
        'تجميد v1.0.0',
      ],
      evidence: [
        '#phase4a-report … #phase4_5-report',
        'Face Intelligence freeze docs',
      ],
      gate: 'مجمّد — CR فقط',
    },
    {
      id: 5,
      status: 'done',
      badge: 'DONE · 5A/5A.5 FROZEN · 5B STOPPED',
      badgeClass: 'ready',
      title: 'Perfect Corp Premium Beauty Experiences',
      titleAr: 'تجارب Perfect Corp المميزة',
      objective: 'VTO رسمي مرخّص فقط — عبر BeautyTryOnPort بلا قفل مزود.',
      workstreams: [
        '5A Beauty Experience Foundation — DONE',
        '5A.5 Capability Catalog Freeze — FROZEN',
        '5B First Lip Capability — STOPPED (license gate)',
        '5B.0 Provider Readiness — DONE',
        '5B.1 Integration Readiness — DONE (provider exec disabled)',
      ],
      acceptance: [
        'قدرات مرخّصة فقط',
        'لا UI وهمي كـ VTO حقيقي',
        'موافقة + تكلفة محكومة',
      ],
      evidence: [
        '#phase5a-report · #phase5a5-report · #phase5b-report STOPPED',
        'npm run test:phase5a · test:phase5a5 · test:phase5b0 · test:phase5b1',
      ],
      gate: '5B lip يبقى متوقفاً حتى تحقق الترخيص — لا يبدأ 5C',
    },
    {
      id: 6,
      status: 'done',
      badge: 'DONE · GI/OI/SI FROZEN',
      badgeClass: 'ready',
      title: 'Professional Fashion & Wardrobe Intelligence',
      titleAr: 'موضة وخزانة احترافية',
      objective: 'مسار Vision واحد كانوني + خزانة + قطع + إطلالة + أسلوب مجمّدة.',
      workstreams: [
        '6B Wardrobe Foundation — DONE',
        '6C Garment Intelligence v1.0.0 — FROZEN',
        '6D Outfit Intelligence v1.0.0 — FROZEN (Law #31)',
        '6E Styling Intelligence v1.0.0 — FROZEN (Law #32)',
      ],
      acceptance: [
        'مسار إنتاج واحد للموضة',
        'لا mock صامت',
        'كل صفة مستنتجة معلَّمة',
        'OI/SI freeze certificates منشورة',
      ],
      evidence: [
        'npm run test:phase6b · 6c · 6d · 6e',
        'MIRA-OI-FREEZE-1.0.0 · MIRA-SI-FREEZE-1.0.0',
        '#phase6b-report · #phase6c-report · #phase6d-report · #phase6e-report',
      ],
      gate: 'مجمّد — أي تغيير عبر Change Policy فقط',
    },
    {
      id: 7,
      status: 'done',
      badge: 'DONE · ADVISOR FROZEN',
      badgeClass: 'ready',
      title: 'Validation, Bias Testing & Controlled Launch',
      titleAr: 'تحقق · تحيز · إطلاق محكوم + مستشارة الجمال',
      objective: 'إثبات ما يعمل + تجميد AI Beauty Advisor كطبقة محادثة.',
      workstreams: [
        '7A AI Beauty Advisor Architecture Lock — DONE',
        '7B Implementation — DONE',
        '7B.1 Remediation — DONE',
        '7B Independent Re-Audit A — APPROVED',
        '7B.2 Production Freeze v1.0.0 — FROZEN (Laws #33/#34)',
      ],
      acceptance: [
        'Advisor Envelope + Law #34',
        'لا استبدال للذكاء المجمّد (Law #33)',
        'Re-Audit A + Freeze Certificate',
      ],
      evidence: [
        'npm run test:phase7b',
        'MIRA-BA-FREEZE-1.0.0',
        '#phase7b-report · PHASE_7B2_* governance',
      ],
      gate: 'Advisor مجمّد — Recommendation Engine مسار لاحق',
    },
    {
      id: 8,
      status: 'locked',
      badge: 'LOCKED · NEXT TRACK',
      badgeClass: 'locked',
      title: 'Scale, Observability, Cost & Learning',
      titleAr: 'توسّع · مراقبة · تكلفة · تعلّم',
      objective: 'نمو موثوق بلا تكلفة منفلتة ولا تدهور خفي — بعد اكتمال مسار التحويل.',
      workstreams: [
        '8.1 مراقبة إنتاج (بدون صور خام في السجلات)',
        '8.2 SLOs وتنبيهات',
        '8.3 طوابير/idempotency عند الحاجة',
        '8.4 تحكم تكلفة + تعطيل طارئ',
        '8.5 مرونة مزودين (timeout/circuit)',
        '8.6 حلقة feedback موثوقة',
        '8.7 دورة حياة بيانات + حذف',
      ],
      acceptance: [
        'التدفقات الحرجة مراقَبة',
        'تكلفة التحليل قابلة للقياس',
        'retention/deletion منفّذان',
      ],
      evidence: [
        'مسار الموضة/المستشارة مجمّد — Phase 8 تشغيل لاحق',
        'health يعرض fashion/advisor pins',
      ],
      gate: 'تقرير برنامج نهائي / تشغيل بعد موافقة صريحة',
    },
  ];

  const ADJUSTMENTS = [
    {
      tag: 'keep',
      tagLabel: 'أبقِ',
      title: 'Phase 0 أولاً — حقيقة قبل الميزات',
      why: 'الأدلة الحية تؤكد mock fallback في الإنتاج وصياغة Beauty مضلّلة. أي VTO أو وجه متقدم فوق هذا يضاعف فقدان الثقة.',
    },
    {
      tag: 'adj',
      tagLabel: 'عدّل',
      title: 'فصل «تعطيل Render» عن «كود الحماية»',
      why: 'Phase 0 يجب أن يفشل الإقلاع إذا NODE_ENV=production و FALLBACK_MOCK≠false — لا يعتمد فقط على تغيير يدوي في Dashboard.',
    },
    {
      tag: 'adj',
      tagLabel: 'عدّل',
      title: 'Phase 5 بعد تحقق الترخيص فقط',
      why: 'Makeup VTO = 0 في الكود. لا تبنِ UI قبل تأكيد الترخيص والمنصة والتكلفة من حساب Perfect الرسمي.',
    },
    {
      tag: 'adj',
      tagLabel: 'عدّل',
      title: 'لا تحذف OUTFIT mock قبل عزل المسار',
      why: 'Vision Platform هو المسار الحي؛ OUTFIT_PROVIDER=mock legacy. العزل + production guard أولاً (0.6) ثم الإزالة لاحقًا.',
    },
    {
      tag: 'adj',
      tagLabel: 'عدّل',
      title: 'دمج ادّعاءات الموقع التسويقي في Phase 0.4',
      why: 'index.html يعرض «نقطة تقييم دقيقة» و«ذكاء يُبرز جمالك» بينما التدقيق يقول لا جاذبية موضوعية — يجب مواءمة docs + App Store مع claim matrix لاحقًا.',
    },
    {
      tag: 'keep',
      tagLabel: 'أبقِ',
      title: 'بوابة موافقة بعد كل مرحلة',
      why: 'يمنع Big Bang ويمنع تنفيذ Phase 1–8 في جلسة واحدة — متوافق مع حوكمة البرنامج.',
    },
    {
      tag: 'fail',
      tagLabel: 'تجنّب',
      title: 'تنفيذ كل المراحل الآن',
      why: 'المستودع على فرع docs وفيه تغييرات غير ملتزمة. التنفيذ الشامل يخاطر بخلط عمل غير ذي صلة ويفشل بوابة الحوكمة.',
    },
  ];

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function renderPhases(container) {
    const grid = el('div', 'phase-grid');
    PHASES.forEach((p) => {
      const card = el('div', 'phase');
      card.dataset.status = p.status;
      card.dataset.phase = String(p.id);
      if (p.id === 2) card.classList.add('open');

      const head = el('div', 'phase-head');
      head.innerHTML = `
        <div class="phase-id">${p.id}</div>
        <div class="phase-meta">
          <h3>Phase ${p.id} — ${p.titleAr}</h3>
          <p>${p.title}</p>
        </div>
        <span class="phase-badge ${p.badgeClass}">${p.badge}</span>
      `;
      head.addEventListener('click', () => card.classList.toggle('open'));

      const body = el('div', 'phase-body');
      body.innerHTML = `
        <p><strong>الهدف:</strong> ${p.objective}</p>
        <h4 style="margin:0.75rem 0 0.35rem;font-size:0.85rem;color:var(--champagne)">مسارات العمل</h4>
        <ul>${p.workstreams.map((w) => `<li>${w}</li>`).join('')}</ul>
        <div class="ac">
          <strong style="color:var(--text)">معايير القبول</strong>
          <ul>${p.acceptance.map((a) => `<li>${a}</li>`).join('')}</ul>
        </div>
        <div class="evidence"><strong>أدلة حالية:</strong> ${p.evidence.map((e) => `<div>• ${e}</div>`).join('')}</div>
        <p style="margin-top:0.75rem;font-size:0.8rem"><span class="tag gate" style="background:rgba(196,93,120,0.2);color:var(--rose)">GATE</span> ${p.gate}</p>
      `;

      card.appendChild(head);
      card.appendChild(body);
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  function renderAdjustments(container) {
    ADJUSTMENTS.forEach((a) => {
      const d = el('div', 'callout info');
      d.innerHTML = `<span class="tag ${a.tag}">${a.tagLabel}</span> <strong>${a.title}</strong><br>${a.why}`;
      container.appendChild(d);
    });
  }

  function jump(id) {
    const t = document.getElementById(id);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.jump = jump;

  function initNav() {
    const search = document.getElementById('navSearch');
    const links = Array.from(document.querySelectorAll('aside nav a[href^="#"]'));
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        links.forEach((a) => {
          const show = !q || a.textContent.toLowerCase().includes(q);
          a.style.display = show ? '' : 'none';
        });
      });
    }

    const sections = links
      .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
      .filter(Boolean);

    const onScroll = () => {
      const y = window.scrollY + 120;
      let current = sections[0];
      for (const s of sections) {
        if (s.offsetTop <= y) current = s;
      }
      links.forEach((a) => {
        a.classList.toggle('active', current && a.getAttribute('href') === `#${current.id}`);
      });
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      const bar = document.getElementById('progressBar');
      if (bar) bar.style.width = `${pct}%`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function boot() {
    const phasesRoot = document.getElementById('phasesRoot');
    const adjRoot = document.getElementById('adjustmentsRoot');
    if (phasesRoot) renderPhases(phasesRoot);
    if (adjRoot) renderAdjustments(adjRoot);
    initNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
