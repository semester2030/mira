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
    media: [],
  }];
}

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = String(reader.result || '');
      var comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderAds(items, statusNode) {
  const notice = document.getElementById('adsNotice');
  const list = document.getElementById('adsList');
  const form = document.getElementById('adsForm');
  if (!notice || !list || !form) return;
  const partnerType = String(document.body.dataset.partnerType || '').toLowerCase();
  const adsHeading = document.querySelector('#adsSection > h2');
  if (adsHeading && (partnerType === 'salon' || partnerType === 'clinic')) {
    adsHeading.textContent = 'إعلاني الرئيسي';
  } else if (adsHeading) {
    adsHeading.textContent = 'إعلاناتي';
  }
  notice.textContent =
    partnerType === 'salon' || partnerType === 'clinic'
      ? 'إعلان اكتشفي مستقل عن قائمة خدماتك. وسائط الإعلان ملكك ولا تستبدل وسائط الأصل. السعر والتوفر يُقرآن من الأصل المنشور.'
      : 'اختاري عرضًا من كتالوج ميرا. وسائط الإعلان مستقلة عن صور/فيديو المتجر. العد غير مفعّل. فتح الرابط تفاعل فقط وليس شراءً مكتملًا.';
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
    const mediaCount = Array.isArray(item.media) ? item.media.length : 0;
    line('وسائط الإعلان: ' + mediaCount + (mediaCount ? '' : ' — أضيفي فيديو أو صورًا قبل النشر'));
    const views = item.views || {};
    line(views.state === 'disabled' ? 'المشاهدات: العد غير مفعّل' : 'المشاهدات: ' + (views.count == null ? 'تعذر الجلب' : views.count));
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'btn btn-ghost btn-sm';
    preview.textContent = 'معاينة';
    const mediaBtn = document.createElement('button');
    mediaBtn.type = 'button';
    mediaBtn.className = 'btn btn-ghost btn-sm';
    mediaBtn.textContent = 'وسائط الإعلان';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn btn-ghost btn-sm';
    const developerAccount = window.sessionPartner && window.sessionPartner.type === 'developer';
    submit.textContent = developerAccount ? 'نشر الآن' : 'إرسال للمراجعة';
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
    actions.append(preview, mediaBtn, submit, withdraw, edit);
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
        localStatus.textContent = 'المعاينة: ' + (fresh.captionAr || '') + ' · وسائط: ' + ((fresh.media && fresh.media.length) || 0) + ' · فتح الرابط: ' + (stats.linkOpens ?? 0);
      } catch (error) {
        localStatus.textContent = error.message;
      }
    };
    mediaBtn.onclick = () => renderAdMediaEditor(item.id, localStatus);
    submit.onclick = async () => {
      if (new URLSearchParams(location.search).get('ui-fixture') === 'labeled' || !window.PartnersApi || !PartnersApi.submitAd) {
        localStatus.textContent = 'محاكاة: لم يُرسل للمراجعة';
        return;
      }
      try {
        await PartnersApi.submitAd(item.id);
        localStatus.textContent = developerAccount ? 'نُشر في التطبيق مباشرة، بلا مراجعة.' : 'أُرسل للمراجعة';
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
  const mediaHost = document.getElementById('adMediaEditor');
  if (mediaHost) {
    mediaHost.classList.add('hidden');
    mediaHost.replaceChildren();
  }
}

async function renderAdMediaEditor(adId, statusNode) {
  const host = document.getElementById('adMediaEditor');
  if (!host) return;
  host.classList.remove('hidden');
  host.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = 'وسائط الإعلان';
  const hint = document.createElement('p');
  hint.textContent = 'حتى ٣ فيديوهات أو فيديو + حتى ١٠ صور في الموضع الرئيسي. الفشل على ملف واحد لا يلغي الناجح. حذف وسائط الإعلان لا يمس وسائط التاجر.';
  const list = document.createElement('div');
  list.className = 'ad-media-list';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/mp4,video/quicktime';
  fileInput.multiple = true;
  const status = document.createElement('p');
  host.append(title, hint, list, fileInput, status);

  async function refresh() {
    list.replaceChildren();
    if (!window.PartnersApi || !PartnersApi.adMedia) {
      status.textContent = 'واجهة الوسائط غير متاحة';
      return;
    }
    try {
      const res = await PartnersApi.adMedia(adId);
      const items = (res && res.items) || [];
      if (!items.length) {
        const empty = document.createElement('p');
        empty.textContent = 'لا وسائط بعد.';
        list.appendChild(empty);
      }
      items.forEach((m, index) => {
        const row = document.createElement('div');
        row.className = 'list-item';
        row.textContent = (index + 1) + '. ' + (m.kind || '') + (m.isPrimary ? ' · غلاف' : '') + ' · ' + (m.publication || '');
        const primary = document.createElement('button');
        primary.type = 'button';
        primary.className = 'btn btn-ghost btn-sm';
        primary.textContent = 'تعيين غلاف';
        primary.onclick = async () => {
          try {
            await PartnersApi.setAdMediaPrimary(adId, m.id);
            await refresh();
            if (typeof load === 'function') load();
          } catch (error) {
            status.textContent = error.message;
          }
        };
        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'btn btn-ghost btn-sm';
        up.textContent = '↑';
        up.onclick = async () => {
          if (index === 0) return;
          const ids = items.map((x) => x.id);
          const tmp = ids[index - 1];
          ids[index - 1] = ids[index];
          ids[index] = tmp;
          try {
            await PartnersApi.reorderAdMedia(adId, ids);
            await refresh();
          } catch (error) {
            status.textContent = error.message;
          }
        };
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn btn-ghost btn-sm';
        del.textContent = 'حذف';
        del.onclick = async () => {
          try {
            await PartnersApi.removeAdMedia(adId, m.id);
            await refresh();
            if (typeof load === 'function') load();
          } catch (error) {
            status.textContent = error.message;
          }
        };
        row.append(primary, up, del);
        list.appendChild(row);
      });
      status.textContent = 'وسائط محفوظة: ' + items.length;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  fileInput.onchange = async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      status.textContent = 'رفع ' + (i + 1) + '/' + files.length + ': ' + file.name;
      try {
        const b64 = await fileToBase64(file);
        const send = PartnersApi.addAdMediaProgress || PartnersApi.addAdMedia;
        await send(adId, file.type || 'application/octet-stream', b64, {});
      } catch (error) {
        status.textContent = 'فشل ' + file.name + ': ' + (error.message || 'خطأ') + ' — يمكنك إعادة محاولة هذا الملف فقط.';
        await refresh();
        return;
      }
    }
    await refresh();
    if (typeof load === 'function') load();
    status.textContent = 'اكتمل الرفع.';
  };

  await refresh();
  if (statusNode) statusNode.textContent = 'محرر وسائط الإعلان مفتوح أسفل النموذج.';
  host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderAdForm(item) {
  const form = document.getElementById('adsForm');
  if (!form) return;
  form.replaceChildren();
  const status = document.createElement('p');
  status.textContent = item ? 'تعديل المسودة لا يغيّر سعر الأصل ولا وسائط التاجر.' : 'أنشئي مسودة مربوطة بعرض قائم من الكتالوج. الناشر هو هذا الحساب.';
  form.appendChild(status);

  const picker = document.createElement('div');
  picker.className = 'ad-offer-picker';
  const pickerLabel = document.createElement('label');
  pickerLabel.textContent = 'اختاري منتجًا أو خدمة من كتالوج ميرا';
  const search = document.createElement('input');
  search.placeholder = 'بحث بالاسم…';
  search.value = '';
  const kindSelect = document.createElement('select');
  [['', 'الكل'], ['product', 'منتجات'], ['service', 'خدمات']].forEach(([v, t]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    kindSelect.appendChild(o);
  });
  const results = document.createElement('div');
  results.className = 'ad-offer-results';
  picker.append(pickerLabel, kindSelect, search, results);
  form.appendChild(picker);

  const kind = document.createElement('input');
  kind.name = 'targetKind';
  kind.type = 'hidden';
  kind.value = item ? item.targetKind : 'product';
  const targetId = document.createElement('input');
  targetId.name = 'targetId';
  targetId.type = 'hidden';
  targetId.value = item ? item.targetId : '';
  const selected = document.createElement('p');
  selected.textContent = item && item.liveTarget
    ? 'المختار: ' + item.liveTarget.nameAr + ' · المالك: ' + ((item.seller && item.seller.nameAr) || '')
    : 'لم يُختر عرض بعد.';
  form.append(kind, targetId, selected);

  const captionWrap = document.createElement('div');
  const captionLabel = document.createElement('label');
  captionLabel.textContent = 'النص';
  const caption = document.createElement('input');
  caption.name = 'captionAr';
  caption.value = item ? (item.captionAr || '') : '';
  captionWrap.append(captionLabel, caption);
  form.appendChild(captionWrap);

  async function loadOffers() {
    results.replaceChildren();
    if (!window.PartnersApi || !PartnersApi.adOfferTargets) {
      results.textContent = 'قائمة العروض غير متاحة.';
      return;
    }
    try {
      const res = await PartnersApi.adOfferTargets({
        kind: kindSelect.value || undefined,
        q: search.value.trim() || undefined,
      });
      const items = (res && res.items) || [];
      if (!items.length) {
        results.textContent = 'لا عروض مطابقة.';
        return;
      }
      items.forEach((offer) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-ghost btn-sm';
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.textAlign = 'right';
        btn.textContent = (offer.kind === 'service' ? 'خدمة' : 'منتج') + ': ' + offer.nameAr + ' · المالك: ' + offer.ownerNameAr + (offer.mine ? ' (عرضك)' : '');
        btn.onclick = () => {
          kind.value = offer.kind;
          targetId.value = offer.id;
          selected.textContent = 'المختار: ' + offer.nameAr + ' · المالك: ' + offer.ownerNameAr;
        };
        results.appendChild(btn);
      });
    } catch (error) {
      results.textContent = error.message;
    }
  }

  let searchTimer = null;
  search.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadOffers, 250);
  };
  kindSelect.onchange = loadOffers;
  loadOffers();

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
    if (!targetId.value.trim()) {
      status.textContent = 'اختاري عرضًا من القائمة أولًا.';
      return;
    }
    if (form.dataset.saving === '1') return;
    form.dataset.saving = '1';
    const idleLabel = save.textContent;
    save.disabled = true;
    save.setAttribute('aria-busy', 'true');
    save.classList.add('is-busy');
    save.textContent = 'جارٍ الحفظ';
    const payload = { targetKind: kind.value.trim(), targetId: targetId.value.trim(), captionAr: caption.value };
    try {
      let saved = item;
      if (item) await PartnersApi.updateAd(item.id, payload);
      else saved = await PartnersApi.createAd(payload);
      save.classList.remove('is-busy');
      save.classList.add('is-success');
      save.textContent = 'تم الحفظ';
      status.textContent = item ? 'حُفظت المسودة' : 'أُنشئت المسودة — أضيفي الوسائط ثم انشري.';
      status.classList.add('save-ok');
      if (window.MiraMotion) MiraMotion.announce(status.textContent);
      const adId = item ? item.id : (saved && saved.id);
      if (adId) renderAdMediaEditor(adId, status);
      if (typeof load === 'function') load();
    } catch (error) {
      form.dataset.saving = '';
      status.textContent = error.message + ' البيانات المكتوبة ما زالت في النموذج.';
      save.disabled = false;
      save.removeAttribute('aria-busy');
      save.classList.remove('is-busy');
      save.textContent = idleLabel;
      if (window.MiraMotion) MiraMotion.announce(status.textContent);
    }
  };
}
