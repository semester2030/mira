/**
 * Q4 Phase 1 — بداية (25–50 Case): outcomes, risks, proof (static).
 * Live stats from mira-q4-eval-sheet.js → #q4-phase1-live
 */
(function () {
  const PHASE1 = {
    id: 'Q4-P1',
    title: 'Q4 — بداية (25–50 Case)',
    targetMin: 25,
    targetFull: 50,
    passRateGo: 75,
    understandingProof: [
      'Q4 ليست «ميزة في التطبيق» — هي <strong>بوابة معايرة</strong> قبل الإطلاق الواسع.',
      'المرحلة الأولى = <strong>25–50 صورة حقيقية</strong> مُقيَّمة بشرياً + QEL من التطبيق.',
      'لا يُفتح <strong>A+ · B · C</strong> ولا نشر Render للإنتاج الواسع قبل إغلاق Q4 كاملاً (100).',
      'النتيجة تُسجَّل في <a href="#atelier-q4-eval">سجل Q4</a> — ليست تخميناً.',
      'معيار المرحلة 1: ≥25 مكتمل + Pass Rate ≥75% → متابعة إلى 100.',
    ],
    workflow: [
      { n: 1, title: 'إنشاء قالب 50 Case', action: 'زر «Q4 بداية — 50 Case» في السجل أدناه' },
      { n: 2, title: 'تشغيل «جرّبي»', action: 'فصل 3 في التطبيق — Before ثابت + After من FASHN' },
      { n: 3, title: 'نسخ QEL', action: 'Score + Gate (Accept/422) من شارة Phase Q بعد كل تجربة' },
      { n: 4, title: 'تقييم بشري 1–10', action: 'Identity · Fabric · Edge · Shape — ثم Final' },
      { n: 5, title: 'تصدير جزئي', action: 'CSV أو manifest JSON (001–050) للمعايرة' },
      { n: 6, title: 'قرار Go/No-Go', action: 'لوحة الإثبات أدناه — متابعة 100 أو ضبط QEL' },
    ],
    appAfterPhase1: [
      {
        area: 'فصل «جرّبي»',
        before: 'QEL يعمل لكن threshold غير مُعاير على بيانات حقيقية',
        after: 'threshold مُختبر على 25–50 زوج — رفض/قبول أكثر دقة',
        userFeels: '«إما نتيجة أثق فيها أو رسالة واضحة لماذا رُفضت»',
      },
      {
        area: 'شارة Phase Q',
        before: 'نسبة QEL قد لا تطابق الحكم البشري',
        after: 'توافق QEL↔Human مُقاس (هدف ≥80% اتفاق)',
        userFeels: 'الشارة تعكس ما تراه عينها',
      },
      {
        area: '422 QEL_REJECTED',
        before: 'قد يرفض كثيراً أو قليلاً بدون دليل',
        after: 'رفض مُبرر — Identity/Fabric/Edge مُوثَّقة في السجل',
        userFeels: 'لا إحباط عشوائي — ثقة بالمنتج',
      },
      {
        area: 'قبل/بعد',
        before: 'معاينة بدون ضمان هوية',
        after: 'فقط نتائج PASS بشرياً + QEL في العيّنة',
        userFeels: '«هذا أنا — لكن اللون أحلى»',
      },
      {
        area: 'A+ · B · C',
        before: '🔒 مقفولة',
        after: 'لا تزال 🔒 — تُفتح بعد 100 Case + Render',
        userFeels: 'لا وعود مبكرة — مسار واضح',
      },
      {
        area: 'الإنتاج Render',
        before: 'QEL قد يكون غير منشور أو غير مُعاير',
        after: 'قرار مُستنير لنشر QEL_* بناءً على manifest 001–050',
        userFeels: 'استقرار أعلى بعد النشر',
      },
    ],
    risksIfSkipped: [
      {
        risk: 'عرض نتيجة تغيّر الوجه أو البشرة',
        severity: 'حرج',
        impact: 'فقدان ثقة المستخدمة فوراً — «هذا ليس أنا»',
      },
      {
        risk: 'threshold QEL افتراضي (0.85) بدون معايرة',
        severity: 'حرج',
        impact: 'رفض زائد أو قبول خطير — لا تعرفين أيهما',
      },
      {
        risk: 'إطلاق A+ متعدد القطع على أساس غير مُختبر',
        severity: 'عالي',
        impact: 'أخطاء مضاعفة × 3 قطع — كارثة بصرية',
      },
      {
        risk: 'Try-On Max بدون QEL مُعاير',
        severity: 'عالي',
        impact: 'catalog يبدو «لعبة» وليس أزياء حقيقية',
      },
      {
        risk: 'درجة تحليل على صورة غير إطلالة (T0)',
        severity: 'متوسط',
        impact: 'منتج يبدو غير جاد — marketing fake',
      },
      {
        risk: 'لا دليل للمستثمر/الشريك',
        severity: 'متوسط',
        impact: '«الجودة ممتازة» بدون 50 زوج موثّق',
      },
      {
        risk: 'هدر تكلفة FASHN',
        severity: 'منخفض',
        impact: 'إعادة ضبط بعد إطلاق بدل قبله',
      },
    ],
  };

  function renderStatic() {
    const proofEl = document.getElementById('q4-phase1-proof');
    if (proofEl) {
      proofEl.innerHTML =
        '<ul style="margin:0;padding-right:22px;line-height:1.9;font-size:0.9rem">' +
        PHASE1.understandingProof.map((p) => `<li>${p}</li>`).join('') +
        '</ul>';
    }

    const wfEl = document.getElementById('q4-phase1-workflow');
    if (wfEl) {
      wfEl.innerHTML = PHASE1.workflow
        .map(
          (w) => `<div class="q4-p1-step">
            <span class="q4-p1-step-num">${w.n}</span>
            <div><strong>${w.title}</strong><br /><span style="font-size:0.84rem;color:var(--muted)">${w.action}</span></div>
          </div>`,
        )
        .join('');
    }

    const appEl = document.getElementById('q4-phase1-app-outcomes');
    if (appEl) {
      appEl.innerHTML = PHASE1.appAfterPhase1
        .map(
          (r) => `<tr>
            <td><strong>${r.area}</strong></td>
            <td style="font-size:0.84rem">${r.before}</td>
            <td style="font-size:0.84rem;color:#15803d">${r.after}</td>
            <td style="font-size:0.84rem;font-style:italic">${r.userFeels}</td>
          </tr>`,
        )
        .join('');
    }

    const riskTb = document.getElementById('q4-phase1-risks-tbody');
    if (riskTb) {
      riskTb.innerHTML = PHASE1.risksIfSkipped
        .map((r) => {
          const cls =
            r.severity === 'حرج' ? 'bad' : r.severity === 'عالي' ? 'warn' : '';
          return `<tr class="${cls}">
            <td>${r.risk}</td>
            <td><strong>${r.severity}</strong></td>
            <td style="font-size:0.86rem">${r.impact}</td>
          </tr>`;
        })
        .join('');
    }

    const scenTb = document.getElementById('q4-phase1-scenarios-tbody');
    const scenarios = window.Q4_PHASE1_SCENARIOS || [];
    if (scenTb && scenarios.length) {
      scenTb.innerHTML = scenarios
        .map(
          (s) =>
            `<tr><td><strong>${s.id}</strong></td><td>${s.piece}</td><td>${s.beforeColor}</td><td>${s.afterColor}</td><td style="font-size:0.78rem;color:var(--muted)">${s.notes || ''}</td></tr>`,
        )
        .join('');
    }
  }

  window.initQ4Phase1 = function () {
    renderStatic();
    if (window.refreshQ4Phase1Live) window.refreshQ4Phase1Live();
  };

  window.Q4_PHASE1_META = PHASE1;
})();
