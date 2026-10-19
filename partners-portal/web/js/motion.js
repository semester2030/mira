(function () {
  function reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function announce(message) {
    if (!document || !document.body) return;
    let live = document.getElementById('miraLive');
    if (!live) {
      live = document.createElement('div');
      live.id = 'miraLive';
      live.className = 'sr-only';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      document.body.appendChild(live);
    }
    live.textContent = '';
    window.setTimeout(() => { live.textContent = message || ''; }, 30);
  }

  function skeletonCard(kind) {
    const card = document.createElement('div');
    card.className = 'skeleton-card skeleton-card-' + kind;
    card.setAttribute('aria-hidden', 'true');
    return card;
  }

  function fillSkeletons(host, kind, count) {
    if (!host) return;
    host.replaceChildren();
    host.setAttribute('aria-busy', 'true');
    for (let index = 0; index < count; index += 1) host.appendChild(skeletonCard(kind));
  }

  function statNumber(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function renderStats(root, rows) {
    if (!root) return;
    root.removeAttribute('aria-busy');
    rows.forEach((row) => {
      let card = root.querySelector('[data-stat="' + row.key + '"]');
      if (!card) {
        card = document.createElement('div');
        card.className = 'stat';
        card.dataset.stat = row.key;
        root.appendChild(card);
      }
      const number = statNumber(row.value);
      const previous = card.dataset.value;
      const num = document.createElement('div');
      num.className = 'num';
      const label = document.createElement('div');
      label.className = 'lbl';
      label.textContent = row.label;
      if (number == null) {
        num.textContent = 'غير متاح';
        num.classList.add('is-missing');
        delete card.dataset.value;
      } else {
        const next = String(number);
        num.textContent = next;
        if (previous !== next) {
          card.dataset.value = next;
          if (!reduced()) num.classList.add('stat-enter');
        }
      }
      card.replaceChildren(num, label);
    });
    Array.from(root.querySelectorAll('.skeleton-card')).forEach((node) => node.remove());
  }

  function describeMedia(entry) {
    const status = entry && entry.status ? entry.status : '';
    const percent = entry && typeof entry.percent === 'number' && entry.percent >= 0 && entry.percent <= 1
      ? entry.percent
      : null;
    if (status === 'فشل') {
      return { label: entry.error ? status + ' · ' + entry.error : status, mode: 'fail', percent: null };
    }
    if (status === 'رُفع') return { label: 'اكتمل الرفع', mode: 'done', percent: 1 };
    if (status === 'أُلغي') return { label: 'أُلغي الرفع. الملف ما زال هنا.', mode: 'idle', percent: null };
    if (status === 'بانتظار الحفظ') return { label: 'بانتظار الحفظ', mode: 'idle', percent: null };
    if (status === 'بانتظار البيانات') return { label: 'أكملي الاسم والسعر والتصنيف ليبدأ الرفع', mode: 'idle', percent: null };
    if (status === 'جارٍ تجهيز النشر') return { label: 'جارٍ تجهيز النشر', mode: 'wait', percent: null };
    if (status === 'جارٍ القراءة' || status === 'جارٍ الرفع') {
      if (percent == null) return { label: status, mode: 'wait', percent: null };
      return { label: status + ' ' + Math.round(percent * 100) + '%', mode: 'determinate', percent: percent };
    }
    if (status === 'جارٍ المعالجة') return { label: 'جارٍ المعالجة', mode: 'wait', percent: null };
    return { label: status, mode: 'idle', percent: null };
  }

  function applyProgress(node, view) {
    if (!node) return;
    node.classList.toggle('is-wait', view.mode === 'wait');
    node.classList.toggle('is-done', view.mode === 'done');
    node.classList.toggle('is-fail', view.mode === 'fail');
    const bar = node.querySelector('.media-progress-bar');
    if (view.mode === 'determinate' || view.mode === 'done') {
      const value = Math.round((view.percent || 0) * 100);
      node.setAttribute('role', 'progressbar');
      node.setAttribute('aria-valuemin', '0');
      node.setAttribute('aria-valuemax', '100');
      node.setAttribute('aria-valuenow', String(value));
      node.setAttribute('aria-valuetext', view.label);
      if (bar) bar.style.width = value + '%';
    } else {
      node.removeAttribute('role');
      node.removeAttribute('aria-valuenow');
      node.removeAttribute('aria-valuemin');
      node.removeAttribute('aria-valuemax');
      node.setAttribute('aria-valuetext', view.label);
      if (bar) bar.style.width = '';
    }
  }

  window.MiraMotion = {
    reduced: reduced,
    announce: announce,
    fillSkeletons: fillSkeletons,
    statNumber: statNumber,
    renderStats: renderStats,
    describeMedia: describeMedia,
    applyProgress: applyProgress,
  };
})();
