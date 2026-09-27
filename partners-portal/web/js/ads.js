function labeledAdsFixture() {
  return [{
    id: 'labeled-ad',
    status: 'rejected',
    captionAr: '<script>alert(1)</script> "اقتباس"',
    targetKind: 'product',
    targetId: 'labeled-product',
    reviewRevision: 2,
    submittedRevision: 1,
    reviewNote: 'سبب الرفض <b>موسوم</b>',
    advertiser: { nameAr: 'المعلن' },
    publisher: { nameAr: 'المعلن' },
    seller: { nameAr: 'جهة الأصل' },
    liveTarget: { nameAr: 'فستان', priceHalalas: 1800, contentStatus: 'published', externalUrl: 'https://example.com/dress' },
    views: { state: 'disabled', count: null },
  }];
}

function renderAds(items, statusNode) {
  const notice = document.getElementById('adsNotice');
  const list = document.getElementById('adsList');
  const form = document.getElementById('adsForm');
  if (!notice || !list || !form) return;
  notice.textContent = 'السعر والتوفر والجهة تُقرأ من الأصل. العد غير مفعّل. فتح الرابط ليس شراءً مكتملًا، وطلب الموعد ليس حجزًا مؤكدًا. لا يُسند الإعلان إلى ناشر آخر.';
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.textContent = 'لا إعلانات لهذا الحساب.';
    list.appendChild(empty);
  }
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'list-item';
    function line(value) {
      const node = document.createElement('p');
      node.textContent = value;
      card.appendChild(node);
    }
    line(item.captionAr || 'بلا نص');
    line('الحالة: ' + (item.status || '') + ' · النسخة: ' + (item.reviewRevision ?? '') + ' · نسخة المراجعة: ' + (item.submittedRevision ?? '—'));
    line('المعلن: ' + (item.advertiser && item.advertiser.nameAr || '') + ' · الناشر: ' + (item.publisher && item.publisher.nameAr || '') + ' · الجهة: ' + (item.seller && item.seller.nameAr || ''));
    if (item.liveTarget) line('الأصل الآن: ' + item.liveTarget.nameAr + ' · السعر بالهللة من الأصل: ' + item.liveTarget.priceHalalas);
    if (item.reviewNote) line('سبب الرفض للنسخة ' + (item.submittedRevision ?? item.reviewRevision) + ': ' + item.reviewNote);
    const views = item.views || {};
    line(views.state === 'disabled' ? 'المشاهدات: العد غير مفعّل' : 'المشاهدات: ' + (views.count == null ? 'تعذر الجلب' : views.count));
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'btn btn-ghost btn-sm';
    preview.textContent = 'معاينة';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn btn-ghost btn-sm';
    submit.textContent = 'إرسال للمراجعة';
    const withdraw = document.createElement('button');
    withdraw.type = 'button';
    withdraw.className = 'btn btn-ghost btn-sm';
    withdraw.textContent = 'سحب';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn-ghost btn-sm';
    edit.textContent = 'تعديل المسودة';
    const localStatus = document.createElement('p');
    const actions = document.createElement('div');
    actions.className = 'ad-actions';
    actions.append(preview, submit, withdraw, edit);
    card.append(actions, localStatus);
    list.appendChild(card);
    preview.onclick = async () => {
      if (new URLSearchParams(location.search).get('ui-fixture') === 'labeled' || !window.PartnersApi || !PartnersApi.ad) {
        localStatus.textContent = 'محاكاة: المعاينة لا تتصل بالخادم';
        return;
      }
      try {
        const fresh = await PartnersApi.ad(item.id);
        const stats = await PartnersApi.adStats(item.id);
        localStatus.textContent = 'المعاينة: ' + (fresh.captionAr || '') + ' · فتح الرابط: ' + (stats.linkOpens ?? 0) + ' · المشاهدات: العد غير مفعّل';
      } catch (error) {
        localStatus.textContent = error.message;
      }
    };
    submit.onclick = async () => {
      if (new URLSearchParams(location.search).get('ui-fixture') === 'labeled' || !window.PartnersApi || !PartnersApi.submitAd) {
        localStatus.textContent = 'محاكاة: لم يُرسل للمراجعة';
        return;
      }
      try {
        await PartnersApi.submitAd(item.id);
        localStatus.textContent = 'أُرسل للمراجعة';
        if (typeof load === 'function') load();
      } catch (error) {
        localStatus.textContent = error.message;
      }
    };
    withdraw.onclick = async () => {
      if (new URLSearchParams(location.search).get('ui-fixture') === 'labeled' || !window.PartnersApi || !PartnersApi.withdrawAd) {
        localStatus.textContent = 'محاكاة: لم يُسحب الإعلان';
        return;
      }
      try {
        await PartnersApi.withdrawAd(item.id);
        localStatus.textContent = 'سُحب الإعلان';
        if (typeof load === 'function') load();
      } catch (error) {
        localStatus.textContent = error.message;
      }
    };
    edit.onclick = () => renderAdForm(item);
  });
  renderAdForm(null);
}

function renderAdForm(item) {
  const form = document.getElementById('adsForm');
  if (!form) return;
  form.replaceChildren();
  const status = document.createElement('p');
  status.textContent = item ? 'تعديل المسودة لا يغيّر سعر الأصل.' : 'إنشاء مسودة مربوطة بهدف قائم. الناشر هو هذا الحساب.';
  form.appendChild(status);
  function field(label, name, value) {
    const wrap = document.createElement('div');
    const caption = document.createElement('label');
    caption.textContent = label;
    const input = document.createElement('input');
    input.name = name;
    input.value = value == null ? '' : String(value);
    wrap.append(caption, input);
    form.appendChild(wrap);
    return input;
  }
  const kind = field('نوع الهدف product أو service', 'targetKind', item ? item.targetKind : 'product');
  const targetId = field('معرّف المنتج أو الخدمة', 'targetId', item ? item.targetId : '');
  const caption = field('النص', 'captionAr', item ? item.captionAr : '');
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'btn btn-primary';
  save.textContent = item ? 'حفظ المسودة' : 'إنشاء مسودة';
  form.appendChild(save);
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (new URLSearchParams(location.search).get('ui-fixture') === 'labeled' || !window.PartnersApi || !PartnersApi.createAd) {
      status.textContent = 'محاكاة: لم يُحفظ شيء';
      return;
    }
    save.disabled = true;
    const payload = { targetKind: kind.value.trim(), targetId: targetId.value.trim(), captionAr: caption.value };
    try {
      if (item) await PartnersApi.updateAd(item.id, payload);
      else await PartnersApi.createAd(payload);
      status.textContent = item ? 'حُفظت المسودة' : 'أُنشئت المسودة';
      if (typeof load === 'function') load();
    } catch (error) {
      status.textContent = error.message;
      save.disabled = false;
    }
  };
}
