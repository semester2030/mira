(function () {
  const COLORS = [
    { ar: 'أسود', hex: '#1A1A1A' },
    { ar: 'كحلي', hex: '#1A2848' },
    { ar: 'ذهبي', hex: '#C8A850' },
    { ar: 'نبيتي', hex: '#781828' },
    { ar: 'وردي', hex: '#E699B0' },
    { ar: 'بيج', hex: '#D2BEA0' },
    { ar: 'أبيض', hex: '#F5F5F5' },
    { ar: 'تركواز', hex: '#3CAAA0' },
  ];

  let selectedColor = COLORS[0];

  function buildPrompt(garment, color) {
    return (
      `أعدي تلوين ${garment} في هذه الصورة إلى ${color.ar} (${color.hex}).\n\n` +
      `• المطلوب: تغيير لون القماش فقط — مع الحفاظ على القصة والنسيج والظلال والانعكاسات الطبيعية.\n` +
      `• المحظور تماماً: الوجه، الشعر، البشرة، اليدين، الخلفية، الحذاء، الحقيبة، المجوهرات، وملامح الجسم.\n` +
      `• الجودة: إخراج واقعي بأسلوب تصوير أزياء فاخر — بدون فلاتر أو تجميل للوجه.\n` +
      `• الدقة: لون ${color.ar} موحّد على ${garment} مع حواف نظيفة عند خط الفصل مع الجلد.`
    );
  }

  function userMessage(garment, color) {
    return `أعدنا تلوين ${garment} إلى ${color.ar} — بإطلالة طبيعية تحافظ على هويتك`;
  }

  function renderPrompt() {
    const garment = document.getElementById('garment-select')?.value || 'فستان';
    const out = document.getElementById('prompt-output');
    const msg = document.getElementById('user-message');
    if (out) out.textContent = buildPrompt(garment, selectedColor);
    if (msg) msg.textContent = userMessage(garment, selectedColor);
  }

  function initColorChips() {
    const wrap = document.getElementById('color-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    COLORS.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-chip' + (i === 0 ? ' selected' : '');
      btn.style.background = c.hex;
      btn.title = c.ar;
      btn.setAttribute('aria-label', c.ar);
      btn.addEventListener('click', () => {
        selectedColor = c;
        wrap.querySelectorAll('.color-chip').forEach((el) => el.classList.remove('selected'));
        btn.classList.add('selected');
        renderPrompt();
      });
      wrap.appendChild(btn);
    });
  }

  function initStats() {
    const grid = document.getElementById('recolor-stats');
    if (!grid) return;
    const stats = [
      ['Phase Q QEL', '✅ Q0–Q4'],
      ['FASHN Edit', 'مع QEL gate'],
      ['الزمن', '30–180 ث'],
      ['المشاركة', 'ممنوعة'],
    ];
    grid.innerHTML = stats
      .map(
        ([k, v]) =>
          `<div class="stat-card"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>`,
      )
      .join('');
  }

  function initPhaseChecklist() {
    const list = document.getElementById('phase-checklist');
    if (!list) return;
    const phases = [
      { done: true, text: 'T0 — نظام ثقة الصورة (OutfitPhotoTrustGate)' },
      { done: true, text: 'Phase A — POST /ai/vision/outfit/recolor + برومبت v2' },
      { done: true, text: 'Phase Q0–Q3 — QEL scorer + crop-first + auto-retry' },
      { done: true, text: 'Phase Q4 — calibration profiles + runner (npm run test:qel-calibration)' },
      { done: true, text: 'OutfitGarmentRecolorPanel — فصل «جرّبي»' },
      { done: true, text: 'segment map — outline-only في «إطلالتك»' },
      { done: false, text: 'Q4 Phase 1 — 50 Case في <a href="mira-vision-platform.html#atelier-q4-phase1">ابدئي هنا</a>' },
      { done: false, text: 'Phase A+ — Edit متعدد القطع · <a href="mira-vision-platform.html#atelier-gates-timeline">بعد Q4</a>' },
      { done: false, text: 'Phase B — Try-On Max · <a href="mira-vision-platform.html#atelier-gates-timeline">بعد A+</a>' },
      { done: false, text: 'Phase C — تنسيق ذكي · <a href="mira-vision-platform.html#atelier-gates-timeline">بعد B</a>' },
    ];
    list.innerHTML = phases
      .map(
        (p) =>
          `<li style="opacity:${p.done ? 1 : 0.65}">${p.done ? '✅' : '⏳'} ${p.text}</li>`,
      )
      .join('');
  }

  document.getElementById('garment-select')?.addEventListener('change', renderPrompt);
  initColorChips();
  initStats();
  initPhaseChecklist();
  renderPrompt();
})();
