(function () {
  const PRODUCT_CATEGORIES = [
    ['face', 'الوجه'],
    ['body', 'الجسم'],
    ['hair', 'الشعر'],
    ['clothes', 'الملابس'],
    ['accessories', 'الإكسسوارات'],
  ];
  const SERVICE_CATEGORIES = [
    ['hair', 'الشعر'],
    ['skin', 'البشرة'],
    ['makeup', 'المكياج'],
    ['nails', 'الأظافر'],
    ['care', 'العناية'],
    ['laser', 'الليزر'],
    ['teeth', 'الأسنان'],
  ];
  const CLINIC_CATEGORIES = [
    ['skin', 'البشرة'],
    ['hair', 'الشعر'],
    ['laser', 'الليزر'],
    ['teeth', 'الأسنان'],
  ];
  const SALON_CATEGORIES = [
    ['hair', 'الشعر'],
    ['makeup', 'المكياج'],
    ['nails', 'الأظافر'],
    ['care', 'العناية'],
  ];
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const staged = { catalogForm: [], serviceForm: [] };

  function formatPrice(halalas) {
    const value = Number(halalas);
    if (!Number.isFinite(value)) return '';
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(Math.trunc(value));
    const riyals = Math.floor(abs / 100);
    const fraction = abs % 100;
    return sign + (fraction ? riyals + '.' + String(fraction).padStart(2, '0') : String(riyals)) + ' ر.س';
  }

  function halalasToInput(halalas) {
    if (halalas == null || halalas === '') return '';
    const abs = Math.abs(Math.trunc(Number(halalas)));
    if (!Number.isFinite(abs)) return '';
    const fraction = abs % 100;
    return fraction ? Math.floor(abs / 100) + '.' + String(fraction).padStart(2, '0') : String(Math.floor(abs / 100));
  }

  function riyalsToHalalas(raw) {
    const text = String(raw ?? '').trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
    const parts = text.split('.');
    return Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0').slice(0, 2));
  }

  function text(parent, value, tag) {
    const node = document.createElement(tag || 'div');
    node.textContent = value == null ? '' : String(value);
    parent.appendChild(node);
    return node;
  }

  function categoryLabel(type, key) {
    const rows = type === 'brand' ? PRODUCT_CATEGORIES : SERVICE_CATEGORIES;
    const found = rows.find((row) => row[0] === key);
    return found ? found[1] : (key || 'بدون تصنيف');
  }

  function fileExt(file) {
    const name = String(file && file.name || '').toLowerCase();
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot) : '';
  }

  function isPhoneVideo(file) {
    const type = String(file && file.type || '').toLowerCase();
    const ext = fileExt(file);
    return type === 'video/mp4' || type === 'video/quicktime' || type === 'video/x-m4v'
      || ext === '.mov' || ext === '.m4v' || ext === '.mp4';
  }

  function isPhoneImage(file) {
    const type = String(file && file.type || '').toLowerCase();
    const ext = fileExt(file);
    return IMAGE_TYPES.indexOf(type) >= 0 || type === 'image/jpg' || type === 'image/heic' || type === 'image/heif'
      || ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp' || ext === '.heic' || ext === '.heif';
  }

  function uploadMime(file) {
    const type = String(file && file.type || '').toLowerCase();
    if (type === 'image/jpg') return 'image/jpeg';
    if (IMAGE_TYPES.indexOf(type) >= 0) return type;
    if (isPhoneVideo(file)) return 'video/mp4';
    return type;
  }

  function isHeic(file) {
    const type = String(file && file.type || '').toLowerCase();
    const ext = fileExt(file);
    return type === 'image/heic' || type === 'image/heif' || ext === '.heic' || ext === '.heif';
  }

  function heicToJpeg(file) {
    return createImageBitmap(file).then((bitmap) => new Promise((resolve, reject) => {
      const maxEdge = 2000;
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close && bitmap.close();
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('تعذر تحويل صورة الآيفون'));
          return;
        }
        const base = String(file.name || 'photo').replace(/\.[^.]+$/, '');
        resolve(new File([blob], base + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified }));
      }, 'image/jpeg', 0.9);
    }));
  }

  let uploadSessionPolicyCache = null;
  let uploadSessionPolicyPromise = null;

  function loadUploadSessionPolicy() {
    if (uploadSessionPolicyCache && uploadSessionPolicyCache._source === 'ok') {
      return Promise.resolve(uploadSessionPolicyCache);
    }
    if (uploadSessionPolicyPromise) return uploadSessionPolicyPromise;
    if (!window.PartnersApi || typeof PartnersApi.uploadSessionPolicy !== 'function') {
      return Promise.resolve({ enabled: false, _source: 'unavailable' });
    }
    uploadSessionPolicyPromise = PartnersApi.uploadSessionPolicy()
      .then((policy) => {
        uploadSessionPolicyCache = Object.assign({}, policy || { enabled: false }, { _source: 'ok' });
        uploadSessionPolicyPromise = null;
        return uploadSessionPolicyCache;
      })
      .catch((error) => {
        uploadSessionPolicyPromise = null;
        // Network/server error is NOT a decision to fall back to Base64.
        return { enabled: null, _source: 'error', error: error && error.message };
      });
    return uploadSessionPolicyPromise;
  }

  function mediaProblem(file, policy) {
    const image = isPhoneImage(file) && !isPhoneVideo(file);
    const video = isPhoneVideo(file);
    if (!image && !video) return 'الصيغة غير مقبولة. الصور: JPEG أو PNG أو WebP أو صورة الآيفون. الفيديو: MP4 أو MOV.';
    const sessionOn = policy && policy.enabled;
    const imageMax = sessionOn && policy.imageMaxBytes ? policy.imageMaxBytes : 5 * 1024 * 1024;
    const videoMax = sessionOn && policy.videoMaxBytes ? policy.videoMaxBytes : 70 * 1024 * 1024;
    if (image && file.size > imageMax && !isHeic(file)) {
      return sessionOn ? 'الصورة أكبر من الحد المسموح.' : 'الصورة أكبر من 5 ميغابايت.';
    }
    if (video && file.size > videoMax) {
      return 'حجم الملف يتجاوز حد الرفع على هذا الخادم. المدة المسموحة 5 دقائق.';
    }
    return '';
  }

  function videoDurationSeconds(file) {
    return new Promise((resolve) => {
      let url = '';
      try { url = URL.createObjectURL(file); } catch (_) { resolve(null); return; }
      const video = document.createElement('video');
      const finish = (value) => {
        URL.revokeObjectURL(url);
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), 8000);
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        finish(Number.isFinite(video.duration) ? video.duration : null);
      };
      video.onerror = () => { clearTimeout(timer); finish(null); };
      video.src = url;
    });
  }

  function bytesToBase64(bytes, onProgress) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      if (typeof onProgress === 'function' && bytes.length) onProgress(Math.min(1, (i + chunk) / bytes.length));
    }
    return btoa(binary);
  }

  function fileToBase64(file, onProgress, signal) {
    const abortError = () => Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' });
    if (signal && signal.aborted) return Promise.reject(abortError());
    if (typeof onProgress === 'function') onProgress(0);
    const read = file && typeof file.arrayBuffer === 'function'
      ? file.arrayBuffer()
      : readWithFileReader(file, onProgress, signal);
    return Promise.resolve(read).then((buffer) => {
      if (signal && signal.aborted) throw abortError();
      if (typeof buffer === 'string') return buffer;
      return bytesToBase64(new Uint8Array(buffer), onProgress);
    }).catch((error) => {
      if (error && error.name === 'AbortError') throw error;
      const message = error && error.message ? error.message : '';
      if (message.indexOf('FileReader') >= 0 || message.indexOf('arrayBuffer') >= 0) {
        throw new Error('هذا المتصفح لا يقرأ الملفات. افتحي الصفحة في سفاري ثم أعيدي الاختيار.');
      }
      throw error instanceof Error ? error : new Error('تعذرت قراءة الملف');
    });
  }

  function readWithFileReader(file, onProgress, signal) {
    return new Promise((resolve, reject) => {
      const Reader = typeof FileReader === 'function' ? FileReader : null;
      if (!Reader) {
        reject(new Error('هذا المتصفح لا يقرأ الملفات. افتحي الصفحة في سفاري ثم أعيدي الاختيار.'));
        return;
      }
      const reader = new Reader();
      const stop = () => {
        reader.abort();
        reject(Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' }));
      };
      if (signal) {
        if (signal.aborted) { stop(); return; }
        signal.addEventListener('abort', stop, { once: true });
      }
      reader.onprogress = (event) => {
        if (typeof onProgress !== 'function') return;
        if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
        else onProgress(null);
      };
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(reader.error || new Error('تعذرت قراءة الملف'));
      reader.readAsDataURL(file);
    });
  }

  function validUrl(value) {
    try {
      const uri = new URL(String(value || '').trim());
      return (uri.protocol === 'https:' || uri.protocol === 'http:') && uri.hostname.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Unified form target for product/service across partner types.
   * Salon/clinic partners edit services in catalogForm (dashboard load path).
   * Developer keeps services in serviceForm.
   * preferredFormId wins when reloading the form the user is already on.
   */
  function resolveFormTarget(kind, preferredFormId) {
    const partnerType = (window.sessionPartner && window.sessionPartner.type) || 'salon';
    const developer = partnerType === 'developer';
    if (preferredFormId === 'catalogForm' || preferredFormId === 'serviceForm') {
      const type =
        kind === 'product'
          ? 'brand'
          : partnerType === 'clinic'
            ? 'clinic'
            : partnerType === 'salon'
              ? 'salon'
              : 'salon';
      return {
        formId: preferredFormId,
        titleId: preferredFormId === 'serviceForm' ? 'serviceTitle' : 'catalogTitle',
        type: kind === 'product' ? 'brand' : type,
        partnerType: partnerType,
      };
    }
    if (kind === 'product') {
      return { formId: 'catalogForm', titleId: 'catalogTitle', type: 'brand', partnerType: partnerType };
    }
    if (developer) {
      return {
        formId: 'serviceForm',
        titleId: 'serviceTitle',
        type: partnerType === 'clinic' ? 'clinic' : 'salon',
        partnerType: partnerType,
      };
    }
    return {
      formId: 'catalogForm',
      titleId: 'catalogTitle',
      type: partnerType === 'clinic' ? 'clinic' : 'salon',
      partnerType: partnerType,
    };
  }

  /**
   * Full server-draft rehydrate (same path as opening a draft from the list).
   * Used by conflict reload so price/options/serviceProfile map correctly.
   */
  function reopenServerDraft(draft, note, preferredFormId) {
    if (!draft || !draft.clientDraftId) throw new Error('مسودة غير صالحة لإعادة التعبئة');
    const target = resolveFormTarget(draft.kind || 'product', preferredFormId);
    const values = draft.values || {};
    const stub = draft.targetOwnerId
      ? {
          id: draft.targetOwnerId,
          nameAr: values.nameAr || '',
          nameEn: values.nameEn || '',
          priceHalalas: values.priceHalalas,
          category: values.category || '',
          durationMin: values.durationMin,
          descriptionAr: values.descriptionAr || '',
          purchaseMode: values.purchaseMode,
          stockQty: values.stockQty,
          deliveryFeeHalalas: values.deliveryFeeHalalas,
          optionsJson: values.optionsJson,
          variantsJson: values.variantsJson,
          colors: values.colors,
          sizes: values.sizes,
          reviewRevision: draft.serviceReviewRevision,
        }
      : null;
    const draftCtx = {
      clientDraftId: draft.clientDraftId,
      kind: draft.kind,
      profileId: draft.profileId,
      schemaVersion: draft.schemaVersion,
      revision: draft.revision,
      targetOwnerId: draft.targetOwnerId || null,
      status: draft.status,
      submitReviewStatus: draft.submitReviewStatus || null,
      values: values,
      serviceReviewRevision:
        draft.serviceReviewRevision != null
          ? draft.serviceReviewRevision
          : values && values._serviceReviewRevision != null
            ? values._serviceReviewRevision
            : null,
    };
    renderForm(
      target.type,
      stub,
      target.formId,
      target.titleId,
      note || ('مسودة خادمية ' + draft.clientDraftId + ' · rev ' + draft.revision),
      draftCtx,
    );
    return {
      formId: target.formId,
      revision: draft.revision,
      clientDraftId: draft.clientDraftId,
      type: target.type,
    };
  }

  window.CatalogJourney = {
    formatPrice: formatPrice,
    renderCatalog: renderCatalog,
    renderForm: renderForm,
    refreshLists: refreshLists,
    reopenServerDraft: reopenServerDraft,
    resolveFormTarget: resolveFormTarget,
  };

  async function refreshLists() {
    const data = await PartnersApi.dashboard();
    const partner = data.partner;
    const developer = partner.type === 'developer';
    if (developer) {
      renderCatalog('brand', data.catalog, 'catalogList', 'catalogForm', 'catalogTitle');
      renderCatalog('clinic', data.catalog, 'serviceList', 'serviceForm', 'serviceTitle');
      return;
    }
    renderCatalog(partner.type, data.catalog, 'catalogList', 'catalogForm', 'catalogTitle');
  }

  function renderCatalog(type, catalog, listId, formId, titleId) {
    const list = document.getElementById(listId || 'catalogList');
    const items = type === 'brand' ? catalog.products : catalog.services;
    list.replaceChildren();
    if (!items.length) {
      text(list, 'لا عناصر بعد في هذا الحساب. الكتالوج العام لا يُحذف من هنا.', 'p');
      return;
    }
    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'list-item';
      text(card, item.nameAr, 'strong');
      text(card, 'الحالة: ' + (item.contentStatus || 'draft') + ' · المراجعة: ' + (item.reviewStatus || 'draft') + ' · ' + categoryLabel(type, item.category));
      text(card, formatPrice(item.priceHalalas));
      if (item.reviewNote) text(card, 'سبب المراجعة: ' + item.reviewNote);
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'btn btn-ghost btn-sm';
      open.textContent = 'فتح في النموذج';
      open.onclick = () => {
        renderForm(type, item, formId, titleId);
        document.getElementById(formId).scrollIntoView({
          behavior: window.MiraMotion && MiraMotion.reduced() ? 'auto' : 'smooth',
          block: 'start',
        });
      };
      const pull = document.createElement('button');
      pull.type = 'button';
      pull.className = 'btn btn-ghost btn-sm';
      pull.textContent = 'سحب';
      pull.onclick = async () => {
        if (!confirm('سحب هذا العنصر من النشر؟')) return;
        try {
          if (type === 'brand') await PartnersApi.deleteProduct(item.id);
          else await PartnersApi.deleteService(item.id);
          if (window.reloadPartnerDashboard) await window.reloadPartnerDashboard();
        } catch (error) {
          text(card, 'تعذر السحب: ' + error.message, 'p');
        }
      };
      card.append(open, pull);
      list.appendChild(card);
    });
  }

  function field(form, label, name, value, type) {
    const wrap = document.createElement('div');
    const caption = document.createElement('label');
    caption.textContent = label;
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    input.name = name;
    if (type && type !== 'textarea') input.type = type;
    input.value = value == null ? '' : String(value);
    const error = document.createElement('div');
    error.className = 'field-error';
    error.dataset.for = name;
    wrap.append(caption, input, error);
    form.appendChild(wrap);
    return input;
  }

  function setFieldError(form, name, message) {
    const node = form.querySelector('.field-error[data-for="' + name + '"]');
    if (node) node.textContent = message || '';
  }

  function selectField(form, label, name, value, options) {
    const wrap = document.createElement('div');
    const caption = document.createElement('label');
    caption.textContent = label;
    const select = document.createElement('select');
    select.name = name;
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'اختاري';
    select.appendChild(empty);
    options.forEach((option) => {
      const node = document.createElement('option');
      node.value = option[0];
      node.textContent = option[1];
      if (option[0] === value) node.selected = true;
      select.appendChild(node);
    });
    const error = document.createElement('div');
    error.className = 'field-error';
    error.dataset.for = name;
    wrap.append(caption, select, error);
    form.appendChild(wrap);
    return select;
  }

  function renderForm(type, item, formId, titleId, note, draftCtx) {
    const form = document.getElementById(formId || 'catalogForm');
    form.dataset.saving = '';
    const title = document.getElementById(titleId || 'catalogTitle');
    const serviceSection = document.getElementById('serviceSection');
    const fullCatalog = Boolean(serviceSection && !serviceSection.classList.contains('hidden'));
    if (title && !fullCatalog) title.textContent = type === 'brand' ? 'منتجاتك' : 'خدماتك';
    const previous = staged[form.id] || [];
    const sameItem = item && previous.ownerId === item.id;
    staged[form.id] = sameItem ? previous : [];
    if (item) staged[form.id].ownerId = item.id;
    if (window.MiraEditorV2) {
      // Only cancel this form's queue — do not abort product save when opening service.
      MiraEditorV2.cancelFormPending(form.id, 'form-replace:' + form.id);
      MiraEditorV2.clearEditContext(form.id);
    }
    form.replaceChildren();

    const seed = Object.assign({}, item || {}, (draftCtx && draftCtx.values) || {});
    const editing = Boolean(item && item.id);
    const seedingDraft = Boolean(draftCtx && draftCtx.clientDraftId);
    const kind = type === 'brand' ? 'product' : 'service';
    if (window.MiraEditorV2 && seedingDraft) {
      MiraEditorV2.bindEditContext(form.id, {
        clientDraftId: draftCtx.clientDraftId,
        kind: draftCtx.kind || kind,
        profileId: draftCtx.profileId || null,
        schemaVersion: draftCtx.schemaVersion,
        revision: draftCtx.revision,
        targetOwnerId: draftCtx.targetOwnerId || (item && item.id) || null,
        status: draftCtx.status,
        submitReviewStatus: draftCtx.submitReviewStatus,
        values: draftCtx.values || {},
        serviceReviewRevision:
          draftCtx.serviceReviewRevision != null ? draftCtx.serviceReviewRevision : null,
      });
    } else if (window.MiraEditorV2 && !editing) {
      // Explicit new draft identity for this form session.
      const newId = MiraEditorV2.allocateNewDraftId(kind);
      MiraEditorV2.bindEditContext(form.id, {
        clientDraftId: newId,
        kind: kind,
        profileId: null,
        revision: null,
        targetOwnerId: null,
        status: 'draft',
        values: {},
      });
    } else if (window.MiraEditorV2 && editing) {
      MiraEditorV2.bindEditContext(form.id, {
        clientDraftId: MiraEditorV2.clientDraftIdFor(kind, item.id, form.id),
        kind: kind,
        targetOwnerId: item.id,
        revision: null,
        values: {},
        serviceReviewRevision: item.reviewRevision != null ? item.reviewRevision : null,
      });
    }

    const developerAccount = Boolean(window.sessionPartner && window.sessionPartner.type === 'developer');
    const priceLabel =
      seed.priceHalalas == null || seed.priceHalalas === ''
        ? 'غير محدد'
        : (formatPrice(seed.priceHalalas) + ' · ' + seed.priceHalalas + ' هللة');
    const status = text(form, note || (developerAccount
      ? 'حساب المطوّر: بعد الاسم والسعر والتصنيف، اختيار الملف يرفع بالنسبة وينشر في التطبيق مباشرة.'
      : (editing
        ? 'مسودة على المعرف نفسه. السعر الظاهر ' + priceLabel + '. التعديل لا ينشر قبل اعتماد الإدارة.'
        : (seedingDraft
          ? 'مسودة خادمية ' + draftCtx.clientDraftId + ' · rev ' + draftCtx.revision
          : 'مسودة جديدة. لا يُطلب رابط متجر، والسعر يُكتب بالريال.'))));
    status.setAttribute('data-catalog-persist-status', '1');
    if (item && item.reviewNote) text(form, 'سبب المراجعة: ' + item.reviewNote);
    if (item && item.draftNameAr) text(form, 'اسم المسودة: ' + item.draftNameAr + ' · المنشور: ' + (item.nameAr || ''));
    if (draftCtx && draftCtx.submitReviewStatus) {
      text(form, 'حالة إرسال المراجعة للمسودة: ' + draftCtx.submitReviewStatus);
    }

    const basics = document.createElement('div');
    basics.className = 'form-section';
    text(basics, 'البيانات الأساسية', 'h3');
    form.appendChild(basics);
    const nameSeed = seed.draftNameAr || seed.nameAr || '';
    const nameAr = field(basics, 'الاسم', 'nameAr', nameSeed, 'text');
    const nameEn = field(basics, 'الاسم بالإنجليزية (اختياري)', 'nameEn', seed.draftNameEn != null ? seed.draftNameEn : (seed.nameEn || ''), 'text');
    const descriptionAr = field(basics, 'الوصف', 'descriptionAr', seed.draftDescriptionAr != null ? seed.draftDescriptionAr : (seed.descriptionAr || ''), 'textarea');
    const categories = type === 'brand'
      ? PRODUCT_CATEGORIES
      : (type === 'clinic' ? CLINIC_CATEGORIES : (type === 'salon' ? SALON_CATEGORIES : SERVICE_CATEGORIES));
    const category = selectField(basics, 'التصنيف', 'category', seed.category || '', categories);
    const priceSeed =
      seed.priceHalalas == null || seed.priceHalalas === ''
        ? ''
        : halalasToInput(seed.priceHalalas);
    const price = field(basics, 'السعر بالريال', 'priceSar', priceSeed, 'text');
    price.inputMode = 'decimal';
    price.placeholder = '52';
    nameAr.addEventListener('input', bumpFormContentEpoch);
    nameEn.addEventListener('input', bumpFormContentEpoch);
    descriptionAr.addEventListener('input', bumpFormContentEpoch);
    price.addEventListener('input', bumpFormContentEpoch);
    category.addEventListener('change', bumpFormContentEpoch);

    const cosmetic = document.createElement('div');
    const skin = field(cosmetic, 'نوع البشرة (اختياري)', 'skinTypes', (seed.skinTypes || []).join ? (seed.skinTypes || []).join(', ') : (seed.skinTypes || ''), 'text');
    const step = field(cosmetic, 'خطوة الروتين (اختياري)', 'stepAr', seed.stepAr || '', 'text');
    skin.addEventListener('input', bumpFormContentEpoch);
    skin.addEventListener('change', bumpFormContentEpoch);
    step.addEventListener('input', bumpFormContentEpoch);
    step.addEventListener('change', bumpFormContentEpoch);
    if (type === 'brand') basics.appendChild(cosmetic);

    let duration = null;
    let bookingToggle = null;
    let availabilityJson = null;
    if (type !== 'brand') {
      duration = field(basics, 'المدة بالدقائق (اختياري)', 'durationMin', seed.durationMin != null && seed.durationMin !== '' ? seed.durationMin : '', 'number');
      duration.min = '5';      const partner = window.sessionPartner || {};
      text(basics, 'الفرع والمدينة المسجّلة: ' + (partner.city || 'غير مسجّلة') + '. لا توجد إحداثيات فرع.');
      text(basics, partner.contactPhone ? 'وسيلة التواصل: ' + partner.contactPhone : 'لا توجد وسيلة تواصل مسجّلة على حساب الجهة.');
      const bookingWrap = document.createElement('label');
      bookingWrap.className = 'check-row';
      bookingToggle = document.createElement('input');
      bookingToggle.type = 'checkbox';
      bookingToggle.name = 'bookingEnabled';
      bookingToggle.checked = Boolean(editing && item.bookingEnabled);
      bookingToggle.addEventListener('change', bumpFormContentEpoch);
      bookingWrap.append(bookingToggle, document.createTextNode(' تفعيل طلب الموعد داخل ميرا (بانتظار قبول الجهة)'));
      basics.appendChild(bookingWrap);
      text(basics, 'الدفع لدى الجهة عند الموعد. لا تُطبَّق عبارة الدفع عند الاستلام الخاصة بالمنتجات على الخدمات.');
      const availBox = document.createElement('div');
      availBox.className = 'form-section';
      text(availBox, 'أيام العمل والفترات والسعة', 'h3');
      text(availBox, 'كل يوم يعمل بفترة واحدة وسعة واحدة. الفترات المتداخلة لنفس المورد تُرفض عند الحفظ. لا حاجة لتعديل قاعدة البيانات يدويًا.');
      const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const defaultWindows = editing && Array.isArray(item.availabilityJson) && item.availabilityJson.length
        ? item.availabilityJson
        : [0, 1, 2, 3, 4].map((d) => ({ weekday: d, startMin: 540, endMin: 1020, capacity: 1, resourceId: '' }));
      const availState = dayNames.map((_, weekday) => {
        const hit = defaultWindows.find((w) => Number(w.weekday) === weekday);
        return {
          on: Boolean(hit),
          start: hit ? String(Math.floor(hit.startMin / 60)).padStart(2, '0') + ':' + String(hit.startMin % 60).padStart(2, '0') : '09:00',
          end: hit ? String(Math.floor(hit.endMin / 60)).padStart(2, '0') + ':' + String(hit.endMin % 60).padStart(2, '0') : '17:00',
          capacity: hit ? String(hit.capacity || 1) : '1',
          resourceId: hit && hit.resourceId ? String(hit.resourceId) : '',
        };
      });
      dayNames.forEach((name, weekday) => {
        const row = document.createElement('div');
        row.className = 'check-row';
        const on = document.createElement('input');
        on.type = 'checkbox';
        on.checked = availState[weekday].on;
        on.onchange = () => {
          availState[weekday].on = on.checked;
          bumpFormContentEpoch();
        };
        const start = document.createElement('input');
        start.type = 'time';
        start.value = availState[weekday].start;
        start.onchange = () => {
          availState[weekday].start = start.value;
          bumpFormContentEpoch();
        };
        const end = document.createElement('input');
        end.type = 'time';
        end.value = availState[weekday].end;
        end.onchange = () => {
          availState[weekday].end = end.value;
          bumpFormContentEpoch();
        };
        const cap = document.createElement('input');
        cap.type = 'number';
        cap.min = '1';
        cap.max = '100';
        cap.value = availState[weekday].capacity;
        cap.style.width = '4rem';
        cap.onchange = () => {
          availState[weekday].capacity = cap.value;
          bumpFormContentEpoch();
        };
        const res = document.createElement('input');
        res.type = 'text';
        res.placeholder = 'معرّف المورد (اختياري، مثل غرفة-أ)';
        res.value = availState[weekday].resourceId;
        res.onchange = () => {
          availState[weekday].resourceId = res.value.trim();
          bumpFormContentEpoch();
        };
        res.title = 'نفس المعرّف يُستخدم في التوفر والحجز. حروف عربية مسموحة دون مسافات.';
        row.append(on, document.createTextNode(' ' + name + ' '), start, document.createTextNode(' — '), end, document.createTextNode(' سعة '), cap, res);
        availBox.appendChild(row);
      });
      const unifyWrap = document.createElement('label');
      unifyWrap.className = 'check-row';
      const unifyToggle = document.createElement('input');
      unifyToggle.type = 'checkbox';
      unifyToggle.name = 'unifySharedResources';
      unifyToggle.addEventListener('change', bumpFormContentEpoch);
      unifyWrap.append(
        unifyToggle,
        document.createTextNode(' توحيد سعة المورد المشترك في كل خدمات جهتي عند التعارض'),
      );
      availBox.appendChild(unifyWrap);
      const unifyPreview = document.createElement('p');
      unifyPreview.className = 'muted';
      unifyPreview.setAttribute('data-unify-preview', '1');
      unifyPreview.textContent = 'عند التفعيل تُحدَّث سعة المورد في كل خدمات جهتك التي تشارك نفس معرّف المورد، ضمن حفظ واحد. راجعي أسماء الخدمات في رسالة التعارض قبل التأكيد.';
      availBox.appendChild(unifyPreview);
      text(availBox, 'عند تعارض سعات قديمة لنفس المورد تُرفض الحجوزات الجديدة حتى التوحيد. لا تُلغى الحجوزات القائمة تلقائيًا.');
      basics.appendChild(availBox);
      availabilityJson = {
        unifyToggle: unifyToggle,
        build: function () {
          const windows = [];
          availState.forEach((day, weekday) => {
            if (!day.on) return;
            const sm = day.start.split(':').map(Number);
            const em = day.end.split(':').map(Number);
            const startMin = sm[0] * 60 + sm[1];
            const endMin = em[0] * 60 + em[1];
            const capacity = parseInt(day.capacity, 10);
            if (!Number.isInteger(startMin) || !Number.isInteger(endMin) || endMin <= startMin) {
              throw new Error('وقت غير صالح ليوم ' + dayNames[weekday]);
            }
            if (!Number.isInteger(capacity) || capacity < 1) {
              throw new Error('السعة يجب أن تكون عددًا ≥ 1 ليوم ' + dayNames[weekday]);
            }
            windows.push({ weekday: weekday, startMin: startMin, endMin: endMin, capacity: capacity, resourceId: day.resourceId || '' });
          });
          return windows;
        },
      };
    }

    const templateSection = document.createElement('div');
    templateSection.className = 'form-section';
    templateSection.hidden = type === 'brand';
    text(templateSection, 'قالب الخدمة وخصائصها', 'h3');
    text(templateSection, 'الحقول تتغير حسب نوع الخدمة. لا تُحدد الخدمات المشمولة أو المتطلبات تلقائيًا. الحفظ المحلي للخصائص حتى يتوفر تخزين دائم للحقول.');
    const templateSelect = document.createElement('select');
    templateSelect.name = 'serviceTemplateId';
    const templateBody = document.createElement('div');
    const templatePreview = document.createElement('div');
    templatePreview.className = 'options-preview';
    templateSection.append(templateSelect, templateBody, templatePreview);
    // inserted before media once mediaSection exists

    function loadServiceTemplateDraft(id) {
      try {
        const key = window.MiraEditorV2
          ? MiraEditorV2.scopedTemplateKey(id || 'new')
          : ('mira-service-template:' + (id || 'new'));
        const raw = localStorage.getItem(key);
        if (!raw) return { templateId: '', answers: {}, priceMode: 'fixed', templateVersion: 1 };
        return Object.assign({ templateId: '', answers: {}, priceMode: 'fixed', templateVersion: 1 }, JSON.parse(raw));
      } catch (error) {
        return { templateId: '', answers: {}, priceMode: 'fixed', templateVersion: 1 };
      }
    }

    // Prefer server draft profile (loaded before paint) over shared localStorage keys.
    // Deep-copy answers so later mutations do not alias into preserveCtx by accident.
    const templateState = (draftCtx && draftCtx.values && draftCtx.values.serviceProfile)
      ? Object.assign(
          { templateId: '', answers: {}, priceMode: 'fixed', templateVersion: 1 },
          draftCtx.values.serviceProfile,
          {
            answers: Object.assign(
              {},
              (draftCtx.values.serviceProfile && draftCtx.values.serviceProfile.answers) || {},
            ),
          },
        )
      : loadServiceTemplateDraft(editing ? item.id : null);

    /**
     * Revision the user actually read for this service profile.
     * Never refresh to "latest" at save time to sneak old answers past conflict checks.
     * Do NOT seed from item.reviewRevision alone — that tip belongs to server profile data,
     * not whatever localStorage painted before bind completes (RC9-F1).
     */
    let boundServiceReviewRevision =
      draftCtx && draftCtx.serviceReviewRevision != null
        ? draftCtx.serviceReviewRevision
        : null;
    let serviceProfileBindPromise = null;
    let serviceProfileBindStatus =
      boundServiceReviewRevision != null && draftCtx && draftCtx.values && draftCtx.values.serviceProfile
        ? 'bound'
        : 'idle';
    /** Snapshot of local template edits taken before a bind read. */
    let templateEditsDuringBind = null;
    /** Fingerprint of templateState that matches boundServiceReviewRevision (null if divergent). */
    let boundProfileFingerprint = null;
    /** Bumps whenever the user edits fields after paint — used to detect newer edits during in-flight save. */
    let formContentEpoch = 0;
    /** Epoch captured when the last persist request finished applying its own snapshot. */
    let lastSettledPersistEpoch = null;
    /** Token of the in-flight persistListing for THIS form instance — only the owner may clear busy. */
    let activePersistToken = null;
    let programmaticPaintDepth = 0;
    function withProgrammaticPaint(fn) {
      programmaticPaintDepth += 1;
      try {
        return fn();
      } finally {
        programmaticPaintDepth -= 1;
      }
    }
    function bumpFormContentEpoch() {
      if (programmaticPaintDepth > 0) return;
      formContentEpoch += 1;
      // If a prior save already announced success, immediately correct the visible UX.
      if (
        lastSettledPersistEpoch != null &&
        formContentEpoch > lastSettledPersistEpoch &&
        form.dataset.saving !== '1'
      ) {
        paintUnsavedNewerNotice();
      }
    }
    function paintUnsavedNewerNotice(extraNote) {
      if (!status) return;
      const stripped = String(status.textContent || '')
        .replace(/\s*توجد تعديلات أحدث في النموذج[^]*?(?:احفظي مرة أخرى(?: للإصدار الحالي)?\.?)/g, '')
        .trim();
      const base = stripped || extraNote || 'حُفظت نسخة سابقة على الخادم.';
      const note =
        base +
        ' توجد تعديلات أحدث في النموذج لم يشملها الطلب السابق — ليست محفوظة بعد. احفظي مرة أخرى.';
      status.textContent = note;
      status.setAttribute('data-catalog-persist-status', '1');
      status.setAttribute('data-unsaved-newer', '1');
      const saveBtn = form.querySelector('#' + form.id + '-save') || form.querySelector('button[type="submit"]');
      const persistInFlight = form.dataset.saving === '1' && activePersistToken;
      if (saveBtn && !persistInFlight) {
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.classList.remove('is-busy', 'is-success');
        saveBtn.textContent = developerAccount ? 'نشر التعديلات المتبقية' : 'حفظ التعديلات المتبقية';
      } else if (saveBtn && persistInFlight) {
        // Keep ownership of busy; fields stay editable; button stays owned by the in-flight save.
        saveBtn.classList.remove('is-success');
        saveBtn.textContent = developerAccount
          ? 'جارٍ الإكمال · تعديلات أحدث معلّقة'
          : 'جارٍ الإكمال · تعديلات أحدث معلّقة';
      }
      if (window.MiraEditorV2) {
        MiraEditorV2.setStatus(form, 'تعديلات أحدث غير محفوظة', 'dirty');
      }
    }
    function hasNewerEditsThan(epoch) {
      return formContentEpoch > epoch;
    }

    function profileDocFrom(profile) {
      if (!profile) return null;
      if (profile.draftServiceProfileSet) return profile.draftServiceProfileJson;
      return profile.serviceProfileJson;
    }

    function fingerprintProfileState(state) {
      if (!state) return '';
      return JSON.stringify({
        templateId: state.templateId || '',
        templateVersion: state.templateVersion || 1,
        priceMode: state.priceMode || 'fixed',
        answers: state.answers || {},
      });
    }

    function applyServerProfileDoc(profile) {
      const doc = profileDocFrom(profile);
      // Explicit clear / empty draft wins over localStorage residue.
      if (profile.draftServiceProfileSet && (doc == null || !doc.templateId)) {
        templateState.templateId = '';
        templateState.templateVersion = 1;
        templateState.priceMode = 'fixed';
        templateState.answers = {};
      } else if (doc && doc.templateId) {
        templateState.templateId = doc.templateId;
        templateState.templateVersion = doc.templateVersion || 1;
        templateState.priceMode = doc.priceMode || 'fixed';
        templateState.answers = Object.assign({}, doc.answers || {});
      } else if (!profile.draftServiceProfileSet && (doc == null || !doc.templateId)) {
        templateState.templateId = '';
        templateState.templateVersion = 1;
        templateState.priceMode = 'fixed';
        templateState.answers = {};
      }
      boundServiceReviewRevision = profile.reviewRevision;
      boundProfileFingerprint = fingerprintProfileState(templateState);
      serviceProfileBindStatus = 'bound';
      const ctx = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
      if (ctx) ctx.serviceReviewRevision = boundServiceReviewRevision;
      if (item) item.reviewRevision = boundServiceReviewRevision;
      return profile;
    }

    /**
     * Bind profile revision ONLY with matching data.
     * Never attach a fresh server revision to stale localStorage / painted values.
     * mode:
     *  - 'server': apply server doc + its revision (open / reload).
     *  - 'keep-local-if-same': keep local only when it equals server; else conflict without bumping rev.
     *  - 'materialize-local': post-create local answers are the basis; adopt targetRevision if provided
     *    and equal-or-unknown server; never silently upgrade old localStorage over newer server.
     */
    function applyBoundServiceProfile(profile, opts) {
      if (!profile) return null;
      const mode = (opts && opts.mode) || 'server';
      const localSnap = {
        templateId: templateState.templateId,
        templateVersion: templateState.templateVersion,
        priceMode: templateState.priceMode,
        answers: Object.assign({}, templateState.answers || {}),
      };
      const serverDoc = profileDocFrom(profile);
      const localFp = fingerprintProfileState(localSnap);
      const serverFp = fingerprintProfileState(
        serverDoc && serverDoc.templateId
          ? serverDoc
          : { templateId: '', templateVersion: 1, priceMode: 'fixed', answers: {} },
      );

      if (mode === 'server') {
        return applyServerProfileDoc(profile);
      }

      if (mode === 'keep-local-if-same' || mode === 'materialize-local') {
        if (localFp === serverFp) {
          // Local already matches server — safe to adopt revision.
          boundServiceReviewRevision = profile.reviewRevision;
          boundProfileFingerprint = localFp;
          serviceProfileBindStatus = 'bound';
          const ctx = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
          if (ctx) ctx.serviceReviewRevision = boundServiceReviewRevision;
          if (item) item.reviewRevision = boundServiceReviewRevision;
          return profile;
        }
        // Divergent: keep user-visible local edits, do NOT bump revision to server tip.
        serviceProfileBindStatus = 'local-diverged';
        if (typeof showServiceProfileConflictUi === 'function') {
          showServiceProfileConflictUi(resolveOwnerId() || (item && item.id));
        }
        status.textContent =
          'نسخة القالب المحلية تختلف عن الخادم. تعديلاتك معروضة — اختر إعادة التحميل أو أبقها ثم احفظ بعد حل التعارض.';
        return { conflict: true, profile: profile, localFp: localFp, serverFp: serverFp };
      }

      return applyServerProfileDoc(profile);
    }

    /**
     * Bind service profile revision after materialize / when owner becomes known mid-session.
     */
    function ensureServiceProfileBound(ownerId, opts) {
      if (type === 'brand' || !ownerId || !window.PartnersApi) {
        return Promise.resolve(null);
      }
      if (boundServiceReviewRevision != null && boundProfileFingerprint && !(opts && opts.force)) {
        return Promise.resolve({ reviewRevision: boundServiceReviewRevision, alreadyBound: true });
      }
      if (serviceProfileBindPromise && !(opts && opts.force)) return serviceProfileBindPromise;
      serviceProfileBindStatus = 'binding';
      const bindGen =
        (window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id) || {}).formGeneration || 0;
      const bindDraft =
        (window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id) || {}).clientDraftId || null;
      templateEditsDuringBind = {
        templateId: templateState.templateId,
        templateVersion: templateState.templateVersion,
        priceMode: templateState.priceMode,
        answers: Object.assign({}, templateState.answers || {}),
      };
      const bindOwner = ownerId;
      const mode = (opts && opts.mode) || 'server';
      serviceProfileBindPromise = PartnersApi.getServiceProfile(bindOwner)
        .then((profile) => {
          const live = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
          const liveOwner = resolveOwnerId();
          if (
            (liveOwner && liveOwner !== bindOwner) ||
            (bindDraft && live && live.clientDraftId !== bindDraft) ||
            (bindGen && live && live.formGeneration !== bindGen)
          ) {
            serviceProfileBindStatus = 'stale';
            return null;
          }
          const userEditedDuring =
            templateEditsDuringBind &&
            fingerprintProfileState(templateState) !== fingerprintProfileState(templateEditsDuringBind);
          // If revision was already bound (e.g. targetReviewRevision after materialize) and the user
          // edited afterward, keep those edits under THAT revision — do not treat as stale-local conflict.
          if (userEditedDuring && boundServiceReviewRevision != null) {
            serviceProfileBindStatus = 'bound';
            boundProfileFingerprint = fingerprintProfileState(templateState);
            const ctx = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
            if (ctx) ctx.serviceReviewRevision = boundServiceReviewRevision;
            return { reviewRevision: boundServiceReviewRevision, userEditedDuring: true };
          }
          // Presence of a local templateId alone is NOT a reason to keep local + adopt fresh revision.
          let resolvedMode = mode;
          if (userEditedDuring) resolvedMode = 'keep-local-if-same';
          else if (opts && opts.mode) resolvedMode = opts.mode;
          else resolvedMode = 'server';
          const result = applyBoundServiceProfile(profile, { mode: resolvedMode });
          if (result && !result.conflict && typeof paintServiceTemplates === 'function') {
            try {
              withProgrammaticPaint(() => paintServiceTemplates());
            } catch (_) {}
          }
          return result;
        })
        .catch(() => {
          serviceProfileBindStatus = 'error';
          return null;
        });
      return serviceProfileBindPromise;
    }

    // Existing service open: always load authoritative server profile + its revision together.
    // LocalStorage must not win. Intentional mid-edit keep uses conflict UI, not silent rev bump.
    if (type !== 'brand' && item && item.id && window.PartnersApi) {
      const seededFromDraftProfile = Boolean(
        draftCtx && draftCtx.values && draftCtx.values.serviceProfile && draftCtx.values.serviceProfile.templateId,
      );
      serviceProfileBindPromise = ensureServiceProfileBound(item.id, {
        force: true,
        mode: seededFromDraftProfile ? 'keep-local-if-same' : 'server',
      });
    }

    const REGISTRY_SIZE_IDS = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
    const REGISTRY_COLOR_IDS = new Set(['black', 'ivory', 'brown', 'pink', 'blue', 'green', 'multi']);

    /**
     * Live owner id — never rely on the `editing` snapshot from form build time.
     * After materialize / resume, targetOwnerId or item.id must drive update vs create.
     */
    function resolveOwnerId() {
      const ctx = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
      if (ctx && ctx.targetOwnerId) return ctx.targetOwnerId;
      if (item && item.id) return item.id;
      try {
        const cid = ctx && ctx.clientDraftId;
        if (cid) {
          const resume = loadResumeState(cid);
          if (resume && resume.targetOwnerId) return resume.targetOwnerId;
        }
      } catch (e) {}
      return null;
    }

    /** @returns {{ ok: true, values: object } | { ok: false, fieldErrors: Array<{fieldId:string,message:string}> }} */
    function buildEditorValues() {
      const values = {};
      const fieldErrors = [];
      if (nameAr.value.trim()) values.nameAr = nameAr.value.trim();
      if (category.value) values.category = category.value;
      if (nameEn && nameEn.value.trim()) values.nameEn = nameEn.value.trim();
      if (descriptionAr && String(descriptionAr.value || '').trim()) {
        values.descriptionAr = String(descriptionAr.value).trim();
      }
      // Duration: empty optional ≠ invalid typed value. Never parseInt-coerce garbage.
      if (duration && String(duration.value || '').trim() !== '') {
        const raw = String(duration.value).trim();
        if (!/^\d+$/.test(raw)) {
          fieldErrors.push({ fieldId: 'durationMin', message: 'المدة دقائق صحيحة أو فارغة.' });
        } else {
          const d = Number(raw);
          if (!Number.isFinite(d) || d < 5) {
            fieldErrors.push({ fieldId: 'durationMin', message: 'المدة 5 دقائق على الأقل، أو اتركيها فارغة.' });
          } else {
            values.durationMin = d;
          }
        }
      }
      // Price: empty optional ≠ invalid (e.g. 100.123). Do not omit invalid as "unset".
      const priceRaw = String(price.value ?? '').trim();
      if (priceRaw !== '') {
        const halalas = typeof riyalsToHalalas === 'function' ? riyalsToHalalas(priceRaw) : null;
        if (halalas == null) {
          fieldErrors.push({
            fieldId: 'priceSar',
            message: 'السعر بالريال حتى منزلتين عشريتين، مثل 52 أو 52.5 — القيمة الحالية غير صالحة.',
          });
        } else {
          values.priceHalalas = halalas;
        }
      }
      if (type === 'brand' && typeof readCommerce === 'function') {
        const commerce = readCommerce();
        if (commerce && commerce.error) {
          fieldErrors.push({
            fieldId: commerce.error.field || 'optionsJson',
            message: commerce.error.message || 'بيانات التجارة غير صالحة',
          });
          return { ok: false, fieldErrors: fieldErrors, values: values };
        }
        if (commerce && commerce.value) {
          if (commerce.value.purchaseMode) values.purchaseMode = commerce.value.purchaseMode;
          if (Object.prototype.hasOwnProperty.call(commerce.value, 'stockQty')) {
            values.stockQty = commerce.value.stockQty;
          }
          if (Object.prototype.hasOwnProperty.call(commerce.value, 'deliveryFeeHalalas')) {
            values.deliveryFeeHalalas = commerce.value.deliveryFeeHalalas;
          }
          if (Object.prototype.hasOwnProperty.call(commerce.value, 'optionsJson')) {
            values.optionsJson = commerce.value.optionsJson;
          }
          if (Object.prototype.hasOwnProperty.call(commerce.value, 'variantsJson')) {
            values.variantsJson = commerce.value.variantsJson;
          }
          const opts = commerce.value.optionsJson;
          if (Array.isArray(opts)) {
            const colorG = opts.find((g) => g && g.id === 'color');
            const sizeG = opts.find((g) => g && (g.id === 'size' || g.id === 'sizes'));
            if (colorG && Array.isArray(colorG.values)) {
              // Only registry-known color ids go into colors[]; customs stay in optionsJson.
              values.colors = colorG.values.map((v) => v.id).filter((id) => REGISTRY_COLOR_IDS.has(id));
            }
            if (sizeG && Array.isArray(sizeG.values)) {
              values.sizes = sizeG.values.map((v) => v.id).filter((id) => REGISTRY_SIZE_IDS.has(id));
            }
          }
        }
      }
      if (type !== 'brand' && templateState && templateState.templateId) {
        values.serviceProfile = {
          templateId: templateState.templateId,
          templateVersion: templateState.templateVersion || 1,
          priceMode: templateState.priceMode || 'fixed',
          answers: templateState.answers || {},
        };
      }
      if (fieldErrors.length) return { ok: false, fieldErrors: fieldErrors, values: values };
      return { ok: true, values: values };
    }

    function scheduleEditorDraftAutosave() {
      if (!(window.MiraEditorV2 && MiraEditorV2.state.enabled)) return;
      if (!MiraEditorV2.state.registryReady || MiraEditorV2.state.registryMismatch) {
        MiraEditorV2.attachStatus(form);
        MiraEditorV2.setStatus(form, 'تعذر التحقق من سجل الحقول — حدّثي الصفحة', 'error');
        return;
      }
      const built = buildEditorValues();
      if (!built.ok) {
        MiraEditorV2.attachStatus(form);
        (built.fieldErrors || []).forEach((fe) => setFieldError(form, fe.fieldId, fe.message));
        // Drop pending autosave for THIS form only — do not leave a stale "محفوظ".
        if (typeof MiraEditorV2.clearFormPendingQueue === 'function') {
          MiraEditorV2.clearFormPendingQueue(form.id, 'invalid-fields');
        }
        MiraEditorV2.setStatus(form, 'لم يُحفظ — أصلحي الحقول المحددة', 'error');
        return;
      }
      MiraEditorV2.attachStatus(form);
      const partnerType = type === 'brand' ? 'brand' : partnerTypeForTemplates();
      const ctx = MiraEditorV2.getEditContext(form.id);
      const ownerId = resolveOwnerId();
      // After materialize / known owner: do not PUT the open-draft path — edit the item instead.
      if (
        ownerId ||
        (ctx &&
          (ctx.status === 'materialized' ||
            ctx.status === 'submit_failed' ||
            ctx.status === 'submitted' ||
            ctx.status === 'review_pending'))
      ) {
        return;
      }
      const clientDraftId =
        (ctx && ctx.clientDraftId) ||
        MiraEditorV2.clientDraftIdFor(kind, item && item.id, form.id);
      const preferredProfile = (ctx && ctx.profileId) || (draftCtx && draftCtx.profileId) || null;
      const snapshotValues = built.values;
      MiraEditorV2.scheduleAutosave(form, () => {
        const again = buildEditorValues();
        if (!again.ok) {
          return null;
        }
        return {
          clientDraftId: clientDraftId,
          kind: kind,
          profileId: MiraEditorV2.profileIdFor(kind, category.value, partnerType, preferredProfile),
          targetOwnerId: resolveOwnerId(),
          values: again.values || snapshotValues,
        };
      });
    }

    function saveServiceTemplateDraft() {
      bumpFormContentEpoch();
      const ownerKey = (item && item.id) || (draftCtx && draftCtx.clientDraftId) || 'new';
      const key = window.MiraEditorV2
        ? MiraEditorV2.scopedTemplateKey(ownerKey)
        : ('mira-service-template:' + ownerKey);
      localStorage.setItem(key, JSON.stringify(templateState));
      // Single coordinated path: draft autosave carries serviceProfile (no parallel putServiceProfile race).
      if (type !== 'brand') scheduleEditorDraftAutosave();
    }

    function partnerTypeForTemplates() {
      if (type === 'clinic' || type === 'salon') return type;
      const partner = window.sessionPartner || {};
      return partner.type === 'clinic' ? 'clinic' : 'salon';
    }

    function paintServiceTemplates() {
      templateBody.replaceChildren();
      templatePreview.replaceChildren();
      if (type === 'brand' || !window.ServiceTemplates) {
        templateSection.hidden = true;
        return;
      }
      templateSection.hidden = false;
      const list = window.ServiceTemplates.forPartner(partnerTypeForTemplates(), category.value);
      templateSelect.replaceChildren();
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'اختاري نوع الخدمة (القالب)';
      templateSelect.appendChild(empty);
      list.forEach((tpl) => {
        const opt = document.createElement('option');
        opt.value = tpl.id;
        opt.textContent = tpl.label;
        if (tpl.id === templateState.templateId) opt.selected = true;
        templateSelect.appendChild(opt);
      });
      const selected = window.ServiceTemplates.byId(templateSelect.value);
      if (!selected) {
        text(templateBody, 'اختاري قالبًا مناسبًا لتصنيف الخدمة. القالب لا يمنح صلاحية نشاط غير مصرح.');
        return;
      }
      if (!nameAr.value.trim()) nameAr.value = selected.suggestedName;
      const priceMode = selectField(templateBody, 'طريقة عرض السعر', 'priceMode', templateState.priceMode || 'fixed', [
        ['fixed', 'سعر ثابت'],
        ['from', 'يبدأ من'],
        ['afterAssessment', 'يُحدد بعد التقييم'],
        ['unknown', 'غير محدد'],
      ]);
      priceMode.onchange = () => {
        templateState.priceMode = priceMode.value;
        saveServiceTemplateDraft();
        paintTemplatePreview(selected);
      };
      window.ServiceTemplates.sections.forEach((section) => {
        const fields = selected.fields.filter((f) => f.sectionId === section.id && window.ServiceTemplates.isVisible(f, templateState.answers));
        if (!fields.length) return;
        const block = document.createElement('div');
        block.className = 'option-group';
        text(block, section.title, 'h4');
        fields.forEach((f) => {
          renderTemplateField(block, f);
        });
        templateBody.appendChild(block);
      });
      paintTemplatePreview(selected);
    }

    function renderTemplateField(parent, f) {
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '0.6rem';
      text(wrap, f.label + (f.required ? ' *' : ''));
      const current = templateState.answers[f.id];
      if (f.type === 'single') {
        const row = document.createElement('div');
        row.className = 'choice-row';
        f.options.forEach((opt) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = 'tpl-' + f.id;
          input.value = opt[0];
          input.checked = current === opt[0];
          input.onchange = () => {
            templateState.answers[f.id] = opt[0];
            saveServiceTemplateDraft();
            paintServiceTemplates();
          };
          label.append(input, document.createTextNode(' ' + opt[1]));
          row.appendChild(label);
        });
        wrap.appendChild(row);
      } else if (f.type === 'multi') {
        const row = document.createElement('div');
        row.className = 'choice-row';
        const selected = Array.isArray(current) ? current.slice() : [];
        f.options.forEach((opt) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = selected.indexOf(opt[0]) >= 0;
          input.onchange = () => {
            const list = Array.isArray(templateState.answers[f.id]) ? templateState.answers[f.id].slice() : [];
            const at = list.indexOf(opt[0]);
            if (input.checked && at < 0) list.push(opt[0]);
            if (!input.checked && at >= 0) list.splice(at, 1);
            templateState.answers[f.id] = list;
            saveServiceTemplateDraft();
            paintTemplatePreview(window.ServiceTemplates.byId(templateSelect.value));
          };
          label.append(input, document.createTextNode(' ' + opt[1]));
          row.appendChild(label);
        });
        wrap.appendChild(row);
      } else if (f.type === 'boolean') {
        const row = document.createElement('div');
        row.className = 'choice-row';
        ;[['true', 'نعم'], ['false', 'لا']].forEach((opt) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = 'tpl-' + f.id;
          input.value = opt[0];
          input.checked = String(current) === opt[0] || current === (opt[0] === 'true');
          input.onchange = () => {
            templateState.answers[f.id] = opt[0] === 'true';
            saveServiceTemplateDraft();
            paintServiceTemplates();
          };
          label.append(input, document.createTextNode(' ' + opt[1]));
          row.appendChild(label);
        });
        wrap.appendChild(row);
      } else if (f.type === 'number') {
        const input = document.createElement('input');
        input.type = 'number';
        input.name = f.id;
        input.min = '1';
        input.value = current == null ? '' : current;
        input.oninput = () => {
          templateState.answers[f.id] = input.value === '' ? null : Number(input.value);
          saveServiceTemplateDraft();
          paintTemplatePreview(window.ServiceTemplates.byId(templateSelect.value));
        };
        wrap.appendChild(input);
        if (f.unit) text(wrap, f.unit);
      } else {
        const input = document.createElement('textarea');
        input.name = f.id;
        input.rows = 2;
        input.value = current == null ? '' : String(current);
        input.oninput = () => {
          templateState.answers[f.id] = input.value;
          saveServiceTemplateDraft();
          paintTemplatePreview(window.ServiceTemplates.byId(templateSelect.value));
        };
        wrap.appendChild(input);
      }
      parent.appendChild(wrap);
    }

    function paintTemplatePreview(selected) {
      templatePreview.replaceChildren();
      if (!selected) return;
      text(templatePreview, 'معاينة أقسام التفاصيل', 'h4');
      window.ServiceTemplates.sections.forEach((section) => {
        const fields = selected.fields.filter((f) => f.sectionId === section.id && window.ServiceTemplates.isVisible(f, templateState.answers));
        const filled = fields.filter((f) => {
          const v = templateState.answers[f.id];
          return v != null && v !== '' && !(Array.isArray(v) && !v.length);
        });
        if (!filled.length) return;
        text(templatePreview, section.title);
        filled.forEach((f) => {
          const v = templateState.answers[f.id];
          let label = v;
          if (Array.isArray(v)) {
            label = v.map((id) => {
              const opt = (f.options || []).find((row) => row[0] === id);
              return opt ? opt[1] : id;
            }).join('، ');
          } else if (typeof v === 'boolean') {
            label = v ? 'نعم' : 'لا';
          } else if (f.options && f.options.length) {
            const opt = f.options.find((row) => row[0] === v);
            if (opt) label = opt[1];
          }
          text(templatePreview, f.label + ': ' + label);
        });
      });
      const v2Note =
        window.MiraEditorV2 && MiraEditorV2.state.enabled
          ? ' · الحفظ التلقائي على الخادم مفعّل عند توفر الجلسة.'
          : ' · الخصائص تُحفظ محليًا مع المسودة حتى يُفعَّل محرر v2.';
      text(templatePreview, 'طريقة السعر: ' + (templateState.priceMode || 'fixed') + v2Note);
    }

    templateSelect.onchange = () => {
      const previous = templateState.templateId;
      templateState.templateId = templateSelect.value;
      if (previous && previous !== templateState.templateId) {
        status.textContent = 'تغيّر القالب. راجعي الإجابات القديمة غير المنطبقة قبل الإرسال.';
      }
      const selected = window.ServiceTemplates.byId(templateSelect.value);
      if (selected && (!nameAr.value.trim() || nameAr.value === (window.ServiceTemplates.byId(previous) || {}).suggestedName)) {
        nameAr.value = selected.suggestedName;
      }
      saveServiceTemplateDraft();
      paintServiceTemplates();
    };

    if (type !== 'brand') {
      const importBtn = document.createElement('button');
      importBtn.type = 'button';
      importBtn.className = 'secondary';
      importBtn.textContent = 'استيراد القالب المحلي إلى الخادم';
      importBtn.onclick = async () => {
        if (!(window.MiraEditorV2 && MiraEditorV2.state.enabled)) {
          status.textContent = 'محرر v2 غير مفعّل على الخادم. لا استيراد تلقائي.';
          return;
        }
        if (!item || !item.id) {
          status.textContent = 'احفظي الخدمة أولًا ثم أكّدي الاستيراد. لن يُحذف المحلي قبل النجاح.';
          return;
        }
        const account = localStorage.getItem('mira_partner_email');
        const ownerHint = localStorage.getItem('mira-service-template-owner:' + item.id);
        if (ownerHint && account && ownerHint !== account) {
          status.textContent = 'بيانات محلية لحساب آخر — لن يُستورد تلقائيًا.';
          return;
        }
        try {
          const outcome = await MiraEditorV2.importLocalTemplateInteractive(item.id, templateState);
          if (outcome.cancelled) {
            status.textContent = 'أُلغي الاستيراد.';
            return;
          }
          const receipt = outcome.result && outcome.result.importReceipt;
          status.textContent =
            'تم الاستيراد. الإصدار ' +
            (outcome.result && outcome.result.reviewRevision) +
            (receipt && receipt.unmappedAnswerKeys && receipt.unmappedAnswerKeys.length
              ? ' · حقول لم تُحوَّل: ' + receipt.unmappedAnswerKeys.join(', ')
              : '');
          try {
            localStorage.setItem('mira-service-template-owner:' + item.id, account || '');
          } catch (error) {}
        } catch (error) {
          status.textContent = 'فشل الاستيراد: ' + (error.message || error);
        }
      };
      templateSection.appendChild(importBtn);
    }

    const previousCategoryOnChange = category.onchange;
    category.onchange = function () {
      if (previousCategoryOnChange) previousCategoryOnChange();
      if (type !== 'brand') paintServiceTemplates();
    };
    if (type !== 'brand') paintServiceTemplates();

    // Product + service field autosave into PartnerEditorDraft (empty values allowed).
    [nameAr, nameEn, descriptionAr, price, category].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', scheduleEditorDraftAutosave);
      el.addEventListener('change', scheduleEditorDraftAutosave);
    });
    if (duration) {
      duration.addEventListener('input', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      duration.addEventListener('change', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
    }

    function resumeStorageKey(clientDraftId) {
      const scope = (window.MiraEditorV2 && MiraEditorV2.state.partnerId) || 'anon';
      return 'mira_mat_resume:' + scope + ':' + clientDraftId;
    }

    function loadResumeState(clientDraftId) {
      try {
        const raw = sessionStorage.getItem(resumeStorageKey(clientDraftId));
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function saveResumeState(clientDraftId, data) {
      try {
        sessionStorage.setItem(resumeStorageKey(clientDraftId), JSON.stringify(data));
      } catch (e) {}
    }

    function clearResumeState(clientDraftId) {
      try {
        sessionStorage.removeItem(resumeStorageKey(clientDraftId));
      } catch (e) {}
    }

    function materializeOpStillLive(matOp) {
      if (!matOp) return true;
      if (!form.isConnected || form.id !== matOp.formId) return false;
      const live = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
      if (!live) return false;
      if (matOp.clientDraftId && live.clientDraftId !== matOp.clientDraftId) return false;
      if (matOp.formGeneration != null && live.formGeneration !== matOp.formGeneration) return false;
      if (matOp.auth && window.MiraEditorV2 && typeof MiraEditorV2.__testHooks === 'function') {
        if (!MiraEditorV2.__testHooks().assertSameSession(matOp.auth)) return false;
      }
      return true;
    }

    function captureMaterializeOp(clientDraftId) {
      const ctx = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
      const auth =
        window.MiraEditorV2 && typeof MiraEditorV2.__testHooks === 'function'
          ? MiraEditorV2.__testHooks().captureSessionSnapshot()
          : null;
      return {
        formId: form.id,
        clientDraftId: clientDraftId,
        formGeneration: (ctx && ctx.formGeneration) || null,
        auth: auth,
        token: String(Date.now()) + ':' + Math.random(),
      };
    }

    /**
     * Apply materialize result ONLY to the draft/generation that started the op.
     * Stale A completion while B is open: persist A's resume under A's draft id, never mutate B.
     */
    function applyMaterializeOutcome(clientDraftId, result, fromError, matOp) {
      const body = (fromError && fromError.body) || result || {};
      const ownerId = body.targetOwnerId || (result && result.targetOwnerId) || null;
      const code = body.code || (fromError && fromError.code) || null;
      const reviewOk =
        (result && (result.reviewSubmitted === true || result.submitReviewStatus === 'submitted')) ||
        body.submitReviewStatus === 'submitted';
      const submitFailed =
        code === 'MATERIALIZE_SUBMIT_REVIEW_FAILED' ||
        body.submitReviewStatus === 'failed' ||
        (result && result.submitReviewStatus === 'failed');
      const liveOk = materializeOpStillLive(matOp);
      const resumeKey =
        body.resumeKey ||
        sessionStorage.getItem(resumeStorageKey(clientDraftId) + ':key') ||
        null;

      // Always record recovery under the ORIGINAL draft id (A), even when UI moved to B.
      if (ownerId) {
        saveResumeState(clientDraftId, {
          clientDraftId: clientDraftId,
          targetOwnerId: ownerId,
          targetKind: body.targetKind || kind,
          idempotencyKey: resumeKey,
          expectedRevision:
            body.expectedRevision != null
              ? body.expectedRevision
              : (loadResumeState(clientDraftId) || {}).expectedRevision,
          status: reviewOk ? 'submitted' : 'submit_failed',
          submitReviewStatus: reviewOk ? 'submitted' : 'failed',
        });
      }

      if (!liveOk) {
        // F3: do not touch live form B — A remains recoverable via resume for clientDraftId.
        return {
          ownerId: ownerId,
          reviewOk: reviewOk,
          submitFailed: submitFailed,
          stale: true,
        };
      }

      if (ownerId) {
        item = Object.assign({}, item || {}, { id: ownerId });
        staged[form.id].ownerId = ownerId;
        const bound = MiraEditorV2.getEditContext(form.id);
        if (bound && (!matOp || bound.clientDraftId === matOp.clientDraftId)) {
          bound.targetOwnerId = ownerId;
          bound.status = reviewOk ? 'submitted' : 'submit_failed';
          bound.submitReviewStatus = reviewOk ? 'submitted' : 'failed';
        }
        MiraEditorV2.clearNewDraftKey(kind);
        // Complete new→existing transition: bind service profile revision without forcing reopen.
        if (type !== 'brand') {
          const fromMaterialize =
            body.targetReviewRevision != null
              ? body.targetReviewRevision
              : result && result.targetReviewRevision != null
                ? result.targetReviewRevision
                : null;
          status.textContent =
            (status.textContent || '') +
            (serviceProfileBindStatus === 'bound' ? '' : ' · جارٍ تجهيز قالب الخدمة…');
          if (fromMaterialize != null && Number.isInteger(fromMaterialize)) {
            boundServiceReviewRevision = fromMaterialize;
            const ctxRev = MiraEditorV2.getEditContext(form.id);
            if (ctxRev && materializeOpStillLive(matOp)) {
              ctxRev.serviceReviewRevision = fromMaterialize;
            }
            if (item) item.reviewRevision = fromMaterialize;
          }
          const bindOwner = ownerId;
          const bindMatOp = matOp;
          ensureServiceProfileBound(bindOwner, { force: true, mode: 'server' }).then((profile) => {
            if (!materializeOpStillLive(bindMatOp)) return;
            if (!profile || profile.conflict) return;
            if (window.MiraEditorV2) {
              MiraEditorV2.setStatus(
                form,
                'جاهز للحفظ · قالب مربوط بإصدار ' + boundServiceReviewRevision,
                'bound',
              );
            }
          });
        }
      }
      if (reviewOk) clearResumeState(clientDraftId);
      status.textContent = reviewOk
        ? 'تم التحويل والإرسال للمراجعة · ' + (body.targetKind || kind) + ' ' + (ownerId || '')
        : submitFailed
          ? 'تم إنشاء العنصر، وتعذر الإرسال للمراجعة — ارفعي وسائط ثم أعيدي المحاولة. · ' + (ownerId || '')
          : 'نتيجة التحويل: ' + (fromError && fromError.message ? fromError.message : 'غير معروفة');
      return { ownerId: ownerId, reviewOk: reviewOk, submitFailed: submitFailed, stale: false };
    }

    if (window.MiraEditorV2 && MiraEditorV2.state.enabled) {
      const matBtn = document.createElement('button');
      matBtn.type = 'button';
      matBtn.className = 'secondary';
      matBtn.setAttribute('data-editor-v2-materialize', '1');
      matBtn.textContent = 'تحويل المسودة الخادمية وإرسال للمراجعة';
      // Restore resume banner if page reloaded mid-flight.
      (function restoreResumeBanner() {
        const ctx0 = MiraEditorV2.getEditContext(form.id);
        const cid = ctx0 && ctx0.clientDraftId;
        const resume = cid ? loadResumeState(cid) : null;
        if (resume && resume.targetOwnerId && resume.status === 'submit_failed') {
          item = Object.assign({}, item || {}, { id: resume.targetOwnerId });
          if (ctx0) {
            ctx0.targetOwnerId = resume.targetOwnerId;
            ctx0.status = 'submit_failed';
            ctx0.submitReviewStatus = 'failed';
          }
          matBtn.textContent = 'استئناف الإرسال للمراجعة';
          status.textContent = 'العنصر موجود (' + resume.targetOwnerId + ') — أكمل الوسائط ثم استأنفي الإرسال.';
        }
      })();
      matBtn.onclick = async () => {
        let matOp = null;
        try {
          const ctx = MiraEditorV2.getEditContext(form.id);
          const clientDraftId =
            (ctx && ctx.clientDraftId) ||
            MiraEditorV2.clientDraftIdFor(kind, item && item.id, form.id);
          matOp = captureMaterializeOp(clientDraftId);
          const assertMatLive = (phase) => {
            if (materializeOpStillLive(matOp)) return true;
            // F3: A must not schedule autosave / flush / UI writes against B.
            return false;
          };
          let resume = loadResumeState(clientDraftId);

          /**
           * Lost-response recovery: materialize ran on the server but the UI never got targetOwnerId.
           * Do NOT PUT the open draft (DRAFT_ALREADY_MATERIALIZED). Recover via GET draft or
           * rematerialize with the SAME idempotency key + expectedRevision.
           */
          if (
            resume &&
            resume.status === 'materializing' &&
            !resume.targetOwnerId &&
            resume.idempotencyKey &&
            resume.expectedRevision != null
          ) {
            status.textContent = 'نتيجة التحويل غير مؤكدة — جارٍ الاستعادة من الخادم…';
            try {
              const draftRow = await PartnersApi.getEditorDraft(clientDraftId);
              if (!assertMatLive('recover-get')) return;
              if (draftRow && draftRow.status === 'materialized' && draftRow.targetOwnerId) {
                const out = applyMaterializeOutcome(
                  clientDraftId,
                  {
                    targetOwnerId: draftRow.targetOwnerId,
                    targetKind: draftRow.kind || kind,
                    reviewSubmitted: draftRow.submitReviewStatus === 'submitted',
                    submitReviewStatus: draftRow.submitReviewStatus || 'failed',
                    expectedRevision: resume.expectedRevision,
                    resumeKey: resume.idempotencyKey,
                  },
                  null,
                  matOp,
                );
                if (out && out.stale) return;
                if (draftRow.submitReviewStatus !== 'submitted') {
                  matBtn.textContent = 'استئناف الإرسال للمراجعة';
                }
                await refreshLists();
                if (!assertMatLive('recover-refresh')) return;
                resume = loadResumeState(clientDraftId);
                if (draftRow.submitReviewStatus === 'submitted') return;
                // Fall through to resume submit path below when media/submit still needed.
              } else {
                const result = await MiraEditorV2.materialize(
                  clientDraftId,
                  resume.expectedRevision,
                  true,
                  resume.idempotencyKey,
                );
                if (!assertMatLive('recover-mat')) return;
                const out = applyMaterializeOutcome(clientDraftId, result, null, matOp);
                if (out && out.stale) return;
                await refreshLists();
                return;
              }
            } catch (recoverErr) {
              if (!assertMatLive('recover-catch')) return;
              const rCode =
                (recoverErr && recoverErr.code) ||
                (recoverErr && recoverErr.body && recoverErr.body.code) ||
                '';
              if (rCode === 'DRAFT_ALREADY_MATERIALIZED') {
                const draftRow = await PartnersApi.getEditorDraft(clientDraftId);
                if (!assertMatLive('recover-already')) return;
                if (draftRow && draftRow.targetOwnerId) {
                  const out = applyMaterializeOutcome(
                    clientDraftId,
                    {
                      targetOwnerId: draftRow.targetOwnerId,
                      targetKind: draftRow.kind || kind,
                      reviewSubmitted: draftRow.submitReviewStatus === 'submitted',
                      submitReviewStatus: draftRow.submitReviewStatus || 'failed',
                      expectedRevision: resume.expectedRevision,
                      resumeKey: resume.idempotencyKey,
                    },
                    null,
                    matOp,
                  );
                  if (out && out.stale) return;
                  matBtn.textContent = 'استئناف الإرسال للمراجعة';
                  await refreshLists();
                  if (!assertMatLive('recover-already-refresh')) return;
                  resume = loadResumeState(clientDraftId);
                } else {
                  status.textContent =
                    'المسودة محوّلة على الخادم لكن تعذر استعادة معرّف العنصر. حدّثي القائمة وافتحي العنصر.';
                  return;
                }
              } else if (recoverErr && recoverErr.code === 'MATERIALIZE_SUBMIT_REVIEW_FAILED') {
                const out = applyMaterializeOutcome(clientDraftId, null, recoverErr, matOp);
                if (out && out.stale) return;
                matBtn.textContent = 'استئناف الإرسال للمراجعة';
                await refreshLists();
                if (!assertMatLive('recover-submit-fail')) return;
                resume = loadResumeState(clientDraftId);
              } else {
                throw recoverErr;
              }
            }
          }

          // Resume path: item already created — attach media then submitReview / rematerialize with same key.
          if (
            (ctx && (ctx.status === 'submit_failed' || ctx.status === 'materialized')) ||
            (resume && resume.targetOwnerId && resume.status === 'submit_failed')
          ) {
            if (!assertMatLive('resume-enter')) return;
            const ownerId = (ctx && ctx.targetOwnerId) || (resume && resume.targetOwnerId) || (item && item.id);
            if (!ownerId) {
              status.textContent = 'لا يوجد معرّف عنصر للاستئناف.';
              return;
            }
            item = Object.assign({}, item || {}, { id: ownerId });
            const key =
              (resume && resume.idempotencyKey) ||
              sessionStorage.getItem(resumeStorageKey(clientDraftId) + ':key') ||
              null;
            // Resume: do NOT PUT the open draft. Rematerialize with same key when revision known; else submitReview on owner.
            if (key && resume && resume.expectedRevision != null) {
              try {
                const result = await MiraEditorV2.materialize(
                  clientDraftId,
                  resume.expectedRevision,
                  true,
                  key,
                );
                if (!assertMatLive('resume-mat')) return;
                const out = applyMaterializeOutcome(clientDraftId, result, null, matOp);
                if (out && out.stale) return;
                await refreshLists();
                return;
              } catch (error) {
                if (!assertMatLive('resume-mat-catch')) return;
                if (error && error.code === 'MATERIALIZE_SUBMIT_REVIEW_FAILED') {
                  const out = applyMaterializeOutcome(clientDraftId, null, error, matOp);
                  if (out && out.stale) return;
                  // continue to media+submitReview below
                } else if (
                  !(
                    error &&
                    (error.code === 'DRAFT_ALREADY_MATERIALIZED' ||
                      (error.body && error.body.code === 'DRAFT_ALREADY_MATERIALIZED'))
                  )
                ) {
                  throw error;
                }
              }
            }
            if (!assertMatLive('resume-submit')) return;
            await PartnersApi.submitReview(kind === 'product' ? 'products' : 'services', ownerId);
            if (!assertMatLive('resume-submit-done')) return;
            const out = applyMaterializeOutcome(clientDraftId, {
              targetOwnerId: ownerId,
              reviewSubmitted: true,
              submitReviewStatus: 'submitted',
            }, null, matOp);
            if (out && out.stale) return;
            clearResumeState(clientDraftId);
            await refreshLists();
            return;
          }

          // Fresh materialize — require valid fields + confirmed draft save first.
          // If a prior attempt already materialized, recover instead of PUT.
          try {
            const prior = await PartnersApi.getEditorDraft(clientDraftId);
            if (!assertMatLive('preflight-get')) return;
            if (prior && prior.status === 'materialized' && prior.targetOwnerId) {
              const priorKey =
                sessionStorage.getItem(resumeStorageKey(clientDraftId) + ':key') ||
                (resume && resume.idempotencyKey) ||
                null;
              const out = applyMaterializeOutcome(
                clientDraftId,
                {
                  targetOwnerId: prior.targetOwnerId,
                  targetKind: prior.kind || kind,
                  reviewSubmitted: prior.submitReviewStatus === 'submitted',
                  submitReviewStatus: prior.submitReviewStatus || 'failed',
                  resumeKey: priorKey,
                  expectedRevision: prior.revision,
                },
                null,
                matOp,
              );
              if (out && out.stale) return;
              matBtn.textContent = 'استئناف الإرسال للمراجعة';
              status.textContent =
                'استُعيد العنصر المحوّل مسبقًا (' + prior.targetOwnerId + ') — لا إنشاء بديل.';
              await refreshLists();
              return;
            }
          } catch (e) {
            if (!assertMatLive('preflight-get-miss')) return;
            /* draft may not exist yet — continue fresh path */
          }

          if (!assertMatLive('preflight')) return;
          const preflight = buildEditorValues();
          if (!preflight.ok) {
            (preflight.fieldErrors || []).forEach((fe) => setFieldError(form, fe.fieldId, fe.message));
            status.textContent = 'لم يُحوَّل — الحقول غير صالحة. النسخة الخادمية السابقة لم تُمس.';
            MiraEditorV2.setStatus(form, 'لم يُحفظ', 'error');
            return;
          }
          // Snapshot draft identity for this op — never flush/autosave a different live draft.
          if (!assertMatLive('before-autosave')) return;
          scheduleEditorDraftAutosave();
          let saved;
          try {
            saved = await MiraEditorV2.flushUntilSettled(form);
            if (!assertMatLive('after-flush')) return;
          } catch (flushErr) {
            if (!assertMatLive('flush-catch')) return;
            const fCode =
              (flushErr && flushErr.code) ||
              (flushErr && flushErr.body && flushErr.body.code) ||
              '';
            if (fCode === 'DRAFT_ALREADY_MATERIALIZED') {
              const prior = await PartnersApi.getEditorDraft(clientDraftId);
              if (!assertMatLive('flush-already')) return;
              if (prior && prior.targetOwnerId) {
                const out = applyMaterializeOutcome(
                  clientDraftId,
                  {
                    targetOwnerId: prior.targetOwnerId,
                    targetKind: prior.kind || kind,
                    reviewSubmitted: prior.submitReviewStatus === 'submitted',
                    submitReviewStatus: prior.submitReviewStatus || 'failed',
                    resumeKey: sessionStorage.getItem(resumeStorageKey(clientDraftId) + ':key'),
                    expectedRevision: prior.revision,
                  },
                  null,
                  matOp,
                );
                if (out && out.stale) return;
                matBtn.textContent = 'استئناف الإرسال للمراجعة';
                await refreshLists();
                return;
              }
            }
            throw flushErr;
          }
          if (!saved || !saved.ok) {
            const sCode =
              (saved && saved.error && (saved.error.code || (saved.error.body && saved.error.body.code))) ||
              '';
            if (sCode === 'DRAFT_ALREADY_MATERIALIZED') {
              const prior = await PartnersApi.getEditorDraft(clientDraftId);
              if (prior && prior.targetOwnerId) {
                applyMaterializeOutcome(
                  clientDraftId,
                  {
                    targetOwnerId: prior.targetOwnerId,
                    targetKind: prior.kind || kind,
                    reviewSubmitted: prior.submitReviewStatus === 'submitted',
                    submitReviewStatus: prior.submitReviewStatus || 'failed',
                    resumeKey: sessionStorage.getItem(resumeStorageKey(clientDraftId) + ':key'),
                    expectedRevision: prior.revision,
                  },
                  null,
                matOp);
                matBtn.textContent = 'استئناف الإرسال للمراجعة';
                await refreshLists();
                return;
              }
            }
            status.textContent =
              'لم يُحوَّل — الحفظ غير مؤكد' +
              (saved && saved.reason ? ' (' + saved.reason + ')' : '') +
              '. أصلحي الحفظ أولًا.';
            return;
          }
          if (!assertMatLive('before-revision')) return;
          // Prefer the flush result for THIS clientDraftId — never borrow B's live revision.
          const expectedRevision =
            saved.revision != null
              ? saved.revision
              : MiraEditorV2.state.draftRevisionByClientId[clientDraftId];
          if (expectedRevision == null) {
            status.textContent = 'لا يوجد إصدار محفوظ مؤكد للتحويل.';
            return;
          }
          const resumeKey = 'mat:' + clientDraftId + ':' + expectedRevision;
          sessionStorage.setItem(resumeStorageKey(clientDraftId) + ':key', resumeKey);
          // Persist intent BEFORE the network call so reload can recover without injecting owner id.
          saveResumeState(clientDraftId, {
            clientDraftId: clientDraftId,
            idempotencyKey: resumeKey,
            expectedRevision: expectedRevision,
            status: 'materializing',
          });
          if (!assertMatLive('before-materialize')) return;
          try {
            const result = await MiraEditorV2.materialize(
              clientDraftId,
              expectedRevision,
              true,
              resumeKey,
            );
            if (!assertMatLive('after-materialize')) {
              // Server may have completed A — resume was already saved under A's draft id.
              applyMaterializeOutcome(clientDraftId, result, null, matOp);
              return;
            }
            const matOut = applyMaterializeOutcome(clientDraftId, result, null, matOp);
            if (matOut && matOut.stale) return;
            if (result && result.targetOwnerId && !(result.reviewSubmitted || result.submitReviewStatus === 'submitted')) {
              matBtn.textContent = 'استئناف الإرسال للمراجعة';
            }
          } catch (error) {
            if (!assertMatLive('materialize-catch')) {
              applyMaterializeOutcome(clientDraftId, null, error, matOp);
              return;
            }
            if (error && error.code === 'MATERIALIZE_SUBMIT_REVIEW_FAILED') {
              const matOut = applyMaterializeOutcome(clientDraftId, null, error, matOp);
              if (matOut && matOut.stale) return;
              matBtn.textContent = 'استئناف الإرسال للمراجعة';
            } else {
              const mCode = (error && error.code) || (error && error.body && error.body.code) || '';
              if (mCode === 'DRAFT_ALREADY_MATERIALIZED') {
                const prior = await PartnersApi.getEditorDraft(clientDraftId);
                if (!assertMatLive('mat-already')) {
                  if (prior && prior.targetOwnerId) {
                    applyMaterializeOutcome(
                      clientDraftId,
                      {
                        targetOwnerId: prior.targetOwnerId,
                        targetKind: prior.kind || kind,
                        reviewSubmitted: prior.submitReviewStatus === 'submitted',
                        submitReviewStatus: prior.submitReviewStatus || 'failed',
                        resumeKey: resumeKey,
                        expectedRevision: expectedRevision,
                      },
                      null,
                      matOp,
                    );
                  }
                  return;
                }
                if (prior && prior.targetOwnerId) {
                  const matOut = applyMaterializeOutcome(
                    clientDraftId,
                    {
                      targetOwnerId: prior.targetOwnerId,
                      targetKind: prior.kind || kind,
                      reviewSubmitted: prior.submitReviewStatus === 'submitted',
                      submitReviewStatus: prior.submitReviewStatus || 'failed',
                      resumeKey: resumeKey,
                      expectedRevision: expectedRevision,
                    },
                    null,
                    matOp,
                  );
                  if (matOut && matOut.stale) return;
                  matBtn.textContent = 'استئناف الإرسال للمراجعة';
                } else {
                  throw error;
                }
              } else {
                throw error;
              }
            }
          }
          if (matOp && !materializeOpStillLive(matOp)) return;
          await refreshLists();
        } catch (error) {
          if (matOp && !materializeOpStillLive(matOp)) return;
          status.textContent = 'تعذر التحويل: ' + (error.message || error);
          if (error && error.fieldErrors && Array.isArray(error.fieldErrors)) {
            error.fieldErrors.forEach((fe) => {
              if (fe && fe.fieldId) setFieldError(form, fe.fieldId, fe.code || error.message);
            });
          }
        }
      };
      form.appendChild(matBtn);
    }

    const mediaSection = document.createElement('div');
    mediaSection.className = 'form-section';
    text(mediaSection, 'وسائط العرض الرئيسي', 'h3');
    text(mediaSection, 'الفيديو أو الصور التي تظهر للمستخدم مباشرة أثناء تصفح اكتشفي بملء الشاشة.');
    text(mediaSection, 'فيديو واحد أو مجموعة صور. صور JPEG وPNG وWebP وصورة الآيفون حتى 5 ميغابايت. الفيديو حتى 5 دقائق.');
    function mediaInput(id, accept) {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = id;
      input.accept = accept;
      input.multiple = true;
      return input;
    }
    const images = mediaInput(form.id + '-images', 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg');
    const videos = mediaInput(form.id + '-videos', 'video/mp4,video/quicktime,video/x-m4v,.mov,.m4v,.mp4');
    videos.multiple = false;
    const imageLabel = document.createElement('label');
    imageLabel.htmlFor = images.id;
    imageLabel.textContent = 'إضافة صور للعرض الرئيسي';
    const videoLabel = document.createElement('label');
    videoLabel.htmlFor = videos.id;
    videoLabel.textContent = 'إضافة فيديو للعرض الرئيسي';
    const mainPreview = document.createElement('p');
    mainPreview.textContent = 'معاينة الموضع: تملأ شاشة اكتشفي من الحافة إلى الحافة.';
    const mediaBox = document.createElement('div');
    mediaSection.append(imageLabel, images, videoLabel, videos, mainPreview, mediaBox);
    const detailMediaSection = document.createElement('div');
    detailMediaSection.className = 'form-section';
    text(detailMediaSection, 'وسائط صفحة التفاصيل', 'h3');
    text(detailMediaSection, 'هذه الصور والمقاطع تظهر داخل صفحة التفاصيل بعد الضغط على زر التفاصيل.');
    text(detailMediaSection, 'الصور والفيديو مسموحة هنا، وتُعرض كاملة دون قص إجباري بنسبة شاشة اكتشفي.');
    const detailImages = mediaInput(form.id + '-detail-images', images.accept);
    const detailVideos = mediaInput(form.id + '-detail-videos', videos.accept);
    const detailImageLabel = document.createElement('label');
    detailImageLabel.htmlFor = detailImages.id;
    detailImageLabel.textContent = 'إضافة صور للتفاصيل';
    const detailVideoLabel = document.createElement('label');
    detailVideoLabel.htmlFor = detailVideos.id;
    detailVideoLabel.textContent = 'إضافة فيديو للتفاصيل';
    const detailPreview = document.createElement('p');
    detailPreview.textContent = 'معاينة الموضع: داخل صفحة التفاصيل، بعد زر التفاصيل.';
    const detailMediaBox = document.createElement('div');
    detailMediaSection.append(detailImageLabel, detailImages, detailVideoLabel, detailVideos, detailPreview, detailMediaBox);
    form.append(mediaSection, detailMediaSection);
    form.insertBefore(templateSection, mediaSection);

    const detail = document.createElement('div');
    detail.className = 'form-section';
    text(detail, 'التفاصيل', 'h3');
    const tags = field(detail, 'وسوم اختيارية', 'concernTags', (seed.concernTags || []).join ? (seed.concernTags || []).join(', ') : (seed.concernTags || ''), 'text');
    tags.addEventListener('input', () => {
      bumpFormContentEpoch();
      scheduleEditorDraftAutosave();
    });
    tags.addEventListener('change', () => {
      bumpFormContentEpoch();
      scheduleEditorDraftAutosave();
    });
    form.appendChild(detail);

    const action = document.createElement('div');
    action.className = 'form-section';
    text(action, 'الإجراء', 'h3');
    form.appendChild(action);
    let url = null;
    let internalToggle = null;
    let stockInput = null;
    let feeInput = null;
    let optionsJsonInput = null;
    let variantsJsonInput = null;
    if (type === 'brand') {
      const choices = document.createElement('div');
      choices.className = 'choice-row';
      choices.append(choice('purchaseMode', 'none', 'بدون شراء الآن', true), choice('purchaseMode', 'link', 'شراء عبر رابط', false), choice('purchaseMode', 'contact', 'تواصل', false));
      action.appendChild(choices);
      url = field(action, 'رابط الشراء (فقط عند اختيار الرابط)', 'externalUrl', editing && item.externalUrl ? item.externalUrl : '', 'url');
      url.required = false;
      url.addEventListener('input', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      url.addEventListener('change', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      if (editing && validUrl(item.externalUrl)) choices.querySelector('input[value="link"]').checked = true;

      // Operational commerce: in-Mira cart + cash on delivery. External URL stays the default.
      text(action, 'الشراء داخل ميرا (الدفع عند الاستلام)', 'h4');
      const internal = document.createElement('label');
      internalToggle = document.createElement('input');
      internalToggle.type = 'checkbox';
      internalToggle.name = 'internalCod';
      internalToggle.checked = Boolean(seed.purchaseMode === 'internal_cod' || (editing && item.purchaseMode === 'internal_cod'));
      internalToggle.addEventListener('change', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      internal.append(internalToggle, document.createTextNode(' تفعيل الطلب داخل ميرا (دفع نقدًا عند الاستلام). رابط الشراء الخارجي يبقى للمنتجات الخارجية فقط.'));
      choices.addEventListener('change', bumpFormContentEpoch);
      action.appendChild(internal);
      stockInput = field(
        action,
        'المخزون (اتركيه فارغًا إذا لا يُتتبع)',
        'stockQty',
        seed.stockQty != null ? seed.stockQty : (editing && item.stockQty != null ? item.stockQty : ''),
        'number',
      );
      stockInput.min = '0';
      stockInput.step = '1';
      stockInput.addEventListener('input', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      stockInput.addEventListener('change', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      feeInput = field(
        action,
        'رسوم التوصيل بالريال (اتركيها فارغة إذا غير محددة، ولا تُعرض كمجانية)',
        'deliveryFeeSar',
        seed.deliveryFeeHalalas != null
          ? halalasToInput(seed.deliveryFeeHalalas)
          : (editing && item.deliveryFeeHalalas != null ?halalasToInput(item.deliveryFeeHalalas) : ''),
        'text',
      );
      feeInput.inputMode = 'decimal';
      feeInput.addEventListener('input', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      feeInput.addEventListener('change', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      const advancedWrap = document.createElement('label');
      advancedWrap.className = 'check-row';
      const advancedToggle = document.createElement('input');
      advancedToggle.type = 'checkbox';
      advancedToggle.name = 'optionsAdvancedJson';
      advancedWrap.append(advancedToggle, document.createTextNode(' تعديل متقدم بصيغة JSON (يستبدل النموذج المبسّط عند التفعيل)'));
      action.appendChild(advancedWrap);
      optionsJsonInput = field(action, 'خيارات المنتج JSON (متقدم)', 'optionsJson', '', 'textarea');
      optionsJsonInput.placeholder = '[{"id":"size","labelAr":"المقاس","kind":"size","values":[{"id":"m","labelAr":"M"}]}]';
      variantsJsonInput = field(action, 'التركيبات JSON (متقدم)', 'variantsJson', '', 'textarea');
      variantsJsonInput.placeholder = '[{"id":"m-black","selections":{"size":"m"},"priceHalalas":5200,"available":true}]';
      function setAdvancedVisible(on) {
        [optionsJsonInput, variantsJsonInput].forEach((input) => {
          const box = input.closest('.field') || input.parentElement;
          if (box) box.hidden = !on;
          if (!on) input.value = '';
        });
      }
      setAdvancedVisible(false);
      advancedToggle.onchange = () => {
        setAdvancedVisible(advancedToggle.checked);
        bumpFormContentEpoch();
      };
      optionsJsonInput.addEventListener('input', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      optionsJsonInput.addEventListener('change', bumpFormContentEpoch);
      variantsJsonInput.addEventListener('input', () => {
        bumpFormContentEpoch();
        scheduleEditorDraftAutosave();
      });
      variantsJsonInput.addEventListener('change', bumpFormContentEpoch);
      optionsJsonInput._advancedToggle = advancedToggle;
      text(action, 'المقاسات والألوان والأحجام تُحفظ من النموذج المبسّط أعلاه. المخزون ورسوم التوصيل ووضع الشراء يسري مباشرة؛ الخيارات للمنشور تمر بمسودة مراجعة.');
    }

    const preview = document.createElement('div');
    preview.className = 'form-section';
    text(preview, 'المعاينة والنشر', 'h3');
    const previewBody = text(preview, '');
    form.appendChild(preview);

    const save = document.createElement('button');
    save.type = 'submit';
    save.id = form.id + '-save';
    save.className = 'btn btn-primary';
    save.textContent = developerAccount ? 'نشر الآن' : 'حفظ المسودة';
    if (note && (note.indexOf('حُفظت المسودة') === 0 || note.indexOf('نُشر في التطبيق') === 0)) status.classList.add('save-ok');
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn btn-ghost';
    submit.textContent = developerAccount ? 'نشر الآن' : 'إرسال للمراجعة';
    if (developerAccount) submit.hidden = true;
    form.append(save, submit);

    function choice(name, value, label, checked) {
      const wrap = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = name;
      input.value = value;
      input.checked = checked;
      wrap.append(input, document.createTextNode(' ' + label));
      return wrap;
    }

    function cosmeticVisible() {
      const show = type === 'brand' && ['face', 'body', 'hair'].indexOf(category.value) >= 0;
      cosmetic.hidden = !show;
      return show;
    }
    let lastCompatibleCategory = category.value;
    category.onchange = function () {
      cosmeticVisible();
      if (type === 'brand') {
        // Keep selected values/variants; category drop of saved groups is a conflict (RC6-01).
        // Do not clear optionsState — merchant must revert category or explicit-clear.
        const next = category.value;
        const preset = optionPresets(next);
        const orphans =
          window.MiraCatalogOptions && window.MiraCatalogOptions.incompatibleGroupIds
            ? window.MiraCatalogOptions.incompatibleGroupIds(optionsState, preset.groups)
            : [];
        if (orphans.length && !optionsState.clearingOptions) {
          optionsState.categoryConflict = {
            from: lastCompatibleCategory,
            to: next,
            groupIds: orphans,
          };
        } else {
          optionsState.categoryConflict = null;
          lastCompatibleCategory = next;
        }
        paintOptions();
      } else paintServiceTemplates();
    };
    cosmeticVisible();

    const optionsSection = document.createElement('div');
    optionsSection.className = 'form-section';
    optionsSection.hidden = type !== 'brand';
    text(optionsSection, 'خيارات المنتج', 'h3');
    text(optionsSection, 'الحقول تتغير حسب التصنيف. الخيارات الجاهزة اقتراحات فقط وليست محددة تلقائيًا. التركيبات المتاحة تُختار يدويًا دون إنشاء كل الاحتمالات.');
    const optionsActionBar = document.createElement('div');
    optionsActionBar.setAttribute('data-options-action-bar', '1');
    const optionsBody = document.createElement('div');
    const optionsPreview = document.createElement('div');
    optionsPreview.className = 'options-preview';
    optionsSection.append(optionsActionBar, optionsBody, optionsPreview);
    form.insertBefore(optionsSection, mediaSection);

    const optionsSeedRow = (function () {
      if (editing && item) return item;
      if (seed && (seed.optionsJson || seed.colors || seed.sizes)) {
        return {
          optionsJson: seed.optionsJson || null,
          variantsJson: seed.variantsJson || null,
          // synthesize optionsJson groups from colors/sizes when only those are present
          _colors: seed.colors,
          _sizes: seed.sizes,
        };
      }
      return null;
    })();
    const optionsState = optionsStateFromServer(optionsSeedRow);
    if ((!optionsState.selected || !Object.keys(optionsState.selected).length) && seed) {
      if (Array.isArray(seed.colors) && seed.colors.length) {
        optionsState.selected = optionsState.selected || {};
        optionsState.selected.color = seed.colors.slice();
        optionsState.valueIds = optionsState.valueIds || {};
        optionsState.valueIds.color = optionsState.valueIds.color || {};
        seed.colors.forEach((id) => { optionsState.valueIds.color[id] = id; });
      }
      if (Array.isArray(seed.sizes) && seed.sizes.length) {
        optionsState.selected = optionsState.selected || {};
        optionsState.selected.size = seed.sizes.slice();
        optionsState.valueIds = optionsState.valueIds || {};
        optionsState.valueIds.size = optionsState.valueIds.size || {};
        seed.sizes.forEach((id) => { optionsState.valueIds.size[id] = id; });
      }
    }
    /** Snapshot taken immediately before an in-session clear (RC8-01 undo). */
    let clearUndoSnapshot = null;

    function cloneOptionsState(src) {
      return JSON.parse(JSON.stringify({
        selected: src.selected || {},
        customs: src.customs || {},
        traits: src.traits || {},
        variants: src.variants || [],
        valueIds: src.valueIds || {},
        clearingOptions: !!src.clearingOptions,
        clearingVariants: !!src.clearingVariants,
        categoryConflict: src.categoryConflict || null,
        invalidVariantNote: src.invalidVariantNote || '',
      }));
    }

    function hasOptionValuesNow() {
      if (window.MiraCatalogOptions && window.MiraCatalogOptions.stateHasOptionLabels) {
        return window.MiraCatalogOptions.stateHasOptionLabels(optionsState);
      }
      const selected = optionsState.selected || {};
      if (Object.keys(selected).some((gid) => (selected[gid] || []).length > 0)) return true;
      const customs = optionsState.customs || {};
      if (Object.keys(customs).some((gid) => String(customs[gid] || '').trim())) return true;
      return (optionsState.variants || []).length > 0;
    }

    function abandonClearIfValuesEntered() {
      if (optionsState.clearingOptions && hasOptionValuesNow()) {
        optionsState.clearingOptions = false;
        optionsState.clearingVariants = false;
      }
    }

    function hasPublishedOptions() {
      return Boolean(
        editing &&
          ((Array.isArray(item.optionsJson) && item.optionsJson.length > 0) ||
            (Array.isArray(item.variantsJson) && item.variantsJson.length > 0)),
      );
    }

    function restoreFromPublished() {
      optionsState.clearingOptions = false;
      optionsState.clearingVariants = false;
      clearUndoSnapshot = null;
      if (!editing) return;
      Object.assign(
        optionsState,
        optionsStateFromServer(
          Object.assign({}, item, {
            draftOptionsSet: false,
            draftVariantsSet: false,
            draftOptionsJson: null,
            draftVariantsJson: null,
          }),
        ),
      );
    }

    function restoreFromClearUndo() {
      if (!clearUndoSnapshot) return false;
      const snap = clearUndoSnapshot;
      clearUndoSnapshot = null;
      Object.assign(optionsState, cloneOptionsState(snap));
      optionsState.clearingOptions = false;
      optionsState.clearingVariants = false;
      return true;
    }

    function optionPresets(cat) {
      if (cat === 'clothes') {
        return {
          groups: [
            { id: 'size', label: 'المقاس', kind: 'size', presets: ['XS', 'S', 'M', 'L', 'XL'] },
            // Display labels; canonical ids (black/…) applied in catalog-options-core.
            { id: 'color', label: 'اللون', kind: 'color', presets: ['أسود', 'سكري', 'بني', 'وردي', 'أزرق', 'أخضر', 'متعدد الألوان'] },
          ],
          traits: ['الخامة', 'العناية', 'دليل المقاسات'],
        };
      }
      if (cat === 'face' || cat === 'body' || cat === 'hair') {
        return {
          groups: [{ id: 'volume', label: 'الحجم', kind: 'volume', presets: ['50 مل', '100 مل'] }],
          traits: ['المكونات', 'طريقة الاستخدام', 'الخامة'],
        };
      }
      if (cat === 'accessories') {
        return {
          groups: [{ id: 'finish', label: 'التشطيب', kind: 'finish', presets: ['ذهبي', 'فضي'] }],
          traits: ['الخامة', 'الأبعاد'],
        };
      }
      return { groups: [], traits: [] };
    }

    /**
     * Hydrate easy UI from server options (shared MiraCatalogOptions implementation).
     */
    function optionsStateFromServer(row) {
      if (!window.MiraCatalogOptions || typeof window.MiraCatalogOptions.optionsStateFromServer !== 'function') {
        throw new Error('MiraCatalogOptions غير محمّل');
      }
      return window.MiraCatalogOptions.optionsStateFromServer(row);
    }

    function saveOptionsDraft() {
      bumpFormContentEpoch();
      // localStorage is a UI convenience only; authoritative copy is optionsJson on the API.
      try {
        const scope = (window.MiraEditorV2 && MiraEditorV2.state.partnerId) || 'anon';
        const owner = (item && item.id) || (draftCtx && draftCtx.clientDraftId) || 'new';
        const key = 'mira-product-options:' + scope + ':' + owner;
        localStorage.setItem(key, JSON.stringify(optionsState));
      } catch (error) {}
    }

    function syncOptionsActionBar() {
      if (type !== 'brand') {
        optionsActionBar.replaceChildren();
        return;
      }
      optionsActionBar.replaceChildren();
      const hasValues = hasOptionValuesNow();
      const published = hasPublishedOptions();

      if (optionsState.categoryConflict && optionsState.categoryConflict.groupIds && optionsState.categoryConflict.groupIds.length) {
        const banner = document.createElement('p');
        banner.className = 'field-error';
        banner.setAttribute('role', 'alert');
        banner.setAttribute('data-category-conflict', '1');
        banner.textContent =
          'تغيير التصنيف سيُسقط مجموعات خيارات محفوظة دون مسح صريح. ارجعي للتصنيف السابق أو امسحي الخيارات صراحةً قبل الحفظ.';
        optionsActionBar.appendChild(banner);
        const revert = document.createElement('button');
        revert.type = 'button';
        revert.className = 'btn btn-ghost btn-sm';
        revert.textContent = 'العودة للتصنيف السابق';
        revert.onclick = () => {
          const prev = optionsState.categoryConflict && optionsState.categoryConflict.from;
          if (prev) {
            category.value = prev;
            optionsState.categoryConflict = null;
            lastCompatibleCategory = prev;
            cosmeticVisible();
            paintOptions();
          }
        };
        optionsActionBar.appendChild(revert);
      }

      if (!optionsState.clearingOptions && (hasValues || published || (optionsState.variants || []).length)) {
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'btn btn-ghost btn-sm';
        clearBtn.setAttribute('data-clear-product-options', '1');
        clearBtn.textContent = 'مسح خيارات المنتج';
        clearBtn.onclick = () => {
          const variantCount = (optionsState.variants || []).length;
          const publishedVariantCount =
            editing && Array.isArray(item.variantsJson) ? item.variantsJson.length : 0;
          const msg =
            'مسح خيارات المنتج يطلب حذف كل الخيارات والتركيبات المرتبطة بها بعد اعتماد الإدارة.\n' +
            'المنشور الحالي يبقى ظاهرًا للعميلات حتى الاعتماد.\n' +
            (variantCount || publishedVariantCount
              ? 'عدد التركيبات المتأثرة في المسودة/المنشور: ' +
                Math.max(variantCount, publishedVariantCount) +
                '.\n'
              : '') +
            'يمكن التراجع عن المسح الحالي قبل الحفظ لاستعادة ما كان ظاهرًا.\n' +
            'هل تريدين المتابعة؟';
          if (!window.confirm(msg)) return;
          clearUndoSnapshot = cloneOptionsState(optionsState);
          optionsState.clearingOptions = true;
          optionsState.clearingVariants = true;
          optionsState.selected = {};
          optionsState.customs = {};
          optionsState.traits = {};
          optionsState.variants = [];
          optionsState.valueIds = {};
          optionsState.categoryConflict = null;
          optionsState.invalidVariantNote = '';
          saveOptionsDraft();
          paintOptions();
        };
        optionsActionBar.appendChild(clearBtn);
      }

      if (optionsState.clearingOptions) {
        const banner = document.createElement('p');
        banner.className = 'field-error';
        banner.setAttribute('data-clear-options-pending', '1');
        banner.textContent = published
          ? 'طلب مسح معلّق: المنشور يبقى ظاهرًا حتى اعتماد الإدارة. إدخال خيارات جديدة يلغي طلب المسح ويستبدله بالمحتوى الجديد.'
          : 'تم مسح خيارات المسودة. إدخال قيم جديدة يبني خيارات جديدة دون طلب مسح null.';
        optionsActionBar.appendChild(banner);

        if (clearUndoSnapshot) {
          const undo = document.createElement('button');
          undo.type = 'button';
          undo.className = 'btn btn-ghost btn-sm';
          undo.setAttribute('data-undo-clear-options', '1');
          undo.textContent = 'التراجع عن المسح الحالي';
          undo.onclick = () => {
            restoreFromClearUndo();
            saveOptionsDraft();
            paintOptions();
          };
          optionsActionBar.appendChild(undo);
        }

        if (published) {
          const restorePub = document.createElement('button');
          restorePub.type = 'button';
          restorePub.className = 'btn btn-ghost btn-sm';
          restorePub.setAttribute('data-cancel-clear-options', '1');
          restorePub.textContent = 'العودة إلى الخيارات المنشورة';
          restorePub.onclick = () => {
            if (!window.confirm('ستُستبدل حالة المسودة الحالية بالخيارات والتركيبات المنشورة. المتابعة؟')) return;
            restoreFromPublished();
            saveOptionsDraft();
            paintOptions();
          };
          optionsActionBar.appendChild(restorePub);
        }
      } else if (clearUndoSnapshot && hasValues) {
        // After clear + new values: still allow restoring the pre-clear in-session snapshot.
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.className = 'btn btn-ghost btn-sm';
        undo.setAttribute('data-undo-clear-options', '1');
        undo.textContent = 'استعادة ما قبل المسح';
        undo.onclick = () => {
          restoreFromClearUndo();
          saveOptionsDraft();
          paintOptions();
        };
        optionsActionBar.appendChild(undo);
      }
    }

    function paintOptions() {
      optionsBody.replaceChildren();
      optionsPreview.replaceChildren();
      if (type !== 'brand') {
        optionsSection.hidden = true;
        syncOptionsActionBar();
        return;
      }
      optionsSection.hidden = false;
      syncOptionsActionBar();
      const preset = optionPresets(category.value);

      if (!preset.groups.length && !preset.traits.length) {
        text(optionsBody, 'هذا التصنيف لا يحتاج خيارات مقاس أو لون أو حجم.');
        paintOptionsPreview();
        return;
      }
      preset.groups.forEach((group) => {
        const block = document.createElement('div');
        block.className = 'option-group';
        text(block, group.label, 'h4');
        const chips = document.createElement('div');
        chips.className = 'choice-row';
        if (!optionsState.selected[group.id]) optionsState.selected[group.id] = [];
        group.presets.forEach((label) => {
          const wrap = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = optionsState.selected[group.id].indexOf(label) >= 0;
          input.onchange = () => {
            const list = optionsState.selected[group.id];
            const at = list.indexOf(label);
            if (input.checked && at < 0) list.push(label);
            if (!input.checked && at >= 0) list.splice(at, 1);
            optionsState.clearingOptions = false;
            optionsState.clearingVariants = false;
            onOptionsValuesChanged();
          };
          wrap.append(input, document.createTextNode(' ' + label));
          chips.appendChild(wrap);
        });
        block.appendChild(chips);
        const custom = field(block, 'قيم خاصة (افصلي بفاصلة)', 'custom-' + group.id, optionsState.customs[group.id] || '', 'text');
        custom.oninput = () => {
          optionsState.customs[group.id] = custom.value;
          abandonClearIfValuesEntered();
          onOptionsValuesChanged();
        };
        optionsBody.appendChild(block);
      });
      if (preset.traits.length) {
        const traitBox = document.createElement('details');
        text(traitBox, 'تفاصيل إضافية (خصائص وصفية)', 'summary');
        preset.traits.forEach((key) => {
          const input = field(traitBox, key, 'trait-' + key, optionsState.traits[key] || '', 'text');
          input.oninput = () => {
            optionsState.traits[key] = input.value;
            saveOptionsDraft();
            paintOptionsPreview();
          };
        });
        optionsBody.appendChild(traitBox);
      }
      text(optionsBody, 'التركيبات (لا تُنشأ تلقائيًا من كل الاحتمالات)', 'h4');
      const variantList = document.createElement('div');
      variantList.className = 'variant-list';
      optionsState.variants.forEach((variant, index) => {
        const row = document.createElement('div');
        row.className = 'check-row';
        const label = document.createElement('span');
        label.textContent = Object.values(variant.labels || {}).join(' · ') + ' · id=' + variant.id;
        const price = document.createElement('input');
        price.type = 'text';
        price.placeholder = 'سعر خاص (ريال)';
        price.style.width = '6rem';
        price.value = variant.priceHalalas == null ? '' : String(variant.priceHalalas / 100);
        price.oninput = () => {
          const h = riyalsToHalalas(price.value);
          variant.priceHalalas = h;
          saveOptionsDraft();
          paintOptionsPreview();
        };
        const avail = document.createElement('label');
        const availInput = document.createElement('input');
        availInput.type = 'checkbox';
        availInput.checked = variant.available !== false;
        availInput.onchange = () => {
          variant.available = availInput.checked;
          saveOptionsDraft();
          paintOptionsPreview();
        };
        avail.append(availInput, document.createTextNode(' متاحة'));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-ghost btn-sm';
        remove.textContent = 'حذف';
        remove.onclick = () => {
          optionsState.variants.splice(index, 1);
          optionsState.clearingOptions = false;
          saveOptionsDraft();
          paintOptions();
        };
        row.append(label, price, avail, remove);
        variantList.appendChild(row);
      });
      optionsBody.appendChild(variantList);

      const addBox = document.createElement('div');
      addBox.className = 'form-section';
      addBox.setAttribute('data-variant-add-box', '1');
      text(addBox, 'إضافة تركيبة بالاختيار من القيم التي حددتها');
      const conflictBanner = document.createElement('p');
      conflictBanner.className = 'field-error';
      conflictBanner.setAttribute('role', 'alert');
      conflictBanner.setAttribute('data-variant-conflicts', '1');
      addBox.appendChild(conflictBanner);
      const pickersHost = document.createElement('div');
      pickersHost.setAttribute('data-variant-pickers', '1');
      addBox.appendChild(pickersHost);
      const pickers = {};
      function refreshVariantPickers() {
        const builtForPick = buildOptionGroups();
        const previous = {};
        Object.keys(pickers).forEach((id) => {
          previous[id] = pickers[id] ? String(pickers[id].value || '') : '';
        });
        const active = document.activeElement;
        const activeName = active && active.getAttribute ? active.getAttribute('name') : null;
        pickersHost.replaceChildren();
        Object.keys(pickers).forEach((id) => { delete pickers[id]; });
        if (!builtForPick.length) {
          text(pickersHost, 'حددي قيم الخيارات أعلاه قبل إضافة تركيبة.');
        }
        builtForPick.forEach((group) => {
          const wrap = document.createElement('label');
          wrap.className = 'field';
          const title = document.createElement('span');
          title.textContent = group.labelAr;
          const select = document.createElement('select');
          select.name = 'variantPick-' + group.id;
          select.setAttribute('aria-label', group.labelAr);
          select.setAttribute('data-placeholder', 'اختاري ' + group.labelAr);
          if (window.MiraCatalogOptions && window.MiraCatalogOptions.syncPickerOptions) {
            window.MiraCatalogOptions.syncPickerOptions(select, group.values, previous[group.id] || '');
          } else {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'اختاري ' + group.labelAr;
            select.appendChild(placeholder);
            group.values.forEach((value) => {
              const opt = document.createElement('option');
              opt.value = value.id;
              opt.textContent = value.labelAr;
              select.appendChild(opt);
            });
            if (group.values.some((v) => v.id === previous[group.id])) select.value = previous[group.id];
          }
          wrap.append(title, select);
          pickersHost.appendChild(wrap);
          pickers[group.id] = select;
        });
        if (activeName) {
          const restore = pickersHost.querySelector('[name="' + activeName + '"]');
          if (restore && typeof restore.focus === 'function') restore.focus();
        }
        const built = structuredOptionsPayload();
        conflictBanner.textContent = '';
        if (built.conflicts && built.conflicts.length) {
          conflictBanner.textContent = built.conflicts.map((c) => c.messageAr || c.message).join(' ');
        } else if (built.error) {
          conflictBanner.textContent = built.error;
        }
        return builtForPick;
      }
      refreshVariantPickers();
      const addPrice = field(addBox, 'سعر التركيبة بالريال (اختياري)', 'variantAddPrice', '', 'text');
      const addAvail = document.createElement('label');
      addAvail.className = 'check-row';
      const addAvailInput = document.createElement('input');
      addAvailInput.type = 'checkbox';
      addAvailInput.checked = true;
      addAvail.append(addAvailInput, document.createTextNode(' متاحة للشراء'));
      addBox.appendChild(addAvail);
      const dupNote = document.createElement('p');
      dupNote.className = 'field-error';
      dupNote.setAttribute('role', 'status');
      addBox.appendChild(dupNote);
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn btn-ghost';
      addBtn.textContent = 'إضافة التركيبة';
      addBtn.onclick = () => {
        const builtGroups = buildOptionGroups();
        optionsState.invalidVariantNote = '';
        dupNote.textContent = '';
        if (!builtGroups.length) {
          optionsState.invalidVariantNote = 'حددي قيم الخيارات قبل إضافة تركيبة.';
          dupNote.textContent = optionsState.invalidVariantNote;
          paintOptionsPreview();
          return;
        }
        const selections = {};
        const labels = {};
        for (let i = 0; i < builtGroups.length; i += 1) {
          const group = builtGroups[i];
          const select = pickers[group.id];
          const valueId = select ? String(select.value || '') : '';
          const value = group.values.find((v) => v.id === valueId);
          if (!value) {
            optionsState.invalidVariantNote = 'اختاري قيمة لـ «' + group.labelAr + '».';
            dupNote.textContent = optionsState.invalidVariantNote;
            paintOptionsPreview();
            return;
          }
          selections[group.id] = value.id;
          labels[group.id] = value.labelAr;
        }
        const dup = window.MiraCatalogOptions && window.MiraCatalogOptions.isDuplicateVariant
          ? window.MiraCatalogOptions.isDuplicateVariant(optionsState.variants, selections)
          : optionsState.variants.some((v) => builtGroups.every((g) => v.selections[g.id] === selections[g.id]));
        if (dup) {
          optionsState.invalidVariantNote = 'هذه التركيبة موجودة مسبقًا.';
          dupNote.textContent = optionsState.invalidVariantNote;
          paintOptionsPreview();
          return;
        }
        const priceH = addPrice.value.trim() === '' ? null : riyalsToHalalas(addPrice.value);
        if (addPrice.value.trim() !== '' && priceH == null) {
          optionsState.invalidVariantNote = 'سعر التركيبة غير صالح.';
          dupNote.textContent = optionsState.invalidVariantNote;
          paintOptionsPreview();
          return;
        }
        optionsState.variants.push({
          id: 'sku-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
          selections: selections,
          labels: labels,
          priceHalalas: priceH,
          available: addAvailInput.checked,
        });
        optionsState.clearingOptions = false;
        optionsState.clearingVariants = false;
        Object.keys(pickers).forEach((id) => { pickers[id].value = ''; });
        saveOptionsDraft();
        paintOptions();
      };
      addBox.appendChild(addBtn);
      optionsBody.appendChild(addBox);
      optionsBody._refreshVariantPickers = refreshVariantPickers;
      paintOptionsPreview();
    }

    function onOptionsValuesChanged() {
      abandonClearIfValuesEntered();
      saveOptionsDraft();
      if (typeof optionsBody._refreshVariantPickers === 'function') optionsBody._refreshVariantPickers();
      syncOptionsActionBar();
      paintOptionsPreview();
      if (type === 'brand') scheduleEditorDraftAutosave();
    }

    function buildOptionGroups() {
      const preset = optionPresets(category.value);
      if (window.MiraCatalogOptions && window.MiraCatalogOptions.buildOptionGroups) {
        return window.MiraCatalogOptions.buildOptionGroups(preset.groups, optionsState);
      }
      const groups = [];
      if (!optionsState.valueIds) optionsState.valueIds = {};
      preset.groups.forEach((group) => {
        const labels = (optionsState.selected[group.id] || []).slice();
        String(optionsState.customs[group.id] || '')
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((part) => {
            if (labels.indexOf(part) < 0) labels.push(part);
          });
        if (!labels.length) return;
        if (!optionsState.valueIds[group.id]) optionsState.valueIds[group.id] = {};
        groups.push({
          id: group.id,
          labelAr: group.label,
          kind: group.kind,
          values: labels.map((label, index) => {
            const existing = optionsState.valueIds[group.id][label];
            const id = existing || (window.MiraCatalogOptions && window.MiraCatalogOptions.slugValue
              ? window.MiraCatalogOptions.slugValue(label, index)
              : ('v' + (index + 1)));
            optionsState.valueIds[group.id][label] = id;
            return { id: id, labelAr: label };
          }),
        });
      });
      return groups;
    }

    /** Structured options from the easy UI → backend optionsJson / variantsJson (not localStorage-only). */
    function structuredOptionsPayload() {
      const groups = buildOptionGroups();
      optionsState._builtGroups = groups;
      const preset = optionPresets(category.value);
      if (window.MiraCatalogOptions && window.MiraCatalogOptions.structuredOptionsPayload) {
        return window.MiraCatalogOptions.structuredOptionsPayload(optionsState, preset.groups);
      }
      if (optionsState.clearingOptions) {
        return { optionsJson: null, variantsJson: null, clearing: true, error: null, conflicts: [] };
      }
      const variants = [];
      const errors = [];
      const conflicts = [];
      optionsState.variants.forEach((variant) => {
        if (!variant || !variant.id) {
          errors.push('تركيبة بلا معرف ثابت.');
          return;
        }
        const selections = {};
        let ok = true;
        groups.forEach((group) => {
          const label = variant.labels && variant.labels[group.id];
          const byId = variant.selections && variant.selections[group.id];
          const value = group.values.find((entry) => entry.id === byId) ||
            group.values.find((entry) => entry.labelAr === label);
          if (!value) {
            ok = false;
            const msg = 'التركيبة ' + variant.id + ' تشير إلى قيمة غير موجودة في «' + group.labelAr + '».';
            errors.push(msg);
            conflicts.push({ variantId: variant.id, groupId: group.id, messageAr: msg });
            return;
          }
          selections[group.id] = value.id;
          if (!variant.labels) variant.labels = {};
          variant.labels[group.id] = value.labelAr;
          variant.selections = Object.assign({}, variant.selections, selections);
        });
        if (!ok) return;
        if (Object.keys(selections).length !== groups.length) {
          errors.push('التركيبة ' + variant.id + ' ناقصة اختيارات.');
          return;
        }
        variants.push({
          id: variant.id,
          selections: selections,
          priceHalalas: typeof variant.priceHalalas === 'number' ? variant.priceHalalas : null,
          available: variant.available !== false,
        });
      });
      return {
        optionsJson: groups,
        variantsJson: variants,
        clearing: false,
        error: errors[0] || null,
        conflicts: conflicts,
      };
    }

    function paintOptionsPreview() {
      optionsPreview.replaceChildren();
      text(optionsPreview, 'معاينة الظهور في التفاصيل', 'h4');
      if (optionsState.clearingOptions) {
        text(optionsPreview, 'طلب مسح: ستُحذف الخيارات والتركيبات المنشورة بعد اعتماد الإدارة.');
        if (editing && item.optionsJson) text(optionsPreview, 'المنشور الحالي ما زال ظاهرًا للعميلات حتى الاعتماد.');
        return;
      }
      const preset = optionPresets(category.value);
      preset.groups.forEach((group) => {
        const selected = (optionsState.selected[group.id] || []).slice();
        String(optionsState.customs[group.id] || '').split(',').map((part) => part.trim()).filter(Boolean).forEach((part) => {
          if (selected.indexOf(part) < 0) selected.push(part);
        });
        if (!selected.length) return;
        text(optionsPreview, group.label);
        const row = document.createElement('div');
        row.className = 'choice-row';
        selected.forEach((label) => {
          const chip = document.createElement('span');
          chip.className = 'option-chip';
          chip.textContent = label;
          row.appendChild(chip);
        });
        optionsPreview.appendChild(row);
      });
      if (optionsState.variants.length) {
        text(
          optionsPreview,
          'التركيبات: ' + optionsState.variants.map((v) => {
            const price = v.priceHalalas == null ? 'السعر الأساسي' : (v.priceHalalas / 100) + ' ر.س';
            return Object.values(v.labels || {}).join('/') + ' (' + v.id + ', ' + price + (v.available === false ? ', غير متاحة' : '') + ')';
          }).join(' · '),
        );
      } else {
        text(optionsPreview, 'لا تُنشأ تركيبات تلقائيًا من حاصل ضرب الخيارات.');
      }
      if (optionsState.invalidVariantNote) text(optionsPreview, optionsState.invalidVariantNote);
      const built = structuredOptionsPayload();
      if (built.error) text(optionsPreview, built.error);
      else {
        text(
          optionsPreview,
          built.optionsJson && built.optionsJson.length
            ? 'عند الحفظ تُرسل الخيارات إلى الخادم (' + built.optionsJson.length + ' مجموعة، ' + built.variantsJson.length + ' تركيبة) مع الحفاظ على المعرفات والأسعار.'
            : 'لا خيارات منظمة للإرسال بعد.',
        );
      }
    }

    paintOptions();

    function purchaseMode() {
      const selected = form.querySelector('input[name="purchaseMode"]:checked');
      return selected ? selected.value : 'none';
    }

    function paintPreview() {
      const halalas = riyalsToHalalas(price.value);
      const lines = [
        (nameAr.value || 'بدون اسم') + ' · ' + categoryLabel(type, category.value),
        halalas == null ? 'السعر غير صالح' : formatPrice(halalas),
      ];
      if (type === 'brand') {
        if (purchaseMode() === 'link') lines.push(validUrl(url.value) ? 'سيظهر شراء عبر الرابط' : 'الرابط غير صالح، ولن يظهر اشتري الآن');
        else if (purchaseMode() === 'contact') lines.push('سيظهر تواصل إذا كان للجهة رقم');
        else lines.push('لن يظهر اشتري الآن');
      } else {
        lines.push(duration && duration.value ? 'المدة ' + duration.value + ' دقيقة' : 'بدون مدة');
      }
      previewBody.textContent = lines.join(' — ');
    }
    form.oninput = paintPreview;
    paintPreview();

    async function addStaged(fileList, placement) {
      for (const raw of Array.from(fileList || [])) {
        let file = raw;
        if (isHeic(raw)) {
          try {
            file = await heicToJpeg(raw);
          } catch (error) {
            staged[form.id].push({
              key: raw.name + ':' + raw.size + ':' + raw.lastModified,
              file: raw,
              status: 'فشل',
              error: error.message || 'تعذر تحويل صورة الآيفون',
              percent: null,
              url: URL.createObjectURL(raw),
              placement: placement === 'detail' ? 'detail' : 'main',
            });
            continue;
          }
        }
        let problem = mediaProblem(file);
        if (!problem && isPhoneVideo(file)) {
          const seconds = await videoDurationSeconds(file);
          if (seconds != null && seconds > 300) problem = 'مدة الفيديو يجب ألا تتجاوز 5 دقائق';
        }
        const entry = {
          key: file.name + ':' + file.size + ':' + file.lastModified,
          file: file,
          status: problem ? 'فشل' : (item && item.id ? 'جارٍ الرفع' : (developerAccount ? 'جارٍ تجهيز النشر' : 'بانتظار الحفظ')),
          error: problem,
          percent: null,
          url: URL.createObjectURL(file),
          placement: placement === 'detail' ? 'detail' : 'main',
        };
        staged[form.id].push(entry);
        if (!problem && item && item.id) uploadOne(entry);
      }
      paintMedia(null);
      if (developerAccount && form.dataset.saving !== '1' && staged[form.id].some((entry) => entry.status === 'جارٍ تجهيز النشر')) {
        const published = await persistListing();
        if (!published) {
          staged[form.id].forEach((entry) => {
            if (entry.status === 'جارٍ تجهيز النشر') entry.status = 'بانتظار البيانات';
          });
          paintMedia(null);
        }
      }
    }
    images.onchange = () => { addStaged(images.files, 'main'); images.value = ''; };
    videos.onchange = () => { addStaged(videos.files, 'main'); videos.value = ''; };
    detailImages.onchange = () => { addStaged(detailImages.files, 'detail'); detailImages.value = ''; };
    detailVideos.onchange = () => { addStaged(detailVideos.files, 'detail'); detailVideos.value = ''; };

    async function paintMedia(serverMedia) {
      mediaBox.replaceChildren();
      detailMediaBox.replaceChildren();
      const rows = staged[form.id];
      rows.forEach((entry, index) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.fileKey = entry.key;
        text(card, (entry.placement === 'detail' ? 'داخل التفاصيل' : 'العرض الرئيسي') + ' · ' + entry.file.name + ' · ' + entry.status + (entry.error ? ' · ' + entry.error : ''));
        const stateLine = document.createElement('p');
        stateLine.className = 'media-state';
        const progress = document.createElement('div');
        progress.className = 'media-progress';
        const progressBar = document.createElement('span');
        progressBar.className = 'media-progress-bar';
        progress.appendChild(progressBar);
        const viewInfo = window.MiraMotion ? MiraMotion.describeMedia(entry) : { label: entry.status, mode: 'idle', percent: null };
        stateLine.textContent = viewInfo.label;
        if (window.MiraMotion) MiraMotion.applyProgress(progress, viewInfo);
        card.append(stateLine, progress);
        const view = document.createElement(isPhoneVideo(entry.file) ? 'video' : 'img');
        view.src = entry.url;
        view.alt = entry.file.name;
        if (isPhoneVideo(entry.file)) view.controls = true;
        card.appendChild(view);
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-ghost';
        retry.textContent = 'إعادة المحاولة';
        retry.setAttribute('aria-label', 'إعادة محاولة رفع ' + entry.file.name);
        retry.disabled = entry.status === 'جارٍ القراءة' || entry.status === 'جارٍ الرفع' || entry.status === 'جارٍ المعالجة' || entry.status === 'جارٍ تجهيز النشر';
        retry.onclick = () => {
          if (!item || !item.id) persistListing();
          else uploadOne(entry);
        };
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn btn-ghost';
        cancel.textContent = 'إلغاء';
        cancel.setAttribute('aria-label', 'إلغاء رفع ' + entry.file.name);
        cancel.disabled = !entry.controller;
        cancel.onclick = () => { if (entry.controller) entry.controller.abort(); };
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-ghost';
        remove.textContent = 'إزالة';
        remove.setAttribute('aria-label', 'إزالة ' + entry.file.name);
        remove.onclick = () => {
          if (entry.controller) entry.controller.abort();
          URL.revokeObjectURL(entry.url);
          rows.splice(index, 1);
          paintMedia(serverMedia);
        };
        const up = document.createElement('button');
        up.type = 'button';
        up.textContent = 'أعلى';
        let earlier = index - 1;
        while (earlier >= 0 && rows[earlier].placement !== entry.placement) earlier -= 1;
        up.disabled = earlier < 0;
        up.onclick = () => {
          if (earlier < 0) return;
          const swap = rows[earlier];
          rows[earlier] = rows[index];
          rows[index] = swap;
          paintMedia(serverMedia);
        };
        card.append(up, retry, cancel, remove);
        (entry.placement === 'detail' ? detailMediaBox : mediaBox).appendChild(card);
      });
      if (!item || !item.id) {
        text(mediaBox, developerAccount
          ? 'اختيار الملف يبدأ الرفع بالنسبة ثم النشر مباشرة. الاسم والسعر والتصنيف مطلوبة قبل أن يبدأ.'
          : 'الرفع يبدأ بعد حفظ المسودة. الملفات المختارة تبقى هنا.');
        return;
      }
      let media = serverMedia;
      if (!media) {
        try {
          const previewData = await PartnersApi.preview(type === 'brand' ? 'products' : 'services', item.id);
          media = previewData.media || [];
          if (previewData.reviewNote) status.textContent = 'سبب المراجعة: ' + previewData.reviewNote;
        } catch (error) {
          text(mediaBox, 'تعذر تحميل الوسائط المحفوظة: ' + error.message);
          return;
        }
      }
      const ids = media.map((row) => row.id);
      media.forEach((row, index) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        const primary = row.draftIsPrimary == null ? row.isPrimary : row.draftIsPrimary;
        const place = row.placement === 'detail' ? 'داخل التفاصيل' : (row.placement === 'cover' ? 'غلاف الفيديو' : 'العرض الرئيسي');
        text(card, (row.kind === 'video' ? 'فيديو محفوظ' : 'صورة محفوظة') + ' · ' + place + (primary ? ' · غلاف' : '') + ' · ' + (row.publication || 'draft') + (row.pendingRemoval ? ' · طلب إزالة' : ''));
        const view = document.createElement(row.kind === 'video' ? 'video' : 'img');
        view.alt = '';
        card.appendChild(view);
        fetch(PartnersApi.base + '/partners-portal/media/' + row.id, {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('mira_partner_token') },
        }).then(async (response) => {
          if (!response.ok) throw new Error('تعذر المعاينة');
          view.src = URL.createObjectURL(await response.blob());
          if (row.kind === 'video') view.controls = true;
        }).catch(() => { text(card, 'تعذر عرض المعاينة'); });
        const up = document.createElement('button');
        up.type = 'button';
        up.textContent = 'أعلى';
        const placeKey = row.placement === 'detail' ? 'detail' : (row.placement === 'cover' ? 'cover' : 'main');
        let earlierId = null;
        for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
          const candidate = media[cursor].placement === 'detail' ? 'detail' : (media[cursor].placement === 'cover' ? 'cover' : 'main');
          if (candidate === placeKey) {
            earlierId = media[cursor].id;
            break;
          }
        }
        up.disabled = earlierId == null;
        up.onclick = async () => {
          if (!earlierId) return;
          const order = ids.slice();
          const from = order.indexOf(row.id);
          const to = order.indexOf(earlierId);
          if (from < 0 || to < 0) return;
          const swap = order[from];
          order[from] = order[to];
          order[to] = swap;
          await PartnersApi.reorderMedia(type === 'brand' ? 'products' : 'services', item.id, order);
          paintMedia(null);
        };
        const cover = document.createElement('button');
        cover.type = 'button';
        cover.textContent = 'غلاف';
        cover.disabled = row.kind !== 'image' || row.placement === 'detail';
        cover.onclick = async () => {
          await PartnersApi.setPrimary(type === 'brand' ? 'products' : 'services', item.id, row.id);
          paintMedia(null);
        };
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'إزالة';
        remove.onclick = async () => {
          await PartnersApi.removeMedia(type === 'brand' ? 'products' : 'services', item.id, row.id);
          paintMedia(null);
        };
        card.append(up, cover, remove);
        (row.placement === 'detail' ? detailMediaBox : mediaBox).appendChild(card);
      });
    }

    function syncMedia(entry) {
      const card = mediaBox.querySelector('[data-file-key="' + entry.key + '"]') || detailMediaBox.querySelector('[data-file-key="' + entry.key + '"]');
      const view = window.MiraMotion ? MiraMotion.describeMedia(entry) : { label: entry.status, mode: 'idle', percent: null };
      if (!card) return;
      const line = card.querySelector('.media-state');
      if (line) line.textContent = view.label;
      if (window.MiraMotion) MiraMotion.applyProgress(card.querySelector('.media-progress'), view);
    }

    async function uploadOne(entry, options) {
      const policy = await loadUploadSessionPolicy();
      if (policy && policy._source === 'error') {
        entry.status = 'فشل';
        entry.error = 'تعذر قراءة سياسة الرفع: ' + (policy.error || 'خطأ شبكة');
        entry.percent = null;
        paintMedia(null);
        status.textContent = entry.error;
        return;
      }
      const problem = mediaProblem(entry.file, policy);
      if (problem) {
        entry.status = 'فشل';
        entry.error = problem;
        entry.percent = null;
        paintMedia(null);
        return;
      }
      if (!item || !item.id) {
        entry.status = developerAccount ? 'بانتظار البيانات' : 'بانتظار الحفظ';
        entry.percent = null;
        paintMedia(null);
        return;
      }
      if (entry._uploadBusy) return;
      entry._uploadBusy = true;
      const controller = new AbortController();
      entry.controller = controller;
      entry.error = '';
      entry.percent = null;
      entry.status = policy && policy.enabled ? 'جارٍ التحضير' : 'جارٍ القراءة';
      paintMedia(null);
      if (window.MiraMotion) MiraMotion.announce('بدأ رفع ' + entry.file.name);
      try {
        const kind = type === 'brand' ? 'products' : 'services';
        if (policy && policy.enabled === true && typeof PartnersApi.uploadViaSession === 'function') {
          if (!entry.clientMediaId) {
            entry.clientMediaId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random();
          }
          entry.status = 'جارٍ التحضير';
          syncMedia(entry);
          await PartnersApi.uploadViaSession(kind, item.id, entry.file, {
            placement: entry.placement || 'main',
            mimeType: uploadMime(entry.file),
            clientMediaId: entry.clientMediaId,
            idempotencyKey: entry.clientMediaId,
            sessionId: entry.uploadSessionId || undefined,
            clientDraftId: (draftCtx && draftCtx.clientDraftId) || undefined,
            signal: controller.signal,
            onSession: (session) => {
              entry.uploadSessionId = session && session.sessionId;
            },
            onHashProgress: () => {
              entry.status = 'جارٍ التحضير';
              syncMedia(entry);
            },
            onProgress: (ratio) => {
              entry.status = 'جارٍ الرفع';
              entry.percent = ratio;
              syncMedia(entry);
            },
            onProcessing: () => {
              entry.status = 'جارٍ التحقق';
              entry.percent = null;
              syncMedia(entry);
            },
          });
        } else {
          const dataBase64 = await fileToBase64(entry.file, (ratio) => {
            entry.percent = ratio;
            entry.status = 'جارٍ القراءة';
            syncMedia(entry);
          }, controller.signal);
          if (controller.signal.aborted) throw Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' });
          entry.status = 'جارٍ الرفع';
          entry.percent = null;
          syncMedia(entry);
          const send = PartnersApi.addMediaProgress || PartnersApi.addMedia;
          await send(kind, item.id, uploadMime(entry.file), dataBase64, {
            placement: entry.placement || 'main',
            signal: controller.signal,
            onProgress: (ratio) => {
              entry.status = 'جارٍ الرفع';
              entry.percent = ratio;
              syncMedia(entry);
            },
            onProcessing: () => {
              entry.status = 'جارٍ المعالجة';
              entry.percent = null;
              syncMedia(entry);
            },
          });
        }
        entry.status = 'رُفع';
        entry.error = '';
        entry.percent = 1;
        entry.controller = null;
        syncMedia(entry);
        URL.revokeObjectURL(entry.url);
        const at = staged[form.id].indexOf(entry);
        if (at >= 0) staged[form.id].splice(at, 1);
        if (!(options && options.deferPublish) && developerAccount && item && item.id) {
          try {
            await PartnersApi.submitReview(type === 'brand' ? 'products' : 'services', item.id);
            status.textContent = 'رُفع الملف ونُشر في التطبيق مباشرة.';
          } catch (error) {
            status.textContent = 'رُفع الملف ولم يُنشر: ' + (error.message || '');
          }
        } else if (!developerAccount) {
          status.textContent = 'رُفع الملف ورُبط بالمسودة. لن يظهر في التطبيق قبل الاعتماد.';
        }
        if (window.MiraMotion) MiraMotion.announce(status.textContent);
      } catch (error) {
        entry.controller = null;
        entry.percent = null;
        if (error && error.name === 'AbortError') {
          entry.status = 'أُلغي';
          entry.error = '';
          status.textContent = 'أُلغي الرفع وبقي الملف في النموذج.';
          if (entry.uploadSessionId && typeof PartnersApi.abortUploadSession === 'function') {
            try { await PartnersApi.abortUploadSession(entry.uploadSessionId); } catch (_) {}
          }
        } else {
          entry.status = 'فشل';
          entry.error = error.message || 'فشل الرفع';
          status.textContent = developerAccount ? 'فشل الرفع ولم يُنشر: ' + entry.error : 'فشل الرفع وبقيت المسودة: ' + entry.error;
        }
        if (window.MiraMotion) MiraMotion.announce(status.textContent);
      } finally {
        entry._uploadBusy = false;
      }
      paintMedia(null);
    }

    paintMedia(null);

    submit.onclick = async () => {
      if (!item || !item.id) {
        if (developerAccount) {
          await persistListing();
          return;
        }
        status.textContent = 'احفظي المسودة قبل الإرسال للمراجعة.';
        return;
      }
      status.textContent = developerAccount ? 'جارٍ النشر في التطبيق' : 'جارٍ التحقق ثم الإرسال';
      try {
        await PartnersApi.submitReview(type === 'brand' ? 'products' : 'services', item.id);
        status.textContent = developerAccount
          ? 'نُشر في التطبيق مباشرة، بلا مراجعة.'
          : 'أُرسل للمراجعة. لن يظهر في التطبيق قبل اعتماد الإدارة.';
        if (window.reloadPartnerDashboard) await window.reloadPartnerDashboard({ preserveForms: true });
      } catch (error) {
        status.textContent = 'تعذر الإرسال: ' + error.message;
      }
    };

    function parseJsonList(raw, field, label) {
      const trimmed = raw.trim();
      if (!trimmed) return { value: undefined };
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) throw new Error('not array');
        return { value: parsed };
      } catch (error) {
        return { error: { field: field, message: label + ' يجب أن تكون قائمة JSON صالحة.' } };
      }
    }

    // Builds the commerce part of the payload. `null` clears a column on the server.
    function readCommerce() {
      const value = { purchaseMode: internalToggle.checked ? 'internal_cod' : 'external' };
      const stockRaw = stockInput.value.trim();
      if (stockRaw === '') value.stockQty = null;
      else if (/^\d+$/.test(stockRaw)) value.stockQty = parseInt(stockRaw, 10);
      else return { error: { field: 'stockQty', message: 'المخزون عدد صحيح أو فارغ.' } };

      const feeRaw = feeInput.value.trim();
      if (feeRaw === '') value.deliveryFeeHalalas = null;
      else {
        const fee = riyalsToHalalas(feeRaw);
        if (fee == null) return { error: { field: 'deliveryFeeSar', message: 'رسوم التوصيل بالريال، مثل 15، أو اتركيها فارغة.' } };
        value.deliveryFeeHalalas = fee;
      }

      const built = (() => {
        abandonClearIfValuesEntered();
        return structuredOptionsPayload();
      })();
      const advancedOn = Boolean(optionsJsonInput._advancedToggle && optionsJsonInput._advancedToggle.checked);
      if (advancedOn) {
        const options = parseJsonList(optionsJsonInput.value, 'optionsJson', 'الخيارات');
        if (options.error) return options;
        const variants = parseJsonList(variantsJsonInput.value, 'variantsJson', 'التركيبات');
        if (variants.error) return variants;
        if (options.value !== undefined) value.optionsJson = options.value;
        if (variants.value !== undefined) value.variantsJson = variants.value;
      } else {
        // Easy UI is the source of truth. Never let a stale JSON textarea override it.
        // Category change that would drop saved groups must not become optionsJson=null (RC6-01).
        if (built.error || (built.conflicts && built.conflicts.length)) {
          return {
            error: {
              field: 'variantsJson',
              message: built.error || (built.conflicts[0] && built.conflicts[0].messageAr) || 'تعارض في الخيارات',
            },
          };
        }
        if (built.clearing) {
          value.optionsJson = null;
          value.variantsJson = null;
        } else if (built.optionsJson && built.optionsJson.length) {
          value.optionsJson = built.optionsJson;
          value.variantsJson = built.variantsJson;
        } else if (optionsState.clearingOptions) {
          value.optionsJson = null;
          value.variantsJson = null;
        }
        // If empty without explicit clear: omit fields (keep server state). Never silent-null.
      }

      if (value.optionsJson === undefined) delete value.optionsJson;
      if (value.variantsJson === undefined) delete value.variantsJson;
      return { value: value };
    }

    function capturePersistOp() {
      const ctx = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
      const auth =
        window.MiraEditorV2 && typeof MiraEditorV2.__testHooks === 'function'
          ? MiraEditorV2.__testHooks().captureSessionSnapshot()
          : null;
      return {
        formId: form.id,
        clientDraftId: (ctx && ctx.clientDraftId) || null,
        ownerId: resolveOwnerId(),
        formGeneration: (ctx && ctx.formGeneration) || null,
        opId: (ctx && ctx.opId) || null,
        auth: auth,
        token: 'persist:' + form.id + ':' + String(Date.now()) + ':' + Math.random().toString(16).slice(2),
      };
    }

    function assertPersistOpLive(op) {
      if (!op) return false;
      if (!form.isConnected || form.id !== op.formId) return false;
      const live = window.MiraEditorV2 && MiraEditorV2.getEditContext(op.formId);
      if (window.MiraEditorV2) {
        // Legacy path (V2 flag off): MiraEditorV2 may be loaded but disabled — do not require ctx.
        if (MiraEditorV2.state && MiraEditorV2.state.enabled) {
          if (!live) return false;
          if (op.clientDraftId && live.clientDraftId !== op.clientDraftId) return false;
          if (op.formGeneration != null && live.formGeneration !== op.formGeneration) return false;
          if (op.opId && live.opId && live.opId !== op.opId) return false;
        } else if (live) {
          // Flag off but a context exists — still refuse cross-draft pollution.
          if (op.clientDraftId && live.clientDraftId && live.clientDraftId !== op.clientDraftId) return false;
          if (op.formGeneration != null && live.formGeneration != null && live.formGeneration !== op.formGeneration) {
            return false;
          }
        }
      }
      if (op.ownerId) {
        const liveOwner = resolveOwnerId();
        if (liveOwner && liveOwner !== op.ownerId) return false;
      } else {
        const liveOwner = resolveOwnerId();
        // F4: null→createdOwner for THIS op is legitimate once create returns.
        // Refuse only when live owner is some OTHER id (user switched forms / drafts).
        if (liveOwner && liveOwner !== op.createdOwnerId) return false;
      }
      if (op.auth && window.MiraEditorV2 && typeof MiraEditorV2.__testHooks === 'function') {
        if (!MiraEditorV2.__testHooks().assertSameSession(op.auth)) return false;
      }
      return true;
    }

    function ownsPersistBusy(persistOp) {
      return Boolean(
        persistOp &&
          persistOp.token &&
          activePersistToken === persistOp.token &&
          form.dataset.persistToken === persistOp.token,
      );
    }

    function beginPersistBusy(persistOp, busyLabel) {
      activePersistToken = persistOp.token;
      form.dataset.saving = '1';
      form.dataset.persistToken = persistOp.token;
      if (save) {
        save.disabled = true;
        save.setAttribute('aria-busy', 'true');
        save.classList.add('is-busy');
        save.classList.remove('is-success');
        if (busyLabel) save.textContent = busyLabel;
      }
    }

    function releasePersistBusyIfOwned(persistOp, idleLabel) {
      if (!persistOp || !ownsPersistBusy(persistOp)) return;
      if (!assertPersistOpLive(persistOp) && form.dataset.saving === '1') {
        // Stale op must not clear a newer owner's busy — only clear if we still own the token.
        if (activePersistToken !== persistOp.token) return;
      }
      if (activePersistToken !== persistOp.token) return;
      form.dataset.saving = '';
      delete form.dataset.persistToken;
      activePersistToken = null;
      if (save) {
        save.disabled = false;
        save.removeAttribute('aria-busy');
        save.classList.remove('is-busy');
        if (idleLabel) save.textContent = idleLabel;
      }
    }

    const persistListing = async () => {
      if (form.dataset.saving === '1') return false;

      const persistOp = capturePersistOp();
      const liveOwnerId = resolveOwnerId();

      // v2 without an owned item: draft autosave only. Once targetOwnerId/item.id exists, never create again.
      if (window.MiraEditorV2 && MiraEditorV2.state.enabled && !liveOwnerId) {
        const built = buildEditorValues();
        if (!built.ok) {
          (built.fieldErrors || []).forEach((fe) => setFieldError(form, fe.fieldId, fe.message));
          status.textContent = 'لم يُحفظ — أصلحي الحقول المحددة. التعديلات ما زالت في النموذج.';
          MiraEditorV2.setStatus(form, 'لم يُحفظ', 'error');
          return false;
        }
        scheduleEditorDraftAutosave();
        const saved = await MiraEditorV2.flushUntilSettled(form);
        if (!saved || !saved.ok) {
          if (saved && (saved.conflict || saved.reason === 'revision-conflict')) {
            status.textContent =
              'تعارض تعديل مع جلسة أخرى. تعديلاتك ما زالت في النموذج — اختاري إعادة التحميل أو الإبقاء (لا تحديث تلقائي لرقم الإصدار).';
            return false;
          }
          status.textContent = 'تعذر حفظ المسودة الخادمية' + (saved && saved.reason ? ' (' + saved.reason + ')' : '') + '.';
          return false;
        }
        status.textContent = 'حُفظت المسودة الخادمية · rev ' + saved.revision + '. استخدمي زر التحويل للإرسال للمراجعة.';
        MiraEditorV2.setStatus(form, 'محفوظ', 'saved');
        return true;
      }

      ['nameAr', 'priceSar', 'category', 'externalUrl', 'durationMin'].forEach((name) => setFieldError(form, name, ''));
      let blocked = false;
      if (nameAr.value.trim().length < 2) {
        setFieldError(form, 'nameAr', 'الاسم مطلوب.');
        blocked = true;
      }
      const priceRawPersist = String(price.value ?? '').trim();
      const halalas = priceRawPersist === '' ? null : riyalsToHalalas(priceRawPersist);
      if (priceRawPersist !== '' && halalas == null) {
        setFieldError(form, 'priceSar', 'أدخلي السعر بالريال، مثل 52.');
        blocked = true;
      } else if (halalas == null) {
        setFieldError(form, 'priceSar', 'أدخلي السعر بالريال، مثل 52.');
        blocked = true;
      }
      if (!category.value) {
        setFieldError(form, 'category', 'اختاري التصنيف.');
        blocked = true;
      }
      if (type === 'brand' && purchaseMode() === 'link' && !validUrl(url.value)) {
        setFieldError(form, 'externalUrl', 'رابط الشراء غير صالح. اتركيه فارغًا إذا لا يوجد شراء.');
        blocked = true;
      }
      if (type === 'brand' && purchaseMode() === 'contact' && !(window.sessionPartner && window.sessionPartner.contactPhone)) {
        status.textContent = 'لا توجد وسيلة تواصل صالحة على حساب الجهة.';
        blocked = true;
      }
      if (duration && duration.value && Number(duration.value) < 5) {
        setFieldError(form, 'durationMin', 'المدة 5 دقائق على الأقل، أو اتركيها فارغة.');
        blocked = true;
      }
      let commerce = null;
      if (type === 'brand') {
        ['stockQty', 'deliveryFeeSar', 'optionsJson', 'variantsJson'].forEach((name) => setFieldError(form, name, ''));
        commerce = readCommerce();
        if (commerce.error) {
          setFieldError(form, commerce.error.field, commerce.error.message);
          blocked = true;
        } else if (commerce.value.purchaseMode === 'internal_cod' && halalas != null && halalas <= 0) {
          setFieldError(form, 'priceSar', 'الطلب داخل ميرا يتطلب سعرًا أكبر من صفر.');
          blocked = true;
        }
      }
      if (blocked) {
        status.textContent = developerAccount
          ? 'لم يبدأ النشر. أكملي الاسم والسعر والتصنيف، والبيانات التي كتبتها ما زالت في النموذج.'
          : 'لم يُرسل الحفظ. البيانات التي كتبتها ما زالت في النموذج.';
        return false;
      }
      const payload = {
        nameAr: nameAr.value.trim(),
        descriptionAr: String(new FormData(form).get('descriptionAr') || ''),
        priceHalalas: halalas,
        category: category.value,
        concernTags: tags.value.split(',').map((part) => part.trim()).filter(Boolean),
      };
      payload.nameEn = String(new FormData(form).get('nameEn') || '').trim();
      if (type === 'brand') {
        payload.externalUrl = purchaseMode() === 'link' ? url.value.trim() : '';
        Object.assign(payload, commerce.value);
        if (cosmeticVisible()) {
          payload.skinTypes = skin.value.split(',').map((part) => part.trim()).filter(Boolean);
          payload.stepAr = step.value.trim();
        } else {
          payload.skinTypes = [];
          payload.stepAr = '';
        }
      } else {
        if (duration && duration.value) payload.durationMin = parseInt(duration.value, 10);
        if (bookingToggle) payload.bookingEnabled = Boolean(bookingToggle.checked);
        payload.payMode = 'pay_at_venue';
        if (availabilityJson && typeof availabilityJson.build === 'function') {
          try {
            payload.availabilityJson = availabilityJson.build();
            if (availabilityJson.unifyToggle && availabilityJson.unifyToggle.checked) {
              payload.unifySharedResources = true;
            }
          } catch (error) {
            status.textContent = 'لم يُرسل الحفظ. ' + (error.message || 'أصلحي جدول التوفر.');
            return false;
          }
        }
      }
      const idleLabel = save.textContent;
      beginPersistBusy(persistOp, developerAccount ? 'جارٍ النشر' : 'جارٍ الحفظ');
      status.textContent = developerAccount ? 'جارٍ تجهيز النشر' : 'جارٍ حفظ المسودة';
      if (window.MiraMotion) MiraMotion.announce(status.textContent);
      // Track step outcomes outside try so catch can report partial success honestly.
      let savedProfile = null;
      let profileSaved = false;
      let basicsSaved = false;
      let ownerId = resolveOwnerId();
      try {
        // Decision is always live owner id — never the form-build `editing` snapshot.
        ownerId = resolveOwnerId();

        // Editor v2 open draft (no owner yet): persist the server draft only.
        // Do NOT createProduct/createService here — materialize owns creation (prevents duplicates
        // and unbound profile revisions that break the first post-materialize save).
        if (
          window.MiraEditorV2 &&
          MiraEditorV2.state.enabled &&
          !ownerId &&
          !(window.sessionPartner && window.sessionPartner.type === 'developer')
        ) {
          scheduleEditorDraftAutosave();
          const draftSaved = await MiraEditorV2.flushUntilSettled(form);
          if (!assertPersistOpLive(persistOp)) return false;
          releasePersistBusyIfOwned(persistOp, idleLabel);
          if (draftSaved && draftSaved.ok) {
            save.classList.add('is-success');
            save.textContent = 'تم الحفظ';
            status.textContent =
              'حُفظت المسودة الخادمية (rev ' +
              draftSaved.revision +
              '). بعد التحويل يمكنك تعديل القالب والحفظ مباشرة دون إعادة فتح.';
            MiraEditorV2.setStatus(form, 'محفوظ', 'saved');
            return true;
          }
          save.textContent = idleLabel;
          status.textContent =
            'لم يُؤكد حفظ المسودة' +
            (draftSaved && draftSaved.reason ? ' (' + draftSaved.reason + ')' : '') +
            '. أصلحي الحقول ثم أعيدي المحاولة.';
          return false;
        }

        // F1: finish profile bind BEFORE snapshotting what we will put — never send a
        // pre-bind localStorage template under a revision that belonged to server data.
        if (type !== 'brand' && ownerId) {
          if (serviceProfileBindPromise || serviceProfileBindStatus === 'binding') {
            status.textContent = 'جارٍ اكتمال تحميل قالب الخدمة قبل الحفظ…';
            await serviceProfileBindPromise;
            if (!assertPersistOpLive(persistOp)) {
              releasePersistBusyIfOwned(persistOp, idleLabel);
              return false;
            }
          }
          if (
            boundServiceReviewRevision == null ||
            serviceProfileBindStatus === 'idle' ||
            serviceProfileBindStatus === 'error'
          ) {
            status.textContent = 'جارٍ تجهيز إصدار قالب الخدمة…';
            await ensureServiceProfileBound(ownerId, { force: true, mode: 'server' });
            if (!assertPersistOpLive(persistOp)) {
              releasePersistBusyIfOwned(persistOp, idleLabel);
              return false;
            }
          }
          if (serviceProfileBindStatus === 'local-diverged') {
            releasePersistBusyIfOwned(persistOp, idleLabel);
            status.textContent =
              'لم يُحفظ — القالب المحلي يختلف عن الخادم. حلّي التعارض أولًا (إعادة تحميل أو إبقاء ثم حفظ بعد المطابقة).';
            showServiceProfileConflictUi(ownerId);
            return false;
          }
        }

        // Snapshot AFTER bind settles. Include any intentional user edits typed during bind.
        const persistEpoch = formContentEpoch;
        const profilePayloadForOp =
          type !== 'brand' && templateState && templateState.templateId
            ? {
                templateId: templateState.templateId,
                templateVersion: templateState.templateVersion || 1,
                priceMode: templateState.priceMode || 'fixed',
                answers: Object.assign({}, templateState.answers || {}),
                expectedRevision: boundServiceReviewRevision,
              }
            : null;

        // Service template FIRST with the revision bound to THIS painted data — never get-latest-then-overwrite.
        if (type !== 'brand' && ownerId && profilePayloadForOp) {
          if (profilePayloadForOp.expectedRevision == null) {
            releasePersistBusyIfOwned(persistOp, idleLabel);
            status.textContent =
              'لم يُحفظ القالب — تعذر ربط إصدار الخدمة بعد الإنشاء. أبقي النموذج مفتوحًا وأعيدي المحاولة؛ لا حاجة لإغلاقه.';
            return false;
          }
          try {
            savedProfile = await PartnersApi.putServiceProfile(ownerId, {
              expectedRevision: profilePayloadForOp.expectedRevision,
              templateId: profilePayloadForOp.templateId,
              templateVersion: profilePayloadForOp.templateVersion,
              priceMode: profilePayloadForOp.priceMode,
              answers: profilePayloadForOp.answers,
            });
            // Server accepted this op's profile write even if the form later switched —
            // mark before live-check so catch can report partial honesty on same-form failures.
            profileSaved = true;
            if (!assertPersistOpLive(persistOp)) {
              // Server may have accepted A's profile — do not mutate B's UI/context.
              return false;
            }
            boundServiceReviewRevision = savedProfile.reviewRevision;
            const liveDoc = savedProfile.draftServiceProfileSet
              ? savedProfile.draftServiceProfileJson
              : savedProfile.serviceProfileJson;
            // F2: do not clobber newer in-form template edits with the just-confirmed put response.
            if (liveDoc && formContentEpoch === persistEpoch) {
              templateState.templateId = liveDoc.templateId;
              templateState.templateVersion = liveDoc.templateVersion || 1;
              templateState.priceMode = liveDoc.priceMode || 'fixed';
              templateState.answers = Object.assign({}, liveDoc.answers || {});
              boundProfileFingerprint = fingerprintProfileState(templateState);
            } else if (liveDoc) {
              boundProfileFingerprint = fingerprintProfileState({
                templateId: liveDoc.templateId,
                templateVersion: liveDoc.templateVersion || 1,
                priceMode: liveDoc.priceMode || 'fixed',
                answers: liveDoc.answers || {},
              });
            }
          } catch (profileError) {
            if (!assertPersistOpLive(persistOp)) return false;
            const msg = String(profileError && profileError.message ? profileError.message : profileError);
            const code = (profileError && profileError.code) || '';
            if (code === 'SERVICE_PROFILE_REVISION_CONFLICT' || /تعارض|REVISION|409/.test(msg + code)) {
              releasePersistBusyIfOwned(persistOp, idleLabel);
              status.textContent =
                'تعارض قالب الخدمة مع نسخة أحدث. تعديلاتك ما زالت في النموذج — لم نكتب فوق الخادم.';
              showServiceProfileConflictUi(ownerId);
              if (window.MiraEditorV2) {
                MiraEditorV2.setStatus(form, 'تعارض قالب الخدمة', 'conflict');
              }
              return false;
            }
            throw profileError;
          }
        }

        // Re-read basics at send time so multi-step save does not mix an older name with a newer template
        // unless the user edited mid-flight — then we keep the original payload for THIS request and
        // report unsaved newer edits after (F2).
        let basicsPayload = payload;
        if (formContentEpoch === persistEpoch) {
          const priceRawLive = String(price.value ?? '').trim();
          const halalasLive = priceRawLive === '' ? null : riyalsToHalalas(priceRawLive);
          if (halalasLive != null) {
            basicsPayload = Object.assign({}, payload, {
              nameAr: nameAr.value.trim(),
              descriptionAr: String(new FormData(form).get('descriptionAr') || ''),
              priceHalalas: halalasLive,
              category: category.value,
              nameEn: String(new FormData(form).get('nameEn') || '').trim(),
              concernTags: tags.value.split(',').map((part) => part.trim()).filter(Boolean),
            });
            if (type === 'brand') {
              basicsPayload.externalUrl = purchaseMode() === 'link' && url ? url.value.trim() : '';
              if (cosmeticVisible()) {
                basicsPayload.skinTypes = skin.value.split(',').map((part) => part.trim()).filter(Boolean);
                basicsPayload.stepAr = step.value.trim();
              }
            }
            if (type !== 'brand' && duration && duration.value) {
              basicsPayload.durationMin = parseInt(duration.value, 10);
            }
            if (type !== 'brand' && bookingToggle) {
              basicsPayload.bookingEnabled = Boolean(bookingToggle.checked);
            }
          }
        }

        const saved = ownerId
          ? await (type === 'brand'
              ? PartnersApi.updateProduct(ownerId, basicsPayload)
              : PartnersApi.updateService(ownerId, basicsPayload))
          : await (type === 'brand'
              ? PartnersApi.createProduct(basicsPayload)
              : PartnersApi.createService(basicsPayload));
        // F4: create null→this id is the legitimate owner bind for THIS op.
        if (!persistOp.ownerId && saved && saved.id) {
          persistOp.createdOwnerId = saved.id;
          persistOp.ownerId = saved.id;
        }
        if (!assertPersistOpLive(persistOp)) {
          // Stale success for A after B opened — discard UI side effects entirely.
          return false;
        }
        basicsSaved = true;
        if (type === 'brand' && !ownerId) {
          try {
            const fresh = localStorage.getItem('mira-product-options:new');
            if (fresh && saved && saved.id) {
              localStorage.setItem('mira-product-options:' + saved.id, fresh);
              localStorage.removeItem('mira-product-options:new');
            }
            const svcFresh = localStorage.getItem('mira-service-template:new');
            if (svcFresh && saved && saved.id) {
              localStorage.setItem('mira-service-template:' + saved.id, svcFresh);
              localStorage.removeItem('mira-service-template:new');
            }
          } catch (error) {}
        }
        let newerEditsPending = hasNewerEditsThan(persistEpoch);
        item = Object.assign({}, item || {}, saved);
        if (saved && saved.reviewRevision != null && !newerEditsPending) {
          boundServiceReviewRevision = saved.reviewRevision;
          item.reviewRevision = saved.reviewRevision;
          boundProfileFingerprint = fingerprintProfileState(templateState);
        } else if (saved && saved.reviewRevision != null) {
          // Keep live template edits; still advance the revision tip we may put against next.
          boundServiceReviewRevision = saved.reviewRevision;
          item.reviewRevision = saved.reviewRevision;
        }
        staged[form.id].ownerId = item.id;
        const ctxAfter = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
        if (ctxAfter && item.id && assertPersistOpLive(persistOp)) {
          // Only bind owner on the SAME draft/generation that started this save.
          if (!persistOp.clientDraftId || ctxAfter.clientDraftId === persistOp.clientDraftId) {
            ctxAfter.targetOwnerId = item.id;
          }
        }

        function applyPersistSuccessChrome(pendingNewer, opts) {
          const finalize = opts && opts.finalize === true;
          if (!ownsPersistBusy(persistOp)) return;
          if (!assertPersistOpLive(persistOp) && !finalize) return;
          if (pendingNewer) save.classList.remove('is-success');
          else if (!finalize) save.classList.remove('is-success');
          else save.classList.add('is-success');
          if (!finalize) {
            // Keep busy ownership through refreshLists / uploads / auto-publish.
            save.disabled = true;
            save.setAttribute('aria-busy', 'true');
            save.classList.add('is-busy');
            save.textContent = pendingNewer
              ? developerAccount
                ? 'جارٍ الإكمال · تعديلات أحدث معلّقة'
                : 'جارٍ الإكمال · تعديلات أحدث معلّقة'
              : developerAccount
                ? 'جارٍ الرفع'
                : 'جارٍ إكمال الحفظ';
            return;
          }
          save.classList.remove('is-busy');
          save.disabled = false;
          save.removeAttribute('aria-busy');
          save.textContent = developerAccount
            ? pendingNewer
              ? 'نشر التعديلات المتبقية'
              : 'تم الحفظ'
            : pendingNewer
              ? 'حفظ التعديلات المتبقية'
              : 'تم الحفظ';
          if (ownsPersistBusy(persistOp)) {
            form.dataset.saving = '';
            delete form.dataset.persistToken;
            activePersistToken = null;
          }
        }
        applyPersistSuccessChrome(newerEditsPending, { finalize: false });
        let saveNote =
          'حُفظت المسودة. السعر المخزن ' + item.priceHalalas + ' هللة (' + formatPrice(item.priceHalalas) + ').';
        if (type !== 'brand' && templateState && templateState.templateId) {
          saveNote +=
            profileSaved && basicsSaved
              ? ' القالب والبيانات محفوظان.'
              : profileSaved
                ? ' القالب محفوظ على الخادم؛ فشل/لم يُؤكد حفظ البيانات الأساسية — أعيدي المحاولة لنفس العنصر (سيُعاد إرسال القالب بإصداره الحالي إن لزم).'
                : ' البيانات الأساسية محفوظة دون قالب.';
        }
        if (newerEditsPending) {
          saveNote +=
            ' توجد تعديلات أحدث في النموذج لم يشملها هذا الطلب — ليست محفوظة بعد. احفظي مرة أخرى للإصدار الحالي.';
          if (window.MiraEditorV2) {
            MiraEditorV2.setStatus(form, 'محفوظ جزئيًا · تعديلات أحدث غير محفوظة', 'dirty');
          }
          status.setAttribute('data-unsaved-newer', '1');
        }
        status.textContent = developerAccount
          ? newerEditsPending
            ? saveNote
            : 'جارٍ رفع الملفات ثم النشر في التطبيق.'
          : saveNote;
        status.setAttribute('data-catalog-persist-status', '1');
        if (window.MiraMotion) MiraMotion.announce(status.textContent);
        await refreshLists();
        if (!assertPersistOpLive(persistOp)) return false;
        // F2-D: user may edit during refreshLists — re-evaluate before claiming full success.
        newerEditsPending = hasNewerEditsThan(persistEpoch);
        if (newerEditsPending) {
          applyPersistSuccessChrome(true, { finalize: false });
          paintUnsavedNewerNotice(saveNote);
        }
        const pending = staged[form.id].slice();
        for (const entry of pending) {
          if (!assertPersistOpLive(persistOp)) return false;
          if (!entry.error && entry.file) await uploadOne(entry, { deferPublish: true });
          newerEditsPending = hasNewerEditsThan(persistEpoch);
        }
        if (!assertPersistOpLive(persistOp)) return false;
        newerEditsPending = hasNewerEditsThan(persistEpoch);
        if (newerEditsPending) {
          applyPersistSuccessChrome(true, { finalize: false });
          paintUnsavedNewerNotice(saveNote);
        }
        const failures = staged[form.id].filter((entry) => entry && entry.error).map((entry) => entry.file.name + ': ' + entry.error);
        let publishedNote = '';
        if (
          window.sessionPartner &&
          window.sessionPartner.type === 'developer' &&
          !failures.length &&
          item &&
          item.id &&
          !newerEditsPending
        ) {
          try {
            await PartnersApi.submitReview(type === 'brand' ? 'products' : 'services', item.id);
            if (!assertPersistOpLive(persistOp)) return false;
            newerEditsPending = hasNewerEditsThan(persistEpoch);
            if (newerEditsPending) {
              applyPersistSuccessChrome(true, { finalize: false });
              paintUnsavedNewerNotice(saveNote);
            } else {
              publishedNote = 'نُشر في التطبيق مباشرة، بلا مراجعة.';
              await refreshLists();
            }
          } catch (error) {
            publishedNote = 'حُفظت البيانات ولم تُنشر: ' + error.message;
          }
        }
        if (!assertPersistOpLive(persistOp)) return false;
        newerEditsPending = hasNewerEditsThan(persistEpoch);
        const noteOut = failures.length
          ? (developerAccount ? 'لم يُنشر. فشل الرفع. ' : 'حُفظت المسودة. لم يُسجَّل الرفع ناجحًا. ') + failures.join(' — ')
          : (publishedNote || (developerAccount && !newerEditsPending ? 'نُشر في التطبيق مباشرة، بلا مراجعة.' : saveNote));
        // F2: if the user typed newer edits mid-flight, keep the live DOM — do not re-render from the old response.
        if (newerEditsPending) {
          applyPersistSuccessChrome(true, { finalize: true });
          paintUnsavedNewerNotice(noteOut);
          lastSettledPersistEpoch = persistEpoch;
          return true;
        }
        lastSettledPersistEpoch = formContentEpoch;
        applyPersistSuccessChrome(false, { finalize: true });
        // Preserve materialized draft identity — re-render must not allocate a new clientDraftId.
        // values.serviceProfile must reflect the just-saved server profile, not a stale preserveCtx copy.
        const preserveCtx = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
        if (
          preserveCtx &&
          preserveCtx.clientDraftId &&
          item &&
          item.id &&
          (!persistOp.clientDraftId || preserveCtx.clientDraftId === persistOp.clientDraftId) &&
          assertPersistOpLive(persistOp)
        ) {
          const profileForCtx = {
            templateId: templateState.templateId || '',
            templateVersion: templateState.templateVersion || 1,
            priceMode: templateState.priceMode || 'fixed',
            answers: Object.assign({}, templateState.answers || {}),
          };
          const draftCtxPreserve = {
            clientDraftId: preserveCtx.clientDraftId,
            kind: preserveCtx.kind || kind,
            profileId: preserveCtx.profileId || null,
            schemaVersion: preserveCtx.schemaVersion,
            revision: preserveCtx.revision,
            targetOwnerId: item.id,
            status: preserveCtx.status || 'submit_failed',
            submitReviewStatus: preserveCtx.submitReviewStatus || null,
            serviceReviewRevision: boundServiceReviewRevision,
            values: Object.assign({}, {
              nameAr: item.nameAr,
              nameEn: item.nameEn,
              priceHalalas: item.priceHalalas,
              category: item.category,
              descriptionAr: item.descriptionAr,
              durationMin: item.durationMin,
              stockQty: item.stockQty,
              deliveryFeeHalalas: item.deliveryFeeHalalas,
              optionsJson: item.optionsJson,
              variantsJson: item.variantsJson,
              colors: item.colors,
              sizes: item.sizes,
            }, type !== 'brand' && profileForCtx.templateId
              ? { serviceProfile: profileForCtx }
              : {}),
          };
          renderForm(type, item, form.id, titleId, noteOut, draftCtxPreserve);
        } else if (assertPersistOpLive(persistOp)) {
          renderForm(type, item, form.id, titleId, noteOut);
        }
        return true;
      } catch (error) {
        if (!assertPersistOpLive(persistOp)) {
          // Do not paint A's error over B / clear B's busy.
          return false;
        }
        releasePersistBusyIfOwned(persistOp, idleLabel);
        save.classList.remove('is-success');
        let partialNote = '';
        if (profileSaved && !basicsSaved) {
          partialNote =
            'حُفظ قالب الخدمة على الخادم، لكن فشل حفظ البيانات الأساسية. أعيدي المحاولة من هذه الشاشة لنفس العنصر — لن يُنشأ عنصر جديد.';
          // Profile put advanced the revision — keep bound revision in sync with server tip we wrote.
          if (savedProfile && savedProfile.reviewRevision != null) {
            boundServiceReviewRevision = savedProfile.reviewRevision;
            boundProfileFingerprint = fingerprintProfileState(templateState);
          }
        } else if (!profileSaved && basicsSaved) {
          partialNote = 'حُفظت البيانات الأساسية، لكن القالب لم يُحفظ. أعيدي المحاولة للقالب.';
        } else if (profileSaved && basicsSaved) {
          partialNote = 'الحفظ اكتمل جزئيًا ثم فشل لاحقًا: ' + (error.message || error);
        } else {
          partialNote = 'تعذر الحفظ: ' + (error.message || error) + ' البيانات المكتوبة ما زالت في النموذج.';
        }
        status.textContent = partialNote;
        if (window.MiraMotion) MiraMotion.announce(status.textContent);
        return false;
      }
    };

    function showServiceProfileConflictUi(serviceOwnerId) {
      let panel = form.querySelector('[data-service-profile-conflict-panel]');
      if (panel) panel.remove();
      panel = document.createElement('div');
      panel.setAttribute('data-service-profile-conflict-panel', '1');
      panel.setAttribute('role', 'alert');
      panel.style.cssText = 'margin:0.75rem 0;padding:0.75rem;border:1px solid #b45309;background:#fffbeb;';
      const note = document.createElement('p');
      note.textContent =
        'نسخة أحدث من قالب الخدمة على الخادم. اختاري إعادة التحميل (تفقد التعديلات المحلية للقالب) أو الإبقاء.';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem;';
      const reloadBtn = document.createElement('button');
      reloadBtn.type = 'button';
      reloadBtn.setAttribute('data-service-conflict-reload', '1');
      reloadBtn.textContent = 'إعادة تحميل القالب من الخادم';
      const keepBtn = document.createElement('button');
      keepBtn.type = 'button';
      keepBtn.setAttribute('data-service-conflict-keep', '1');
      keepBtn.textContent = 'الإبقاء على تعديلاتي';
      row.append(reloadBtn, keepBtn);
      panel.append(note, row);
      form.insertBefore(panel, form.firstChild);
      const opOwner = serviceOwnerId;
      const opDraft =
        (window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id) || {}).clientDraftId || null;
      const opGen =
        (window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id) || {}).formGeneration || 0;
      reloadBtn.addEventListener('click', async () => {
        try {
          const live = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
          const liveOwner = resolveOwnerId();
          if (opOwner && liveOwner && liveOwner !== opOwner) {
            status.textContent = 'تُجاهل إعادة التحميل — تغيّر عنصر النموذج.';
            return;
          }
          if (opDraft && live && live.clientDraftId && live.clientDraftId !== opDraft) {
            status.textContent = 'تُجاهل إعادة التحميل — تغيّرت المسودة.';
            return;
          }
          if (opGen && live && live.formGeneration != null && live.formGeneration !== opGen) {
            status.textContent = 'تُجاهل إعادة التحميل — جيل النموذج تغيّر.';
            return;
          }
          const profile = await PartnersApi.getServiceProfile(opOwner);
          const live2 = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
          const liveOwner2 = resolveOwnerId();
          if (opOwner && liveOwner2 && liveOwner2 !== opOwner) {
            status.textContent = 'تُجاهل إعادة التحميل — تغيّر عنصر النموذج أثناء القراءة.';
            return;
          }
          if (opDraft && live2 && live2.clientDraftId && live2.clientDraftId !== opDraft) {
            status.textContent = 'تُجاهل إعادة التحميل — تغيّرت المسودة أثناء القراءة.';
            return;
          }
          applyBoundServiceProfile(profile, { mode: 'server' });
          if (typeof paintServiceTemplates === 'function') paintServiceTemplates();
          panel.remove();
          serviceProfileBindStatus = 'bound';
          status.textContent =
            'أُعيد تحميل قالب الخدمة من الخادم · إصدار ' + boundServiceReviewRevision + ' — عدّلي ثم احفظي.';
        } catch (e) {
          status.textContent = 'تعذر إعادة تحميل القالب: ' + (e && e.message ? e.message : e);
        }
      });
      keepBtn.addEventListener('click', () => {
        panel.remove();
        // Keeping local edits must NOT adopt the newer server revision — next save should 409 until reload or intentional merge.
        serviceProfileBindStatus = 'local-diverged';
        status.textContent =
          'أُبقيت تعديلات القالب محليًا — لن نرفع الإصدار ولن نكتب فوق الخادم صامتًا. الحفظ سيُرفض حتى تحلّي التعارض أو تعيدي التحميل.';
      });
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      return persistListing();
    };
  }
})();
