(function () {
  const PRODUCT_CATEGORIES = [
    ['face', 'الوجه'],
    ['body', 'الجسم'],
    ['hair', 'الشعر'],
    ['clothes', 'الملابس'],
    ['accessories', 'الإكسسوارات'],
    ['jewelry', 'المجوهرات'],
    ['children', 'الأطفال'],
    ['gifts', 'الهدايا'],
    ['occasions', 'مناسباتك'],
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
    ['skin', 'البشرة'],
    ['care', 'السبا'],
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
      if (item && item.id) card.setAttribute('data-id', String(item.id));
      if (item && item.nameAr) card.setAttribute('data-name-ar', String(item.nameAr));
      if (item && item.category) card.setAttribute('data-category-id', String(item.category));
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
    // Custom field errors (availability capacity/times, price, …) must run on submit.
    // Native HTML5 min/max on number/time inputs otherwise blocks submit silently
    // and never paints [data-testid="avail-field-error"] / persist status.
    form.setAttribute('novalidate', 'novalidate');
    form.noValidate = true;
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
      const stickyProfile =
        (draftCtx && draftCtx.profileId) || window.__MIRA_LANE_PROFILE_ID__ || null;
      MiraEditorV2.bindEditContext(form.id, {
        clientDraftId: newId,
        kind: kind,
        profileId: stickyProfile,
        revision: null,
        targetOwnerId: null,
        status: 'draft',
        values: (draftCtx && draftCtx.values) || {},
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
          ? 'مسودة: ' + (((draftCtx.values && draftCtx.values.nameAr) || seed.nameAr || seed.draftNameAr) || 'بدون اسم')
          : 'مسودة جديدة. لا يُطلب رابط متجر، والسعر يُكتب بالريال.'))));
    status.setAttribute('data-catalog-persist-status', '1');
    if (item && item.reviewNote) text(form, 'سبب المراجعة: ' + item.reviewNote);
    if (item && item.draftNameAr) text(form, 'اسم المسودة: ' + item.draftNameAr + ' · المنشور: ' + (item.nameAr || ''));
    if (draftCtx && draftCtx.submitReviewStatus) {
      text(form, 'حالة إرسال المراجعة للمسودة: ' + draftCtx.submitReviewStatus);
    }

    const basics = document.createElement('div');
    basics.className = 'form-section';
    basics.setAttribute('data-section-role', 'basics');
    text(basics, 'البيانات الأساسية', 'h3');
    form.appendChild(basics);
    const nameSeed = seed.draftNameAr || seed.nameAr || '';
    const namePriceRow = document.createElement('div');
    namePriceRow.className = 'e2b-name-price-row';
    namePriceRow.setAttribute('data-testid', 'e2b-name-price-row');
    basics.appendChild(namePriceRow);
    const nameAr = field(namePriceRow, 'الاسم', 'nameAr', nameSeed, 'text');
    const priceSeedEarly =
      seed.priceHalalas == null || seed.priceHalalas === ''
        ? ''
        : halalasToInput(seed.priceHalalas);
    const price = field(namePriceRow, 'السعر بالريال', 'priceSar', priceSeedEarly, 'text');
    price.inputMode = 'decimal';
    price.placeholder = '52';
    const descriptionAr = field(basics, 'الوصف', 'descriptionAr', seed.draftDescriptionAr != null ? seed.draftDescriptionAr : (seed.descriptionAr || ''), 'textarea');
    descriptionAr.setAttribute('data-testid', 'catalog-description');
    const nameEnDetails = document.createElement('details');
    nameEnDetails.className = 'e2b-extra-details';
    nameEnDetails.setAttribute('data-testid', 'catalog-extra-name-en');
    const nameEnSummary = document.createElement('summary');
    nameEnSummary.textContent = 'تفاصيل إضافية للاسم';
    nameEnDetails.appendChild(nameEnSummary);
    basics.appendChild(nameEnDetails);
    const nameEn = field(nameEnDetails, 'الاسم بالإنجليزية (اختياري)', 'nameEn', seed.draftNameEn != null ? seed.draftNameEn : (seed.nameEn || ''), 'text');
    const laneLabelAr =
      window.__MIRA_LANE_LABEL_AR__ ||
      (window.__MIRA_TAXONOMY_LANE__ === 'jewelry'
        ? 'المجوهرات'
        : window.__MIRA_TAXONOMY_LANE__ === 'children'
          ? 'الأطفال'
          : window.__MIRA_TAXONOMY_LANE__ === 'gifts'
            ? 'الهدايا'
            : window.__MIRA_TAXONOMY_LANE__ === 'occasions'
              ? 'مناسباتك'
              : 'أناقتك');
    let categories = type === 'brand'
      ? PRODUCT_CATEGORIES
      : (type === 'clinic' ? CLINIC_CATEGORIES : (type === 'salon' ? SALON_CATEGORIES : SERVICE_CATEGORIES));
    if (window.__MIRA_TAXONOMY_LANE__ === 'occasions' && type !== 'brand') {
      categories = [['occasions', 'مناسباتك']];
    } else if (
      type === 'brand' &&
      window.__MIRA_TAXONOMY_LANE__ &&
      window.__MIRA_TAXONOMY_LANE__ !== 'elegance'
    ) {
      const laneCat = window.__MIRA_TAXONOMY_LANE__;
      const only = PRODUCT_CATEGORIES.filter((row) => row[0] === laneCat || (laneCat === 'children' && row[0] === 'children'));
      if (only.length) categories = only;
    }
    const category = selectField(basics, 'التصنيف', 'category', seed.category || '', categories);
    const subcategorySeed =
      seed.draftTaxonomySet && Object.prototype.hasOwnProperty.call(seed, 'draftSubcategory')
        ? seed.draftSubcategory == null
          ? ''
          : seed.draftSubcategory
        : seed.subcategory != null
          ? seed.subcategory
          : '';
    const subcategory = selectField(
      basics,
      'التصنيف الفرعي (' + laneLabelAr + ')',
      'subcategory',
      subcategorySeed || '',
      [],
    );
    let taxonomyCache = null;
    let taxonomyLoadError = null;
    let taxonomyLoadGen = 0;
    function paintTaxonomyLoadError() {
      const wrap = subcategory.parentElement;
      if (!wrap) return;
      let err = wrap.querySelector('[data-testid="taxonomy-load-error"]');
      let retry = wrap.querySelector('[data-testid="taxonomy-load-retry"]');
      if (!taxonomyLoadError) {
        if (err) err.remove();
        if (retry) retry.remove();
        return;
      }
      if (!err) {
        err = document.createElement('p');
        err.className = 'lead';
        err.style.color = '#b00020';
        err.setAttribute('data-testid', 'taxonomy-load-error');
        wrap.appendChild(err);
      }
      if (!retry) {
        retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-ghost';
        retry.textContent = 'إعادة المحاولة';
        retry.setAttribute('data-testid', 'taxonomy-load-retry');
        retry.addEventListener('click', () => {
          refreshSubcategoryOptions({ forceReload: true, keepValue: subcategory.value });
        });
        wrap.appendChild(retry);
      }
      err.textContent = 'تعذر تحميل التصنيفات: ' + taxonomyLoadError;
    }
    async function loadStaticLaneTaxonomy(lane) {
      const map = {
        jewelry: 'assets/phase2-taxonomy/jewelry-taxonomy.v1.json',
        children: 'assets/phase2-taxonomy/children-taxonomy.v1.json',
        gifts: 'assets/phase2-taxonomy/gifts-taxonomy.v1.json',
        occasions: 'assets/phase2-taxonomy/occasions-taxonomy.v1.json',
      };
      const url = map[lane];
      if (!url) return null;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('تعذر تحميل تصنيفات ' + lane);
      return res.json();
    }
    function labeledFixture() {
      try {
        return new URLSearchParams(location.search).get('ui-fixture') === 'labeled';
      } catch (_) {
        return false;
      }
    }
    function requireServerTaxonomy() {
      try {
        return new URLSearchParams(location.search).get('taxonomy-source') === 'server';
      } catch (_) {
        return false;
      }
    }
    function setTaxonomySource(source, meta) {
      window.__MIRA_TAXONOMY_SOURCE__ = source;
      window.__MIRA_TAXONOMY_SOURCE_META__ = meta || null;
      try {
        document.body.dataset.taxonomySource = source || '';
      } catch (_) {
        /* optional */
      }
    }
    async function loadTaxonomyDoc(opts) {
      const force = opts && opts.force;
      const lane =
        (opts && opts.lane) ||
        window.__MIRA_TAXONOMY_LANE__ ||
        (draftCtx && draftCtx.values && draftCtx.values.taxonomyLane) ||
        'elegance';
      const audience = lane === 'elegance' ? undefined : 'partner';
      const cacheKey = lane + '|' + (audience || 'public');
      if (taxonomyCache && taxonomyCache.__miraCacheKey === cacheKey && !force) {
        if (taxonomyCache.__miraTaxonomySource) setTaxonomySource(taxonomyCache.__miraTaxonomySource);
        return taxonomyCache;
      }
      const mustServer = requireServerTaxonomy();
      // Labeled chrome smoke may use bundled JSON unless taxonomy-source=server.
      if (labeledFixture() && !mustServer && lane && lane !== 'elegance') {
        const local = await loadStaticLaneTaxonomy(lane);
        if (local && Array.isArray(local.nodes)) {
          taxonomyCache = Object.assign({}, local, {
            __miraCacheKey: cacheKey,
            __miraTaxonomySource: 'labeled-static',
          });
          taxonomyLoadError = null;
          setTaxonomySource('labeled-static', { lane: lane });
          paintTaxonomyLoadError();
          return taxonomyCache;
        }
      }
      try {
        if (!window.PartnersApi || typeof PartnersApi.taxonomy !== 'function') {
          throw new Error('عميل التصنيفات (PartnersApi.taxonomy) غير متاح');
        }
        const doc = await PartnersApi.taxonomy({ lane: lane, audience: audience });
        if (!doc || !Array.isArray(doc.nodes)) {
          throw new Error('استجابة تصنيفات غير صالحة');
        }
        taxonomyCache = Object.assign({}, doc, {
          __miraCacheKey: cacheKey,
          __miraTaxonomySource: 'server',
        });
        taxonomyLoadError = null;
        setTaxonomySource('server', { lane: lane });
        paintTaxonomyLoadError();
        return taxonomyCache;
      } catch (e) {
        if (mustServer) {
          taxonomyCache = null;
          taxonomyLoadError = (e && (e.messageAr || e.message)) || String(e);
          setTaxonomySource('server-failed', { message: taxonomyLoadError });
          paintTaxonomyLoadError();
          throw e;
        }
        // Offline / CORS: bundled lane taxonomy. Real-connection gate forbids this path.
        if (lane && lane !== 'elegance') {
          try {
            const local = await loadStaticLaneTaxonomy(lane);
            if (local && Array.isArray(local.nodes)) {
              taxonomyCache = Object.assign({}, local, {
                __miraCacheKey: cacheKey,
                __miraTaxonomySource: 'static-fallback',
              });
              taxonomyLoadError = null;
              setTaxonomySource('static-fallback', { lane: lane });
              paintTaxonomyLoadError();
              return taxonomyCache;
            }
          } catch (_) {
            /* fall through */
          }
        }
        taxonomyCache = null;
        taxonomyLoadError = (e && (e.messageAr || e.message)) || String(e);
        setTaxonomySource('server-failed', { message: taxonomyLoadError });
        throw e;
      }
    }
    async function refreshSubcategoryOptions(opts) {
      const keepValue = opts && Object.prototype.hasOwnProperty.call(opts, 'keepValue')
        ? opts.keepValue
        : subcategory.value;
      const cat = category.value;
      const wrap = subcategory.parentElement;
      const gen = ++taxonomyLoadGen;
      let doc = null;
      try {
        doc = await loadTaxonomyDoc({ force: !!(opts && opts.forceReload) });
      } catch (_) {
        if (gen !== taxonomyLoadGen) {
          // A newer load may have cleared the error; sync banner either way.
          paintTaxonomyLoadError();
          return;
        }
        paintTaxonomyLoadError();
        // Keep existing subcategory value; do not invent first/wedding_dress.
        if (wrap) {
          wrap.hidden =
            type !== 'brand' &&
            !(window.__MIRA_TAXONOMY_LANE__ === 'occasions' || cat === 'occasions');
        }
        return;
      }
      if (gen !== taxonomyLoadGen) {
        paintTaxonomyLoadError();
        return; // stale load — still clear/keep banner from winning load
      }
      paintTaxonomyLoadError();
      const list =
        window.MiraRegistryAttributeFields &&
        typeof MiraRegistryAttributeFields.subcategoriesFromTaxonomy === 'function'
          ? MiraRegistryAttributeFields.subcategoriesFromTaxonomy(doc, cat)
          : [];
      const occasionsTaxonomy =
        window.__MIRA_TAXONOMY_LANE__ === 'occasions' || cat === 'occasions';
      if (wrap) {
        wrap.hidden =
          (type !== 'brand' && !occasionsTaxonomy) ||
          (type === 'brand' && cat !== 'clothes' && !list.length && !keepValue && !occasionsTaxonomy);
      }
      subcategory.innerHTML = '';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'اختاري';
      subcategory.appendChild(empty);
      list.forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        subcategory.appendChild(opt);
      });
      if (keepValue) {
        if (list.some((o) => o.value === keepValue)) {
          subcategory.value = keepValue;
        } else {
          const orphan = document.createElement('option');
          orphan.value = keepValue;
          orphan.textContent = keepValue + ' (محفوظ)';
          subcategory.appendChild(orphan);
          subcategory.value = keepValue;
        }
      } else {
        subcategory.value = '';
      }
      // Circles may have painted before subcategory options existed — resync after restore.
      if (window.MiraE2BProductShell && typeof MiraE2BProductShell.syncFromForm === 'function') {
        try {
          MiraE2BProductShell.syncFromForm();
        } catch (_) {
          /* non-fatal */
        }
      }
    }
    refreshSubcategoryOptions({ keepValue: subcategorySeed || '' });
    nameAr.addEventListener('input', bumpFormContentEpoch);
    nameEn.addEventListener('input', bumpFormContentEpoch);
    descriptionAr.addEventListener('input', bumpFormContentEpoch);
    price.addEventListener('input', bumpFormContentEpoch);
    category.addEventListener('change', bumpFormContentEpoch);
    subcategory.addEventListener('change', bumpFormContentEpoch);

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
      // CONTRACT: durationMin مطلوب عند التحويل/الإنشاء (Service.durationMin غير قابل للفراغ في Prisma).
      // لا تُخترع قيمة افتراضية عند الفراغ — يُرفض التحويل حتى يُدخل العارض مدة صالحة.
      duration = field(basics, 'المدة بالدقائق', 'durationMin', seed.durationMin != null && seed.durationMin !== '' ? seed.durationMin : '', 'number');
      duration.min = '5';
      duration.required = true;
      duration.setAttribute('data-testid', 'e2c-duration-min');
      duration.addEventListener('input', bumpFormContentEpoch);
      const durationChips = document.createElement('div');
      durationChips.className = 'e2c-chip-row';
      durationChips.setAttribute('data-testid', 'e2c-duration-chips');
      [30, 60, 90].forEach((mins) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'e2c-chip';
        chip.setAttribute('data-testid', 'e2c-duration-chip');
        chip.setAttribute('data-mins', String(mins));
        chip.textContent = mins + ' دقيقة';
        if (String(duration.value) === String(mins)) chip.classList.add('is-selected');
        chip.addEventListener('click', () => {
          duration.value = String(mins);
          duration.dispatchEvent(new Event('input', { bubbles: true }));
          durationChips.querySelectorAll('.e2c-chip').forEach((c) => c.classList.remove('is-selected'));
          chip.classList.add('is-selected');
          bumpFormContentEpoch();
        });
        durationChips.appendChild(chip);
      });
      duration.parentElement.appendChild(durationChips);
      duration.addEventListener('input', () => {
        durationChips.querySelectorAll('.e2c-chip').forEach((c) => {
          c.classList.toggle('is-selected', c.getAttribute('data-mins') === String(duration.value));
        });
      });

      const partner = window.sessionPartner || {};
      const placeBox = document.createElement('div');
      placeBox.className = 'form-section e2c-place-box';
      placeBox.setAttribute('data-section-role', 'place');
      placeBox.setAttribute('data-testid', 'e2c-place-section');
      text(placeBox, 'مكان تقديم الخدمة', 'h3');
      const placeModeSeed =
        seed.placeMode ||
        (seed.draftPlaceMode != null ? seed.draftPlaceMode : '') ||
        '';
      const placeModeInput = document.createElement('input');
      placeModeInput.type = 'hidden';
      placeModeInput.name = 'placeMode';
      placeModeInput.value = placeModeSeed;
      placeModeInput.setAttribute('data-testid', 'e2c-place-mode');
      placeBox.appendChild(placeModeInput);

      const placeDetails = document.createElement('div');
      placeDetails.setAttribute('data-testid', 'e2c-place-details');
      placeBox.appendChild(placeDetails);

      const branchSeed = seed.branchId || '';
      const branchSelect = document.createElement('select');
      branchSelect.name = 'branchId';
      branchSelect.setAttribute('data-testid', 'e2c-branch-select');
      const branchEmpty = document.createElement('option');
      branchEmpty.value = '';
      branchEmpty.textContent = 'اختاري الفرع';
      branchSelect.appendChild(branchEmpty);
      const branches = Array.isArray(window.sessionBranches) ? window.sessionBranches : [];
      branches.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = (b.nameAr || b.id) + (b.cityNameAr ? ' · ' + b.cityNameAr : '');
        opt.dataset.city = b.cityNameAr || '';
        opt.dataset.lat = b.lat != null ? String(b.lat) : '';
        opt.dataset.lng = b.lng != null ? String(b.lng) : '';
        if (b.id === branchSeed) opt.selected = true;
        branchSelect.appendChild(opt);
      });
      branchSelect.addEventListener('change', () => {
        bumpFormContentEpoch();
        syncPlaceDetails();
      });

      const placeChips = document.createElement('div');
      placeChips.className = 'e2c-chip-row';
      placeChips.setAttribute('data-testid', 'e2c-place-mode-chips');
      [
        ['remote', 'عن بُعد'],
        ['home', 'منزلية'],
        ['branch', 'في الفرع'],
      ].forEach(([val, label]) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'e2c-chip';
        chip.setAttribute('data-testid', 'e2c-place-chip');
        chip.setAttribute('data-place-mode', val);
        chip.textContent = label;
        if (placeModeSeed === val) chip.classList.add('is-selected');
        chip.addEventListener('click', () => {
          placeModeInput.value = val;
          placeChips.querySelectorAll('.e2c-chip').forEach((c) => c.classList.remove('is-selected'));
          chip.classList.add('is-selected');
          // Non-branch modes explicitly clear branch — do not keep a stale select value.
          if (val !== 'branch') branchSelect.value = '';
          syncPlaceDetails();
          bumpFormContentEpoch();
        });
        placeChips.appendChild(chip);
      });
      placeBox.insertBefore(placeChips, placeDetails);

      const cityLine = document.createElement('p');
      cityLine.className = 'lead';
      cityLine.setAttribute('data-testid', 'e2c-place-city');
      const phoneLine = document.createElement('p');
      phoneLine.className = 'lead';
      phoneLine.setAttribute('data-testid', 'e2c-place-phone');
      phoneLine.textContent = partner.contactPhone
        ? 'وسيلة التواصل: ' + partner.contactPhone
        : 'لا توجد وسيلة تواصل مسجّلة على حساب الجهة.';
      const mapBox = document.createElement('div');
      mapBox.className = 'e2c-map-preview';
      mapBox.setAttribute('data-testid', 'e2c-map-preview');
      const placeGap = document.createElement('p');
      placeGap.className = 'muted';
      placeGap.setAttribute('data-testid', 'e2c-place-contract-gap');

      function syncPlaceDetails() {
        placeDetails.replaceChildren();
        const mode = placeModeInput.value;
        if (!mode) {
          placeGap.textContent =
            'اختاري مكان التقديم. عرض المدينة/الهاتف وحدهما لا يثبت اكتمال اختيار الموقع.';
          placeDetails.appendChild(placeGap);
          placeDetails.appendChild(phoneLine);
          return;
        }
        if (mode === 'remote') {
          branchSelect.value = '';
          branchSelect.hidden = true;
          placeDetails.appendChild(branchSelect);
          placeGap.textContent = 'خدمة عن بُعد — لا تُفترض إحداثيات أو فرع.';
          placeDetails.append(placeGap, phoneLine);
          return;
        }
        if (mode === 'home') {
          // Keep branchId control mounted (hidden) so form.querySelector still sees explicit clear.
          branchSelect.value = '';
          branchSelect.hidden = true;
          placeDetails.appendChild(branchSelect);
          cityLine.textContent = partner.city
            ? 'نطاق المدينة المسجّل على الحساب: ' + partner.city + ' (تغطية منزلية — يُحفظ عبر التغطية عند توفر العقد).'
            : 'المدينة غير مسجّلة — استكملي بيانات الجهة قبل اعتماد التغطية المنزلية.';
          placeDetails.append(cityLine, phoneLine);
          return;
        }
        // branch
        if (!branches.length) {
          placeGap.textContent =
            'لا فروع مسجّلة على الحساب (PartnerBranch). اختيار الفرع والإحداثيات غير مكتمل بالعقد الحالي — لا يُعلن نجاح موقع شكلي.';
          cityLine.textContent = partner.city ? 'مدينة الحساب: ' + partner.city : 'المدينة غير مسجّلة.';
          placeDetails.append(placeGap, cityLine, phoneLine);
          return;
        }
        branchSelect.hidden = false;
        const branchWrap = document.createElement('label');
        branchWrap.className = 'field';
        branchWrap.append(document.createTextNode('الفرع'), branchSelect);
        placeDetails.appendChild(branchWrap);
        const opt = branchSelect.selectedOptions[0];
        const cityName =
          (opt && (opt.dataset.city || opt.getAttribute('data-city'))) ||
          (opt && opt.value
            ? String(opt.textContent || '')
                .split('·')
                .pop()
                ?.trim()
            : '');
        cityLine.textContent = cityName
          ? 'المدينة: ' + cityName
          : 'اختاري فرعًا لإظهار المدينة.';
        placeDetails.appendChild(cityLine);
        const hasCoords = opt && opt.dataset.lat && opt.dataset.lng;
        mapBox.replaceChildren();
        mapBox.style.backgroundImage = '';
        if (hasCoords) {
          const lat = Number(opt.dataset.lat);
          const lng = Number(opt.dataset.lng);
          const delta = 0.01;
          const bbox =
            (lng - delta).toFixed(5) +
            '%2C' +
            (lat - delta).toFixed(5) +
            '%2C' +
            (lng + delta).toFixed(5) +
            '%2C' +
            (lat + delta).toFixed(5);
          // Real OSM embed bound to branch lat/lng — not a decorative gradient.
          const frame = document.createElement('iframe');
          frame.setAttribute('data-testid', 'e2c-map-embed');
          frame.setAttribute('title', 'خريطة الفرع');
          frame.loading = 'lazy';
          frame.referrerPolicy = 'no-referrer-when-downgrade';
          frame.src =
            'https://www.openstreetmap.org/export/embed.html?bbox=' +
            bbox +
            '&layer=mapnik&marker=' +
            lat.toFixed(5) +
            '%2C' +
            lng.toFixed(5);
          const label = document.createElement('p');
          label.className = 'e2c-map-label';
          label.setAttribute('data-testid', 'e2c-map-pin');
          label.textContent =
            'موقع الفرع · ' +
            (opt.textContent || '').trim() +
            ' · ' +
            lat.toFixed(4) +
            ', ' +
            lng.toFixed(4);
          mapBox.append(frame, label);
        } else {
          mapBox.textContent = 'لا إحداثيات على الفرع المختار — واجهة الموقع غير مكتملة.';
        }
        placeDetails.append(mapBox, phoneLine);
      }
      syncPlaceDetails();
      basics.appendChild(placeBox);
      const secondaryDetails = document.createElement('details');
      secondaryDetails.className = 'e2c-secondary-details';
      secondaryDetails.setAttribute('data-testid', 'e2c-secondary-details');
      secondaryDetails.setAttribute('data-section-role', 'secondary');
      const secondarySummary = document.createElement('summary');
      secondarySummary.textContent = 'تفاصيل إضافية (حجز ودفع)';
      secondaryDetails.appendChild(secondarySummary);
      const bookingWrap = document.createElement('label');
      bookingWrap.className = 'check-row';
      bookingToggle = document.createElement('input');
      bookingToggle.type = 'checkbox';
      bookingToggle.name = 'bookingEnabled';
      bookingToggle.checked = Boolean(editing && item.bookingEnabled);
      bookingToggle.addEventListener('change', bumpFormContentEpoch);
      bookingWrap.append(bookingToggle, document.createTextNode(' تفعيل طلب الموعد داخل ميرا (بانتظار قبول الجهة)'));
      secondaryDetails.appendChild(bookingWrap);
      text(secondaryDetails, 'الدفع لدى الجهة عند الموعد. لا تُطبَّق عبارة الدفع عند الاستلام الخاصة بالمنتجات على الخدمات.');
      basics.appendChild(secondaryDetails);
      const availBox = document.createElement('div');
      availBox.className = 'form-section e2c-avail-box';
      availBox.setAttribute('data-section-role', 'availability');
      availBox.setAttribute('data-timezone', 'Asia/Riyadh');
      availBox.setAttribute('data-testid', 'e2c-availability-section');
      text(availBox, 'التقويم والإتاحة', 'h3');
      text(availBox, 'المنطقة الزمنية: Asia/Riyadh (ثابتة — لا تُحوَّل حسب جهازك). غياب إعداد الإتاحة لا يعني أن الخدمة متاحة.');
      text(availBox, 'طلب الموعد داخل ميرا ليس حجزًا مؤكدًا. لا دفع ولا محفظة في هذه المرحلة.');
      const monthHost = document.createElement('div');
      monthHost.setAttribute('data-testid', 'e2c-month-calendar');
      monthHost.className = 'e2c-month-host';
      availBox.appendChild(monthHost);
      const timeChipsHost = document.createElement('div');
      timeChipsHost.className = 'e2c-time-chips';
      timeChipsHost.setAttribute('data-testid', 'e2c-time-chips');
      availBox.appendChild(timeChipsHost);
      const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      // Priority: saved service availabilityJson (freshest server) → draft weeklyHours/dateExceptions → empty.
      // Draft autosave writes weeklyHours/dateExceptions, not availabilityJson — must hydrate before materialize.
      const seededDoc = (function seedAvailabilityDoc() {
        function fromCanonical(raw) {
          if (!raw) return null;
          if (Array.isArray(raw)) return { windows: raw, closedDates: [], exceptions: [] };
          if (typeof raw !== 'object') return null;
          return {
            windows: Array.isArray(raw.windows) ? raw.windows.slice() : [],
            closedDates: Array.isArray(raw.closedDates) ? raw.closedDates.slice() : [],
            exceptions: Array.isArray(raw.exceptions)
              ? raw.exceptions.map(function (e) {
                  return Object.assign({}, e);
                })
              : [],
          };
        }
        function fromBulk(values) {
          if (!values || typeof values !== 'object') return null;
          const hours = Array.isArray(values.weeklyHours) ? values.weeklyHours : null;
          const rawEx = Array.isArray(values.dateExceptions) ? values.dateExceptions : null;
          const hoursExplicit = Object.prototype.hasOwnProperty.call(values, 'weeklyHours');
          const exExplicit = Object.prototype.hasOwnProperty.call(values, 'dateExceptions');
          if (!hoursExplicit && !exExplicit && !(hours && hours.length) && !(rawEx && rawEx.length)) {
            return null;
          }
          const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
          const toMin = function (t) {
            const s = String(t || '10:00');
            const parts = s.split(':').map(Number);
            if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
            return parts[0] * 60 + parts[1];
          };
          const windows = (hours || [])
            .map(function (raw) {
              if (!raw || typeof raw !== 'object') return null;
              const h = raw;
              const dayKey = String(h.day || h.weekday || '');
              const weekday =
                typeof h.weekday === 'number' && Number.isInteger(h.weekday)
                  ? h.weekday
                  : dayMap[dayKey] != null
                    ? dayMap[dayKey]
                    : null;
              const startMin = typeof h.startMin === 'number' ? h.startMin : toMin(h.open || h.start);
              const endMin = typeof h.endMin === 'number' ? h.endMin : toMin(h.close || h.end);
              if (weekday == null || startMin == null || endMin == null || endMin <= startMin) return null;
              return {
                weekday: weekday,
                startMin: startMin,
                endMin: endMin,
                capacity: typeof h.capacity === 'number' ? h.capacity : h.capacity != null ? Number(h.capacity) : 1,
                resourceId: typeof h.resourceId === 'string' ? h.resourceId : '',
              };
            })
            .filter(Boolean);
          const closedDates = [];
          const exceptions = [];
          (rawEx || []).forEach(function (x) {
            if (typeof x === 'string') {
              if (x.trim()) closedDates.push(x.trim());
              return;
            }
            if (!x || typeof x !== 'object') return;
            const date = String(x.date || '').trim();
            if (!date) return;
            const kind = String(x.kind || '').trim();
            if (kind === 'special') exceptions.push(Object.assign({}, x, { date: date, kind: 'special' }));
            else if (kind === 'closed' && x.resourceId) exceptions.push({ date: date, kind: 'closed', resourceId: String(x.resourceId) });
            else closedDates.push(date);
          });
          // Explicit empty arrays = clear (empty doc), not "absent".
          if (hoursExplicit && !(hours && hours.length) && exExplicit && !(rawEx && rawEx.length)) {
            return { windows: [], closedDates: [], exceptions: [] };
          }
          if (!windows.length && !closedDates.length && !exceptions.length) {
            return hoursExplicit || exExplicit ? { windows: [], closedDates: [], exceptions: [] } : null;
          }
          return { windows: windows, closedDates: closedDates, exceptions: exceptions };
        }
        const fromItem =
          editing && item && item.availabilityJson != null ? fromCanonical(item.availabilityJson) : null;
        if (fromItem && (fromItem.windows.length || fromItem.closedDates.length || fromItem.exceptions.length)) {
          return fromItem;
        }
        const fromDraft = fromBulk(seed);
        if (fromDraft) return fromDraft;
        if (fromItem) return fromItem;
        return { windows: [], closedDates: [], exceptions: [] };
      })();
      // Empty seed stays empty (unconfigured). Preserve ALL windows per weekday (not just first).
      function minsToTime(m) {
        return String(Math.floor(Number(m) / 60)).padStart(2, '0') + ':' + String(Number(m) % 60).padStart(2, '0');
      }
      function emptySegment() {
        return { start: '09:00', end: '17:00', capacity: '1', resourceId: '' };
      }
      function segmentFromWindow(w) {
        return {
          start: minsToTime(w.startMin),
          end: minsToTime(w.endMin),
          // Keep capacity as typed string; never coerce empty/invalid → 1 here.
          capacity: w.capacity == null ? '' : String(w.capacity),
          resourceId: w.resourceId ? String(w.resourceId) : '',
        };
      }
      const daySegments = dayNames.map((_, weekday) =>
        seededDoc.windows.filter((w) => Number(w.weekday) === weekday).map(segmentFromWindow),
      );
      const closedDates = seededDoc.closedDates.slice();
      const exceptions = seededDoc.exceptions.slice();
      const availSummary = document.createElement('p');
      availSummary.className = 'muted e2c-avail-summary';
      availSummary.setAttribute('data-testid', 'e2c-avail-summary');
      function refreshAvailSummary() {
        const winCount = daySegments.reduce((n, segs) => n + segs.length, 0);
        const daysWith = daySegments.filter((segs) => segs.length > 0).length;
        availSummary.textContent =
          winCount > 0
            ? 'ملخص الإتاحة: ' + daysWith + ' أيام · ' + winCount + ' فترات · Asia/Riyadh'
            : 'ملخص الإتاحة: بلا فترات أسبوعية بعد — التقويم أعلاه للاختيار؛ التحرير التفصيلي بالأسفل.';
      }
      availBox.appendChild(availSummary);
      const weeklyDetails = document.createElement('details');
      weeklyDetails.className = 'e2c-secondary-details e2c-avail-edit-details';
      weeklyDetails.setAttribute('data-testid', 'e2c-avail-edit-details');
      const weeklySummary = document.createElement('summary');
      weeklySummary.textContent = 'تحرير الأوقات والسعات والموارد';
      weeklyDetails.appendChild(weeklySummary);
      text(weeklyDetails, 'أيام العمل الأسبوعية — محرر تفصيلي؛ يمكن أكثر من فترة ونسخ يوم لآخر', 'h4');
      const weeklyBox = document.createElement('div');
      weeklyBox.setAttribute('data-testid', 'avail-weekly-windows');
      weeklyBox.className = 'e2c-weekly-compact';
      weeklyDetails.appendChild(weeklyBox);
      availBox.appendChild(weeklyDetails);
      refreshAvailSummary();
      function paintWeekly() {
        weeklyBox.replaceChildren();
        dayNames.forEach((name, weekday) => {
          const dayBlock = document.createElement('details');
          dayBlock.className = 'e2c-day-block';
          dayBlock.setAttribute('data-weekday', String(weekday));
          dayBlock.setAttribute('data-testid', 'avail-day-block');
          if (daySegments[weekday].length) dayBlock.open = true;
          const title = document.createElement('summary');
          title.className = 'check-row';
          title.textContent =
            name +
            (daySegments[weekday].length
              ? ' · ' + daySegments[weekday].length + ' فترة'
              : ' · بلا فترات');
          dayBlock.appendChild(title);
          daySegments[weekday].forEach((seg, segIdx) => {
            const row = document.createElement('div');
            row.className = 'check-row';
            row.setAttribute('data-testid', 'avail-window-row');
            row.setAttribute('data-weekday', String(weekday));
            row.setAttribute('data-seg', String(segIdx));
            const start = document.createElement('input');
            start.type = 'time';
            start.value = seg.start;
            start.onchange = () => {
              seg.start = start.value;
              bumpFormContentEpoch();
              paintAvailPreview();
              if (typeof paintMonthCalendar === 'function') paintMonthCalendar();
            };
            const end = document.createElement('input');
            end.type = 'time';
            end.value = seg.end;
            end.onchange = () => {
              seg.end = end.value;
              bumpFormContentEpoch();
              paintAvailPreview();
              if (typeof paintMonthCalendar === 'function') paintMonthCalendar();
            };
            const cap = document.createElement('input');
            cap.type = 'number';
            cap.min = '1';
            cap.max = '100';
            cap.placeholder = 'سعة';
            cap.value = seg.capacity;
            cap.style.width = '4rem';
            cap.oninput = () => {
              seg.capacity = cap.value;
              bumpFormContentEpoch();
            };
            cap.onchange = () => {
              seg.capacity = cap.value;
              bumpFormContentEpoch();
              paintAvailPreview();
            };
            const res = document.createElement('input');
            res.type = 'text';
            res.placeholder = 'معرّف المورد (اختياري)';
            res.value = seg.resourceId;
            res.onchange = () => {
              seg.resourceId = res.value.trim();
              bumpFormContentEpoch();
            };
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'btn btn-ghost btn-sm';
            rm.textContent = 'حذف الفترة';
            rm.setAttribute('data-testid', 'avail-window-remove');
            rm.onclick = () => {
              daySegments[weekday].splice(segIdx, 1);
              bumpFormContentEpoch();
              paintWeekly();
              refreshAvailSummary();
              paintAvailPreview();
            };
            row.append(
              start,
              document.createTextNode(' — '),
              end,
              document.createTextNode(' سعة '),
              cap,
              res,
              rm,
            );
            dayBlock.appendChild(row);
          });
          const addSeg = document.createElement('button');
          addSeg.type = 'button';
          addSeg.className = 'btn btn-ghost btn-sm';
          addSeg.textContent = 'إضافة فترة لـ' + name;
          addSeg.setAttribute('data-testid', 'avail-window-add');
          addSeg.onclick = () => {
            daySegments[weekday].push(emptySegment());
            bumpFormContentEpoch();
            paintWeekly();
            refreshAvailSummary();
            paintAvailPreview();
          };
          dayBlock.appendChild(addSeg);
          if (weekday > 0) {
            const copyPrev = document.createElement('button');
            copyPrev.type = 'button';
            copyPrev.className = 'btn btn-ghost btn-sm';
            copyPrev.textContent = 'نسخ فترات ' + dayNames[weekday - 1];
            copyPrev.setAttribute('data-testid', 'avail-window-copy-prev');
            copyPrev.onclick = () => {
              daySegments[weekday] = daySegments[weekday - 1].map((s) => ({
                start: s.start,
                end: s.end,
                capacity: s.capacity,
                resourceId: s.resourceId,
              }));
              bumpFormContentEpoch();
              paintWeekly();
              refreshAvailSummary();
              paintAvailPreview();
            };
            dayBlock.appendChild(copyPrev);
          }
          weeklyBox.appendChild(dayBlock);
        });
      }
      paintWeekly();
      refreshAvailSummary();

      text(availBox, 'أيام إغلاق واستثناءات بتاريخ محدد', 'h4');
      const closedWrap = document.createElement('div');
      closedWrap.setAttribute('data-testid', 'avail-closed-dates');
      const closedList = document.createElement('div');
      const closedInput = document.createElement('input');
      closedInput.type = 'date';
      closedInput.setAttribute('data-testid', 'avail-closed-date-input');
      const closedAdd = document.createElement('button');
      closedAdd.type = 'button';
      closedAdd.className = 'btn btn-ghost btn-sm';
      closedAdd.textContent = 'إضافة يوم إغلاق';
      function paintClosed() {
        closedList.replaceChildren();
        closedDates.forEach((d, idx) => {
          const row = document.createElement('div');
          row.className = 'check-row';
          row.setAttribute('data-testid', 'avail-closed-date-row');
          row.setAttribute('data-date', d);
          row.textContent = d + ' · مغلق';
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'btn btn-ghost btn-sm';
          rm.textContent = 'مسح';
          rm.onclick = () => {
            closedDates.splice(idx, 1);
            bumpFormContentEpoch();
            paintClosed();
            refreshCalendarUi();
          };
          row.appendChild(rm);
          closedList.appendChild(row);
        });
        if (!closedDates.length) text(closedList, 'لا أيام إغلاق محددة.', 'p');
      }
      closedAdd.onclick = () => {
        const v = closedInput.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
        if (closedDates.indexOf(v) < 0) closedDates.push(v);
        closedInput.value = '';
        bumpFormContentEpoch();
        paintClosed();
        refreshCalendarUi();
      };
      closedWrap.append(closedInput, closedAdd, closedList);
      availBox.appendChild(closedWrap);
      paintClosed();

      const exDetails = document.createElement('details');
      exDetails.className = 'e2c-secondary-details';
      exDetails.setAttribute('data-testid', 'e2c-exceptions-details');
      const exSummary = document.createElement('summary');
      exSummary.textContent = 'الاستثناءات وأيام الإغلاق المتقدمة';
      exDetails.appendChild(exSummary);
      const exWrap = document.createElement('div');
      exWrap.setAttribute('data-testid', 'avail-exceptions');
      const exList = document.createElement('div');
      const exDate = document.createElement('input');
      exDate.type = 'date';
      const exKind = document.createElement('select');
      exKind.innerHTML = '<option value="closed">إغلاق يوم</option><option value="special">فترة خاصة</option>';
      const exStart = document.createElement('input');
      exStart.type = 'time';
      exStart.value = '10:00';
      const exEnd = document.createElement('input');
      exEnd.type = 'time';
      exEnd.value = '14:00';
      const exCap = document.createElement('input');
      exCap.type = 'number';
      exCap.min = '1';
      exCap.max = '100';
      exCap.value = '1';
      exCap.style.width = '4rem';
      const exRes = document.createElement('input');
      exRes.type = 'text';
      exRes.placeholder = 'مورد (اختياري — إغلاق مورد لا يغلق اليوم)';
      exRes.setAttribute('data-testid', 'avail-exception-resource');
      const exAdd = document.createElement('button');
      exAdd.type = 'button';
      exAdd.className = 'btn btn-ghost btn-sm';
      exAdd.textContent = 'إضافة استثناء';
      function paintExceptions() {
        exList.replaceChildren();
        exceptions.forEach((e, idx) => {
          const row = document.createElement('div');
          row.className = 'check-row';
          row.setAttribute('data-testid', 'avail-exception-row');
          row.setAttribute('data-date', e.date);
          row.setAttribute('data-kind', e.kind);
          if (e.kind === 'special') {
            row.setAttribute('data-start-min', String(e.startMin));
            row.setAttribute('data-end-min', String(e.endMin));
            row.setAttribute('data-capacity', String(e.capacity));
          }
          if (e.resourceId) row.setAttribute('data-resource-id', String(e.resourceId));
          row.textContent =
            e.date +
            ' · ' +
            (e.kind === 'closed'
              ? e.resourceId
                ? 'إغلاق مورد ' + e.resourceId
                : 'إغلاق يوم'
              : 'خاصة ' +
                String(Math.floor((e.startMin || 0) / 60)).padStart(2, '0') +
                ':' +
                String((e.startMin || 0) % 60).padStart(2, '0') +
                '–' +
                String(Math.floor((e.endMin || 0) / 60)).padStart(2, '0') +
                ':' +
                String((e.endMin || 0) % 60).padStart(2, '0') +
                ' سعة ' +
                (e.capacity || 1));
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'btn btn-ghost btn-sm';
          rm.textContent = 'مسح';
          rm.onclick = () => {
            exceptions.splice(idx, 1);
            bumpFormContentEpoch();
            paintExceptions();
            refreshCalendarUi();
          };
          row.appendChild(rm);
          exList.appendChild(row);
        });
        if (!exceptions.length) text(exList, 'لا استثناءات.', 'p');
      }
      exAdd.onclick = () => {
        const d = exDate.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
        const resId = String(exRes.value || '').trim();
        if (exKind.value === 'closed') {
          exceptions.push(resId ? { date: d, kind: 'closed', resourceId: resId } : { date: d, kind: 'closed' });
        } else {
          const sm = exStart.value.split(':').map(Number);
          const em = exEnd.value.split(':').map(Number);
          const startMin = sm[0] * 60 + sm[1];
          const endMin = em[0] * 60 + em[1];
          const capacity = parseInt(exCap.value, 10);
          if (!(endMin > startMin) || !Number.isInteger(capacity) || capacity < 1) {
            throw new Error('فترة الاستثناء غير صالحة');
          }
          exceptions.push({
            date: d,
            kind: 'special',
            startMin: startMin,
            endMin: endMin,
            capacity: capacity,
            resourceId: resId,
          });
        }
        exDate.value = '';
        exRes.value = '';
        bumpFormContentEpoch();
        paintExceptions();
        refreshCalendarUi();
      };
      exWrap.append(
        exDate,
        exKind,
        document.createTextNode(' '),
        exStart,
        document.createTextNode(' — '),
        exEnd,
        document.createTextNode(' سعة '),
        exCap,
        exRes,
        exAdd,
        exList,
      );
      // Move closed-dates into the same advanced fold (keep controls; re-parent wrap).
      if (closedWrap.parentElement === availBox) availBox.removeChild(closedWrap);
      exDetails.appendChild(closedWrap);
      exDetails.appendChild(exWrap);
      availBox.appendChild(exDetails);
      paintExceptions();

      const previewWrap = document.createElement('div');
      previewWrap.className = 'e2c-avail-preview-wrap';
      const previewToggle = document.createElement('button');
      previewToggle.type = 'button';
      previewToggle.className = 'btn btn-ghost btn-sm';
      previewToggle.setAttribute('data-testid', 'avail-preview-toggle');
      previewToggle.textContent = 'إظهار معاينة 14 يومًا';
      const previewCal = document.createElement('div');
      previewCal.setAttribute('data-testid', 'avail-calendar-preview');
      previewCal.className = 'options-preview';
      previewCal.hidden = true;
      const previewHint = document.createElement('p');
      previewHint.className = 'muted';
      previewHint.textContent =
        'معاينة ساعات العمل المُعدّة (Asia/Riyadh) عند الطلب — ليست توافر حجز محسوبًا من الخادم.';
      previewWrap.append(previewToggle, previewHint, previewCal);
      weeklyDetails.appendChild(previewWrap);
      let previewVisible = false;
      previewToggle.onclick = () => {
        previewVisible = !previewVisible;
        previewCal.hidden = !previewVisible;
        previewToggle.textContent = previewVisible ? 'إخفاء المعاينة' : 'إظهار معاينة 14 يومًا';
        if (previewVisible) paintAvailPreview();
      };
      function riyadhParts(ms) {
        const local = new Date(ms + 180 * 60 * 1000);
        return {
          weekday: local.getUTCDay(),
          dateKey: local.toISOString().slice(0, 10),
        };
      }
      function buildWindowsSnapshot() {
        const windows = [];
        daySegments.forEach((segs, weekday) => {
          segs.forEach((day) => {
            const sm = String(day.start || '').split(':').map(Number);
            const em = String(day.end || '').split(':').map(Number);
            if (!Number.isFinite(sm[0]) || !Number.isFinite(em[0])) return;
            const capacity = parseInt(day.capacity, 10);
            windows.push({
              weekday: weekday,
              startMin: sm[0] * 60 + (sm[1] || 0),
              endMin: em[0] * 60 + (em[1] || 0),
              capacity: Number.isInteger(capacity) && capacity >= 1 ? capacity : null,
              resourceId: day.resourceId || '',
            });
          });
        });
        return windows;
      }
      function isWholeDayClosed(dateKey) {
        if (closedDates.indexOf(dateKey) >= 0) return true;
        // Resource-scoped closed (kind=closed + resourceId) does NOT close the whole day.
        return exceptions.some(
          (e) => e.date === dateKey && e.kind === 'closed' && !String(e.resourceId || '').trim(),
        );
      }
      function closedResourceIdsFor(dateKey) {
        return exceptions
          .filter((e) => e.date === dateKey && e.kind === 'closed' && String(e.resourceId || '').trim())
          .map((e) => String(e.resourceId).trim());
      }
      function dayStatus(dateKey, windows) {
        if (isWholeDayClosed(dateKey)) return 'مغلق/بدون جدول';
        const dayEx = exceptions.filter((e) => e.date === dateKey);
        const closedRes = closedResourceIdsFor(dateKey);
        // Server contract: closed resource wins over special for the same resourceId.
        const specials = dayEx.filter(
          (e) =>
            e.kind === 'special' &&
            (!e.resourceId || closedRes.indexOf(String(e.resourceId)) < 0),
        );
        let has = false;
        if (specials.length) has = true;
        else {
          const parts = riyadhParts(Date.parse(dateKey + 'T00:00:00.000Z') + (12 * 60 - 180) * 60 * 1000);
          has = windows.some(
            (w) =>
              w.weekday === parts.weekday &&
              (!w.resourceId || closedRes.indexOf(String(w.resourceId)) < 0),
          );
        }
        if (!has) {
          return windows.length === 0 && exceptions.length === 0 && closedDates.length === 0
            ? 'غير مهيأ'
            : 'مغلق/بدون جدول';
        }
        return closedRes.length ? 'يوم عمل مُعدّ (بعض الموارد مغلقة)' : 'يوم عمل مُعدّ';
      }
      function paintAvailPreview() {
        if (previewCal.hidden) return;
        previewCal.replaceChildren();
        const windows = buildWindowsSnapshot();
        const start = Date.now();
        for (let i = 0; i < 14; i++) {
          const parts = riyadhParts(start + i * 86400000);
          const st = dayStatus(parts.dateKey, windows);
          const cell = document.createElement('div');
          cell.className = 'check-row';
          cell.setAttribute('data-avail-status', st);
          cell.textContent = parts.dateKey + ' · ' + dayNames[parts.weekday] + ' · ' + st;
          previewCal.appendChild(cell);
        }
      }
      let monthCursor = new Date();
      let selectedMonthDay = null;
      function paintMonthCalendar() {
        monthHost.replaceChildren();
        const title = document.createElement('div');
        title.className = 'check-row';
        const y = monthCursor.getFullYear();
        const m = monthCursor.getMonth();
        title.textContent = 'تقويم الإتاحة · ' + (m + 1) + '/' + y;
        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'btn btn-ghost btn-sm';
        prev.textContent = '‹';
        prev.onclick = () => {
          monthCursor = new Date(y, m - 1, 1);
          paintMonthCalendar();
        };
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'btn btn-ghost btn-sm';
        next.textContent = '›';
        next.onclick = () => {
          monthCursor = new Date(y, m + 1, 1);
          paintMonthCalendar();
        };
        title.prepend(prev);
        title.appendChild(next);
        monthHost.appendChild(title);
        const grid = document.createElement('div');
        grid.className = 'e2c-month-grid';
        const first = new Date(y, m, 1);
        const startPad = first.getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const windows = buildWindowsSnapshot();
        for (let i = 0; i < startPad; i++) {
          grid.appendChild(document.createElement('div'));
        }
        for (let d = 1; d <= daysInMonth; d++) {
          const dateKey =
            y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          const st = dayStatus(dateKey, windows);
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'e2c-month-cell';
          cell.textContent = String(d);
          cell.setAttribute('data-date', dateKey);
          cell.setAttribute('data-testid', 'e2c-month-day');
          if (st.indexOf('مغلق') >= 0) cell.classList.add('is-closed');
          if (selectedMonthDay === dateKey) cell.classList.add('is-selected');
          cell.onclick = () => {
            selectedMonthDay = dateKey;
            paintMonthCalendar();
            paintDayTimeChips(dateKey);
          };
          grid.appendChild(cell);
        }
        monthHost.appendChild(grid);
      }
      function paintDayTimeChips(dateKey) {
        timeChipsHost.replaceChildren();
        // Whole-day closed only — resource-scoped closed must keep other resources' slots.
        if (isWholeDayClosed(dateKey)) {
          timeChipsHost.textContent = 'يوم مغلق — لا أوقات أسبوعية.';
          timeChipsHost.setAttribute('data-closed-day', '1');
          timeChipsHost.removeAttribute('data-resource-closed');
          return;
        }
        timeChipsHost.removeAttribute('data-closed-day');
        const closedRes = closedResourceIdsFor(dateKey);
        if (closedRes.length) timeChipsHost.setAttribute('data-resource-closed', closedRes.join(','));
        else timeChipsHost.removeAttribute('data-resource-closed');
        const windows = buildWindowsSnapshot();
        const parts = riyadhParts(Date.parse(dateKey + 'T12:00:00.000Z'));
        const dayWins = windows.filter(
          (w) =>
            Number(w.weekday) === parts.weekday &&
            (!w.resourceId || closedRes.indexOf(String(w.resourceId)) < 0),
        );
        // Align with server resolveDay: omit specials for resources already closed that day.
        const dayEx = exceptions.filter(
          (e) =>
            e.date === dateKey &&
            e.kind === 'special' &&
            (!e.resourceId || closedRes.indexOf(String(e.resourceId)) < 0),
        );
        const slots = dayEx.length
          ? dayEx.map((e) => ({
              startMin: e.startMin,
              endMin: e.endMin,
              resourceId: e.resourceId || '',
            }))
          : dayWins;
        if (!slots.length) {
          timeChipsHost.textContent = closedRes.length
            ? 'لا أوقات ظاهرة بعد إغلاق المورد المحدد.'
            : 'لا أوقات مُعدّة لهذا اليوم.';
          return;
        }
        slots.forEach((s) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'e2c-chip';
          chip.setAttribute('data-testid', 'e2c-time-chip');
          if (s.resourceId) chip.setAttribute('data-resource-id', String(s.resourceId));
          const sh = String(Math.floor(Number(s.startMin) / 60)).padStart(2, '0');
          const sm = String(Number(s.startMin) % 60).padStart(2, '0');
          chip.textContent = sh + ':' + sm + (s.resourceId ? ' · ' + s.resourceId : '');
          chip.onclick = () => {
            timeChipsHost.querySelectorAll('.e2c-chip').forEach((c) => c.classList.remove('is-selected'));
            chip.classList.add('is-selected');
          };
          timeChipsHost.appendChild(chip);
        });
      }
      function refreshCalendarUi() {
        if (typeof paintMonthCalendar === 'function') paintMonthCalendar();
        if (selectedMonthDay) paintDayTimeChips(selectedMonthDay);
        paintAvailPreview();
      }
      paintMonthCalendar();

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
      unifyPreview.textContent = 'عند التفعيل تُحدَّث سعة المورد في كل خدمات جهتك التي تشارك نفس معرّف المورد، ضمن حفظ واحد.';
      availBox.appendChild(unifyPreview);
      text(availBox, 'تعديل الإتاحة لا يلغي طلبات المواعيد القائمة تلقائيًا — تبقى سجلاتها وفق قواعد المشروع.');
      const availFieldErr = document.createElement('div');
      availFieldErr.className = 'field-error';
      availFieldErr.dataset.for = 'availabilityJson';
      availFieldErr.setAttribute('data-testid', 'avail-field-error');
      availBox.appendChild(availFieldErr);
      basics.appendChild(availBox);
      availabilityJson = {
        unifyToggle: unifyToggle,
        build: function () {
          const windows = [];
          daySegments.forEach((segs, weekday) => {
            segs.forEach((day, segIdx) => {
              const sm = String(day.start || '').split(':').map(Number);
              const em = String(day.end || '').split(':').map(Number);
              const startMin = sm[0] * 60 + (sm[1] || 0);
              const endMin = em[0] * 60 + (em[1] || 0);
              const capacityRaw = String(day.capacity == null ? '' : day.capacity).trim();
              if (!Number.isInteger(startMin) || !Number.isInteger(endMin) || endMin <= startMin) {
                throw new Error('وقت غير صالح لـ' + dayNames[weekday] + ' (فترة ' + (segIdx + 1) + ')');
              }
              if (capacityRaw === '' || !/^\d+$/.test(capacityRaw)) {
                throw new Error('السعة مطلوبة كعدد صحيح ≥ 1 لـ' + dayNames[weekday] + ' (فترة ' + (segIdx + 1) + ')');
              }
              const capacity = parseInt(capacityRaw, 10);
              if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
                throw new Error('السعة يجب أن تكون بين 1 و100 لـ' + dayNames[weekday] + ' (فترة ' + (segIdx + 1) + ')');
              }
              windows.push({
                weekday: weekday,
                startMin: startMin,
                endMin: endMin,
                capacity: capacity,
                resourceId: day.resourceId || '',
              });
            });
          });
          return {
            v: 2,
            timezone: 'Asia/Riyadh',
            windows: windows,
            closedDates: closedDates.slice(),
            exceptions: exceptions.map(function (e) { return Object.assign({}, e); }),
          };
        },
      };
    }

    const templateSection = document.createElement('details');
    templateSection.className = 'form-section e2c-secondary-details';
    templateSection.setAttribute('data-section-role', 'template');
    templateSection.setAttribute('data-testid', 'e2c-template-details');
    templateSection.hidden = type === 'brand';
    const templateSummary = document.createElement('summary');
    templateSummary.textContent = 'قالب الخدمة وخصائصها';
    templateSection.appendChild(templateSummary);
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
    const REGISTRY_COLOR_IDS = new Set([
      'black',
      'ivory',
      'champagne',
      'beige',
      'nude',
      'peach',
      'pink',
      'red',
      'burgundy',
      'brown',
      'purple',
      'blue',
      'navy',
      'teal',
      'green',
      'gray',
      'white',
      'gold',
      'silver',
      'multi',
    ]);

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
        if (subcategory && subcategory.value) values.subcategory = subcategory.value;
        if (attrMount && typeof attrMount.hasBlockingErrors === 'function' && attrMount.hasBlockingErrors()) {
          const v = attrMount.validate ? attrMount.validate() : { errors: [] };
          (v.errors || []).forEach((fe) => {
            fieldErrors.push({ fieldId: fe.fieldId, message: fe.message });
          });
          return { ok: false, fieldErrors: fieldErrors, values: values };
        }
        if (attrMount && typeof attrMount.getFlatValues === 'function') {
          // Draft values use flat registry field ids (material/cut/lengthCm/…).
          // Nested `attributes` is NOT a profile field — putEditorDraft validateValues
          // rejects it as REGISTRY_UNKNOWN_FIELD and the flush surfaces as save-failed.
          const flat = attrMount.getFlatValues();
          Object.keys(flat).forEach((k) => {
            values[k] = flat[k];
          });
        }
      }
      // Occasions service: collect registry attribute fields (occasionTypeIds / offer).
      if (
        type !== 'brand' &&
        attrMount &&
        typeof attrMount.getFlatValues === 'function' &&
        (window.__MIRA_TAXONOMY_LANE__ === 'occasions' ||
          (category && category.value === 'occasions') ||
          (draftCtx && draftCtx.profileId === 'service.occasions'))
      ) {
        if (typeof attrMount.hasBlockingErrors === 'function' && attrMount.hasBlockingErrors()) {
          const v = attrMount.validate ? attrMount.validate() : { errors: [] };
          (v.errors || []).forEach((fe) => {
            fieldErrors.push({ fieldId: fe.fieldId, message: fe.message });
          });
          return { ok: false, fieldErrors: fieldErrors, values: values };
        }
        const flatOcc = attrMount.getFlatValues();
        Object.keys(flatOcc).forEach((k) => {
          values[k] = flatOcc[k];
        });
      }
      if (type !== 'brand' && templateState && templateState.templateId) {
        values.serviceProfile = {
          templateId: templateState.templateId,
          templateVersion: templateState.templateVersion || 1,
          priceMode: templateState.priceMode || 'fixed',
          answers: templateState.answers || {},
        };
      }
      if (type !== 'brand') {
        const placeModeEl = form.querySelector('[name="placeMode"]');
        const branchEl = form.querySelector('[name="branchId"]');
        if (placeModeEl) {
          // Always bind placeMode when control present (including empty → clear semantics upstream).
          values.placeMode = String(placeModeEl.value || '').trim() || null;
        }
        // Non-branch modes must explicitly clear branchId even when the select is detached
        // from the DOM (syncPlaceDetails only mounts it under placeMode=branch).
        if (values.placeMode && values.placeMode !== 'branch') {
          values.branchId = null;
        } else if (branchEl) {
          // HTMLSelectElement.value lives on the prototype — never use hasOwnProperty(branchEl,'value').
          // Explicit empty clears branch; omit only when control absent AND mode is branch/unset.
          values.branchId = String(branchEl.value || '').trim() || null;
        }
      }
      // E2ج: التقويم عبر حقول السجل weeklyHours/dateExceptions (ليست availabilityJson الخام — ترفضها البوابة).
      if (type !== 'brand' && availabilityJson && typeof availabilityJson.build === 'function') {
        try {
          const doc = availabilityJson.build();
          const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          values.weeklyHours = (doc.windows || []).map((w) => ({
            day: dayKeys[Number(w.weekday)] || 'sun',
            weekday: Number(w.weekday),
            open:
              String(Math.floor(Number(w.startMin) / 60)).padStart(2, '0') +
              ':' +
              String(Number(w.startMin) % 60).padStart(2, '0'),
            close:
              String(Math.floor(Number(w.endMin) / 60)).padStart(2, '0') +
              ':' +
              String(Number(w.endMin) % 60).padStart(2, '0'),
            startMin: w.startMin,
            endMin: w.endMin,
            capacity: w.capacity,
            resourceId: w.resourceId || '',
          }));
          // Preserve closedDates AND dated exceptions (special/closed) — never drop doc.exceptions.
          const dateExceptions = [];
          (Array.isArray(doc.closedDates) ? doc.closedDates : []).forEach((d) => {
            if (d) dateExceptions.push(String(d));
          });
          (Array.isArray(doc.exceptions) ? doc.exceptions : []).forEach((e) => {
            if (!e || !e.date) return;
            dateExceptions.push(Object.assign({}, e));
          });
          values.dateExceptions = dateExceptions;
        } catch (availErr) {
          fieldErrors.push({
            fieldId: 'availabilityJson',
            message: (availErr && availErr.message) || 'إعداد الإتاحة غير صالح',
          });
        }
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
      const preferredProfile =
        (ctx && ctx.profileId) ||
        (draftCtx && draftCtx.profileId) ||
        window.__MIRA_LANE_PROFILE_ID__ ||
        null;
      const snapshotValues = built.values;
      MiraEditorV2.scheduleAutosave(form, () => {
        const again = buildEditorValues();
        if (!again.ok) {
          return null;
        }
        const values = again.values || snapshotValues || {};
        if (window.__MIRA_TAXONOMY_LANE__ && window.__MIRA_TAXONOMY_LANE__ !== 'elegance') {
          values.taxonomyLane = window.__MIRA_TAXONOMY_LANE__;
        }
        const nodeProfile =
          typeof profileIdForAttributes === 'function' ? profileIdForAttributes() : null;
        return {
          clientDraftId: clientDraftId,
          kind: kind,
          profileId:
            nodeProfile ||
            MiraEditorV2.profileIdFor(kind, category.value, partnerType, preferredProfile),
          targetOwnerId: resolveOwnerId(),
          values: values,
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
      if (reviewOk) {
        clearResumeState(clientDraftId);
        const matDone = form.querySelector('[data-editor-v2-materialize="1"]');
        if (matDone) matDone.dataset.resumeActive = '0';
        if (typeof form._miraApplyFinalCtaPolicy === 'function') form._miraApplyFinalCtaPolicy();
      } else if (submitFailed || (ownerId && !reviewOk)) {
        // Created without review (pending media) or submit failed — keep resume CTA.
        const matFail = form.querySelector('[data-editor-v2-materialize="1"]');
        if (matFail) matFail.dataset.resumeActive = '1';
        if (typeof form._miraApplyFinalCtaPolicy === 'function') form._miraApplyFinalCtaPolicy();
      }
      const submitReviewFlag = body.submitReview;
      const submitStatus = String(body.submitReviewStatus || (result && result.submitReviewStatus) || '');
      const createdPendingMedia =
        !!ownerId &&
        !reviewOk &&
        (submitFailed ||
          submitReviewFlag === false ||
          submitStatus === 'none' ||
          submitStatus === 'skipped' ||
          submitStatus === 'pending' ||
          submitStatus === 'failed');
      const hasMediaNow = formHasReviewableMedia(form);
      status.textContent = reviewOk
        ? 'تم التحويل والإرسال للمراجعة · ' + (body.targetKind || kind) + ' ' + (ownerId || '')
        : submitFailed && hasMediaNow
          ? 'تم إنشاء العنصر، وتعذر الإرسال للمراجعة — راجعي الأخطاء ثم أعيدي المحاولة. · ' + (ownerId || '')
          : createdPendingMedia && !hasMediaNow
            ? 'تم إنشاء العنصر — أضيفي وسائط ثم اضغطي «استئناف الإرسال للمراجعة». · ' + (ownerId || '')
            : createdPendingMedia && hasMediaNow && !submitFailed
              ? 'تم إنشاء العنصر — أكملي الإرسال للمراجعة. · ' + (ownerId || '')
            : submitFailed
              ? 'تم إنشاء العنصر، وتعذر الإرسال للمراجعة — ارفعي وسائط ثم أعيدي المحاولة. · ' + (ownerId || '')
              : 'نتيجة التحويل: ' + (fromError && fromError.message ? fromError.message : 'غير معروفة');
      return { ownerId: ownerId, reviewOk: reviewOk, submitFailed: submitFailed, stale: false };
    }

    function formHasReviewableMedia(targetForm) {
      if (!targetForm) return false;
      const savedCards = targetForm.querySelectorAll('[data-testid="media-card-saved"]').length;
      const stagedCards = targetForm.querySelectorAll('[data-testid="media-card-staged"]').length;
      const stagedState = staged[targetForm.id];
      const stagedBucket = Array.isArray(stagedState) ? stagedState.length : 0;
      return savedCards + stagedCards + stagedBucket > 0;
    }

    if (window.MiraEditorV2 && MiraEditorV2.state.enabled) {
      const matBtn = document.createElement('button');
      matBtn.type = 'button';
      matBtn.className = developerAccount ? 'btn btn-ghost' : 'btn btn-primary';
      matBtn.setAttribute('data-editor-v2-materialize', '1');
      matBtn.setAttribute('data-testid', 'materialize-draft');
      matBtn.textContent = developerAccount ? 'مراجعة الحفظ ثم النشر' : 'إرسال للمراجعة';
      // Developer primary path is «نشر الآن» on save — keep materialize secondary/hidden unless resume.
      // Use class+attr: `.btn { display:inline-flex }` overrides bare HTML hidden (I-01).
      if (developerAccount) {
        matBtn.hidden = true;
        matBtn.classList.add('hidden', 'is-cta-suppressed');
        matBtn.setAttribute('aria-hidden', 'true');
        matBtn.setAttribute('tabindex', '-1');
      }
      function resumeFinalLabel(mode) {
        // Developer publishes without human approval — never imply a review path.
        if (developerAccount) return mode === 'complete' ? 'استكمال النشر' : 'استئناف النشر';
        return 'استئناف الإرسال للمراجعة';
      }
      function revealMaterializeResume(label) {
        matBtn.dataset.resumeActive = '1';
        matBtn.textContent = label || resumeFinalLabel('resume');
        if (typeof form._miraApplyFinalCtaPolicy === 'function') form._miraApplyFinalCtaPolicy();
        else {
          matBtn.hidden = false;
          matBtn.classList.remove('hidden', 'is-cta-suppressed');
          matBtn.removeAttribute('aria-hidden');
          matBtn.removeAttribute('tabindex');
          matBtn.className = 'btn btn-primary';
        }
      }
      // Restore resume banner if page reloaded mid-flight OR server draft already materialized/failed.
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
          revealMaterializeResume(resumeFinalLabel('resume'));
          status.textContent = 'العنصر موجود (' + resume.targetOwnerId + ') — أكمل الوسائط ثم استأنفي الإرسال.';
          return;
        }
        // Opening a server draft that already materialized (e.g. from مسودات المحرر) must show resume
        // without requiring injected sessionStorage.
        if (
          ctx0 &&
          ctx0.targetOwnerId &&
          (ctx0.status === 'materialized' ||
            ctx0.status === 'submit_failed' ||
            ctx0.submitReviewStatus === 'failed')
        ) {
          item = Object.assign({}, item || {}, { id: ctx0.targetOwnerId });
          const failed =
            ctx0.submitReviewStatus === 'failed' || ctx0.status === 'submit_failed';
          revealMaterializeResume(resumeFinalLabel(failed ? 'resume' : 'complete'));
          status.textContent =
            'العنصر موجود (' +
            ctx0.targetOwnerId +
            ') — ' +
            (failed
              ? developerAccount
                ? 'أكمل الوسائط ثم استأنفي النشر.'
                : 'أكمل الوسائط ثم استأنفي الإرسال.'
              : developerAccount
                ? 'جاهز لاستكمال النشر.'
                : 'جاهز لإعادة الإرسال للمراجعة.');
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
                  matBtn.textContent = resumeFinalLabel('resume');
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
                  matBtn.textContent = resumeFinalLabel('resume');
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
                matBtn.textContent = resumeFinalLabel('resume');
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
            let prior = null;
            try {
              prior = await PartnersApi.getEditorDraft(clientDraftId);
            } catch (miss) {
              prior = null;
              void miss;
            }
            // Opening from catalog list uses owner:kind:id — resolve the real materialized draft by owner.
            if (!(prior && prior.status === 'materialized' && prior.targetOwnerId) && item && item.id) {
              try {
                const listed = await PartnersApi.listEditorDrafts();
                const rows = (listed && listed.items) || listed || [];
                const match = (Array.isArray(rows) ? rows : []).find(
                  (d) =>
                    d &&
                    d.targetOwnerId === item.id &&
                    (d.status === 'materialized' || d.status === 'submit_failed'),
                );
                if (match) {
                  prior = match;
                  const bound = MiraEditorV2.getEditContext(form.id);
                  if (bound) {
                    bound.clientDraftId = match.clientDraftId;
                    bound.targetOwnerId = match.targetOwnerId;
                    bound.status = match.status || 'materialized';
                    bound.submitReviewStatus = match.submitReviewStatus || 'failed';
                    bound.revision = match.revision;
                  }
                  clientDraftId = match.clientDraftId;
                  matOp = captureMaterializeOp(clientDraftId);
                }
              } catch (listErr) {
                void listErr;
              }
            }
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
              matBtn.textContent = resumeFinalLabel('resume');
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
                matBtn.textContent = resumeFinalLabel('resume');
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
                matBtn.textContent = resumeFinalLabel('resume');
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
            // Do not auto-submit review without media — avoids false «تعذر الإرسال» on create-only.
            const shouldSubmitReview = formHasReviewableMedia(form);
            const result = await MiraEditorV2.materialize(
              clientDraftId,
              expectedRevision,
              shouldSubmitReview,
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
              matBtn.textContent = resumeFinalLabel('resume');
            }
          } catch (error) {
            if (!assertMatLive('materialize-catch')) {
              applyMaterializeOutcome(clientDraftId, null, error, matOp);
              return;
            }
            if (error && error.code === 'MATERIALIZE_SUBMIT_REVIEW_FAILED') {
              const matOut = applyMaterializeOutcome(clientDraftId, null, error, matOp);
              if (matOut && matOut.stale) return;
              matBtn.textContent = resumeFinalLabel('resume');
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
                  matBtn.textContent = resumeFinalLabel('resume');
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
    mediaSection.setAttribute('data-section-role', 'main-media');
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
    videos.classList.add('e2b-file-input-native');
    images.classList.add('e2b-file-input-native');
    const imageLabel = document.createElement('label');
    imageLabel.htmlFor = images.id;
    imageLabel.className = 'e2b-media-pick-btn';
    imageLabel.textContent = 'إضافة صور للعرض الرئيسي';
    const videoCard = document.createElement('div');
    videoCard.className = 'e2b-video-card';
    videoCard.setAttribute('data-testid', 'e2b-video-card');
    const videoTitle = document.createElement('h4');
    videoTitle.className = 'e2b-video-card-title';
    videoTitle.textContent = 'الفيديو الرئيسي';
    const videoStatus = document.createElement('p');
    videoStatus.className = 'e2b-video-card-status';
    videoStatus.setAttribute('data-testid', 'e2b-video-card-status');
    videoStatus.setAttribute('role', 'status');
    videoStatus.textContent = 'لم يُختر مقطع بعد — هذا ليس خطأ.';
    const videoPick = document.createElement('label');
    videoPick.htmlFor = videos.id;
    videoPick.className = 'e2b-media-pick-btn e2b-video-pick';
    videoPick.setAttribute('data-testid', 'e2b-video-pick');
    videoPick.textContent = 'اختيار المقطع';
    const mainPreview = document.createElement('p');
    mainPreview.className = 'e2b-media-hint';
    mainPreview.textContent = 'معاينة الموضع: تملأ شاشة اكتشفي من الحافة إلى الحافة.';
    const mediaBox = document.createElement('div');
    mediaBox.className = 'media-box e2b-video-stage';
    mediaBox.setAttribute('data-testid', 'catalog-media-stage');
    videoCard.append(videoTitle, mediaBox, videoPick, videos, videoStatus);
    mediaSection.classList.add('e2b-media-stage');
    mediaSection.setAttribute('data-testid', 'catalog-main-media-section');
    mediaSection.append(videoCard, imageLabel, images, mainPreview);
    /**
     * Normalize staged media → video card chrome. Prefer explicit phase over raw Arabic status
     * or mere presence of uploadSessionId (session id alone ≠ currently uploading).
     */
    function normalizeVideoPhase(entry) {
      if (!entry) return 'empty';
      if (entry.error || entry.phase === 'failed' || /فشل|خطأ|تعذر/.test(String(entry.status || ''))) return 'failed';
      if (entry.aborted || entry.phase === 'cancelled' || /أُلغي|الغي|cancel/i.test(String(entry.status || '')))
        return 'cancelled';
      if (entry.phase === 'ready' || entry.catalogMediaId || /جاهز|مكتمل|ready/i.test(String(entry.status || '')))
        return 'ready';
      if (entry.phase === 'processing' || /تحقق|معالجة|processing|verif/i.test(String(entry.status || '')))
        return 'processing';
      if (entry.phase === 'uploading' || entry._uploadBusy || /رفع|قراءة|تحضير/.test(String(entry.status || '')))
        return 'uploading';
      if (entry.phase === 'awaiting-save' || /انتظار|حفظ|البيانات/.test(String(entry.status || '')))
        return 'awaiting-save';
      if (entry.file) return 'selected';
      return 'empty';
    }
    /** Cached saved main video — detail media updates must not wipe this by passing null. */
    let lastKnownSavedMainVideo = null;
    function progressPercentLabel(ratio) {
      // Upload callbacks use 0..1; display as 0% / 50% / 100%.
      if (ratio == null || typeof ratio !== 'number' || !Number.isFinite(ratio)) return '';
      const pct = Math.max(0, Math.min(100, Math.round(ratio <= 1 ? ratio * 100 : ratio)));
      return ' · ' + pct + '%';
    }
    function isMainVideoEntry(entry) {
      return !!(entry && entry.placement !== 'detail' && entry.file && isPhoneVideo(entry.file));
    }
    /**
     * @param {Array|null|undefined} serverMedia full media list when known
     * @param {{ mainRemoved?: boolean }} [opts] mainRemoved=true only when main was explicitly deleted
     */
    function syncVideoCardChrome(serverMedia, opts) {
      opts = opts || {};
      if (Array.isArray(serverMedia)) {
        const found = serverMedia.find(
          (m) => m && m.kind === 'video' && m.placement !== 'detail' && !m.pendingRemoval,
        );
        if (found) lastKnownSavedMainVideo = found;
        else if (opts.mainRemoved === true) lastKnownSavedMainVideo = null;
        else lastKnownSavedMainVideo = null; // full list without main = absent on server
      } else if (opts.mainRemoved === true) {
        lastKnownSavedMainVideo = null;
      }
      // null serverMedia without mainRemoved = "no new main data" → keep cache.
      const rows = staged[form.id] || [];
      // Prefer an in-flight/ready main over an older failed row so retry+replace paints live progress.
      const stagedMain =
        rows.find((e) => isMainVideoEntry(e) && normalizeVideoPhase(e) !== 'failed' && normalizeVideoPhase(e) !== 'cancelled') ||
        rows.find((e) => isMainVideoEntry(e));
      const savedMain =
        (Array.isArray(serverMedia) &&
          serverMedia.find((m) => m && m.kind === 'video' && m.placement !== 'detail' && !m.pendingRemoval)) ||
        (!opts.mainRemoved ? lastKnownSavedMainVideo : null);
      const filePick = videos.files && videos.files[0];
      const nameOf = (e) => (e && e.file && e.file.name) || '';
      if (stagedMain) {
        const phase = normalizeVideoPhase(stagedMain);
        videoStatus.dataset.state = phase;
        videoStatus.dataset.phase = phase;
        if (phase === 'failed') {
          videoStatus.textContent =
            'فشل الرفع: ' +
            (stagedMain.error || stagedMain.status || 'خطأ') +
            ' — بيانات الحقول محفوظة.';
          videoPick.textContent = 'إعادة المحاولة';
          videoPick.dataset.action = 'retry';
          return;
        }
        if (phase === 'cancelled') {
          videoStatus.textContent = 'أُلغي الرفع' + (nameOf(stagedMain) ? ': ' + nameOf(stagedMain) : '') + '.';
          videoPick.textContent = 'اختيار المقطع';
          videoPick.dataset.action = 'pick';
          return;
        }
        if (phase === 'processing') {
          videoStatus.textContent =
            'جارٍ التحقق/المعالجة' + (nameOf(stagedMain) ? ': ' + nameOf(stagedMain) : '');
          videoPick.textContent = 'استبدال المقطع';
          videoPick.dataset.action = 'replace';
          return;
        }
        if (phase === 'uploading') {
          videoStatus.textContent =
            'جارٍ الرفع' + (nameOf(stagedMain) ? ': ' + nameOf(stagedMain) : '') + progressPercentLabel(stagedMain.percent);
          videoPick.textContent = 'استبدال المقطع';
          videoPick.dataset.action = 'replace';
          return;
        }
        if (phase === 'awaiting-save') {
          videoStatus.textContent =
            'بانتظار الحفظ قبل الرفع' + (nameOf(stagedMain) ? ': ' + nameOf(stagedMain) : '');
          videoPick.textContent = 'استبدال المقطع';
          videoPick.dataset.action = 'replace';
          return;
        }
        if (phase === 'ready') {
          videoStatus.textContent = 'المقطع جاهز في المسودة' + (nameOf(stagedMain) ? ': ' + nameOf(stagedMain) : '');
          videoPick.textContent = 'استبدال المقطع';
          videoPick.dataset.action = 'replace';
          return;
        }
        videoStatus.textContent =
          'تم اختيار المقطع' + (nameOf(stagedMain) ? ': ' + nameOf(stagedMain) : '') + ' — بانتظار الرفع بعد الحفظ.';
        videoPick.textContent = 'استبدال المقطع';
        videoPick.dataset.action = 'replace';
        return;
      }
      if (filePick) {
        videoStatus.dataset.state = 'selected';
        videoStatus.dataset.phase = 'selected';
        videoStatus.textContent = 'تم اختيار المقطع: ' + filePick.name + ' — بانتظار الرفع بعد الحفظ.';
        videoPick.textContent = 'استبدال المقطع';
        videoPick.dataset.action = 'replace';
        return;
      }
      if (savedMain) {
        videoStatus.dataset.state = 'saved';
        videoStatus.dataset.phase = 'saved';
        videoStatus.textContent =
          'فيديو محفوظ على العنصر' +
          (savedMain.publication ? ' · ' + savedMain.publication : '') +
          ' — يمكن استبداله.';
        videoPick.textContent = 'استبدال المقطع';
        videoPick.dataset.action = 'replace';
        return;
      }
      videoStatus.dataset.state = 'empty';
      videoStatus.dataset.phase = 'empty';
      videoStatus.textContent = 'لم يُختر مقطع بعد — هذا ليس خطأ.';
      videoPick.textContent = 'اختيار المقطع';
      videoPick.dataset.action = 'pick';
    }
    videos.addEventListener('change', () => {
      syncVideoCardChrome(undefined);
    });
    // Harness-only: drive chrome/progress through the same sync path (no DOM text injection).
    if ((window).__MIRA_E2A_HARNESS__) {
      form.__miraVideoChrome = {
        progressPercentLabel: progressPercentLabel,
        sync: (serverMedia, opts) => syncVideoCardChrome(serverMedia, opts),
        applyMainProgressRatio: (ratio) => {
          const rows = staged[form.id] || (staged[form.id] = []);
          let entry = rows.find((e) => isMainVideoEntry(e));
          if (!entry) {
            entry = {
              key: 'harness-main-video',
              placement: 'main',
              file: { name: 'harness-main.mp4', type: 'video/mp4', size: 1 },
              status: 'جارٍ الرفع',
              percent: ratio,
              phase: 'uploading',
              _uploadBusy: true,
            };
            rows.push(entry);
          } else {
            entry.status = 'جارٍ الرفع';
            entry.percent = ratio;
            entry.phase = 'uploading';
            entry._uploadBusy = true;
            entry.error = '';
          }
          syncMedia(entry);
          return {
            text: videoStatus.textContent || '',
            state: videoStatus.dataset.state || '',
            percent: entry.percent,
          };
        },
        simulateDetailSync: () => {
          const rows = staged[form.id] || (staged[form.id] = []);
          const detail = {
            key: 'harness-detail-' + Date.now(),
            placement: 'detail',
            file: { name: 'detail.png', type: 'image/png', size: 1 },
            status: 'جارٍ الرفع',
            percent: 0.5,
            phase: 'uploading',
            _uploadBusy: true,
          };
          rows.push(detail);
          syncMedia(detail);
          return {
            text: videoStatus.textContent || '',
            state: videoStatus.dataset.state || '',
          };
        },
        read: () => ({
          text: videoStatus.textContent || '',
          state: videoStatus.dataset.state || '',
          phase: videoStatus.dataset.phase || '',
        }),
      };
    }
    videoPick.addEventListener('click', (ev) => {
      if (videoPick.dataset.action !== 'retry') return;
      ev.preventDefault();
      const rows = staged[form.id] || [];
      const failed = rows.find(
        (e) => e && e.placement !== 'detail' && e.file && isPhoneVideo(e.file) && normalizeVideoPhase(e) === 'failed',
      );
      if (!failed) {
        videos.click();
        return;
      }
      // Resume the same upload session (and any durable completed parts). Do not mint a
      // replacement session for a transient transport error — file_mismatch / explicit
      // abort paths clear uploadSessionId elsewhere with a proven reason.
      failed.error = '';
      failed.phase = null;
      failed.status = 'بانتظار الحفظ';
      void uploadOne(failed);
    });
    const detailMediaSection = document.createElement('div');
    detailMediaSection.className = 'form-section';
    detailMediaSection.setAttribute('data-section-role', 'detail-media');
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
    const variantMediaSection = document.createElement('div');
    variantMediaSection.className = 'form-section';
    variantMediaSection.setAttribute('data-section-role', 'variant-media');
    variantMediaSection.hidden = type !== 'brand';
    text(variantMediaSection, 'وسائط التركيبات', 'h3');
    text(variantMediaSection, 'اربط وسائط جاهزة بتركيبة معتمدة. الوسائط غير الجاهزة أو التابعة لمنتج آخر مرفوضة.');
    const variantMediaBox = document.createElement('div');
    variantMediaSection.appendChild(variantMediaBox);
    form.append(mediaSection, detailMediaSection, variantMediaSection);
    form.insertBefore(templateSection, mediaSection);

    const detail = document.createElement('div');
    detail.className = 'form-section';
    detail.setAttribute('data-section-role', 'details');
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
    action.setAttribute('data-section-role', 'commerce');
    text(action, 'الشراء والإعدادات المتقدمة', 'h3');
    const commerceDetails = document.createElement('details');
    commerceDetails.className = 'e2b-extra-details';
    commerceDetails.setAttribute('data-testid', 'e2b-commerce-details');
    const commerceSummary = document.createElement('summary');
    commerceSummary.textContent = 'وضع الشراء ورسوم التوصيل (اختياري)';
    commerceDetails.appendChild(commerceSummary);
    action.appendChild(commerceDetails);
    form.appendChild(action);
    // Subsequent commerce fields append into the collapsible host (values preserved when collapsed).
    const commerceHost = commerceDetails;
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
      commerceHost.appendChild(choices);
      url = field(commerceHost, 'رابط الشراء (فقط عند اختيار الرابط)', 'externalUrl', editing && item.externalUrl ? item.externalUrl : '', 'url');
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
      text(commerceHost, 'الشراء داخل ميرا (الدفع عند الاستلام)', 'h4');
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
      commerceHost.appendChild(internal);
      // Quantity belongs with core offer (colors/sizes/materials); created here then relocated to qtyHost.
      stockInput = field(
        action,
        'الكمية (اختياري)',
        'stockQty',
        seed.stockQty != null ? seed.stockQty : (editing && item.stockQty != null ? item.stockQty : ''),
        'number',
      );
      stockInput.setAttribute('data-testid', 'catalog-quantity');
      stockInput.placeholder = 'اختياري';
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
        commerceHost,
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
      // Advanced JSON tools: developer-only. Brand/salon accounts stay on the simplified fields.
      if (developerAccount) {
        const advancedWrap = document.createElement('label');
        advancedWrap.className = 'check-row';
        advancedWrap.setAttribute('data-testid', 'developer-advanced-json');
        const advancedToggle = document.createElement('input');
        advancedToggle.type = 'checkbox';
        advancedToggle.name = 'optionsAdvancedJson';
        advancedWrap.append(
          advancedToggle,
          document.createTextNode(' تعديل متقدم بصيغة JSON (يستبدل النموذج المبسّط عند التفعيل)'),
        );
        commerceHost.appendChild(advancedWrap);
        optionsJsonInput = field(commerceHost, 'خيارات المنتج JSON (متقدم)', 'optionsJson', '', 'textarea');
        optionsJsonInput.placeholder =
          '[{"id":"size","labelAr":"المقاس","kind":"size","values":[{"id":"m","labelAr":"M"}]}]';
        variantsJsonInput = field(commerceHost, 'التركيبات JSON (متقدم)', 'variantsJson', '', 'textarea');
        variantsJsonInput.placeholder =
          '[{"id":"m-black","selections":{"size":"m"},"priceHalalas":5200,"available":true}]';
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
      }
      text(commerceHost, 'المخزون ورسوم التوصيل ووضع الشراء يسري مباشرة؛ الألوان والمقاسات من الخيارات الأساسية؛ التركيبات للمنشور تمر بمسودة مراجعة.');
    }

    const preview = document.createElement('div');
    preview.className = 'form-section';
    preview.setAttribute('data-testid', 'catalog-preview-panel');
    preview.setAttribute('data-section-role', 'preview-publish');
    text(preview, 'المعاينة والنشر', 'h3');
    const previewBody = text(preview, '');
    previewBody.setAttribute('data-testid', 'catalog-preview-body');
    form.appendChild(preview);

    const actionsBar = document.createElement('div');
    actionsBar.className = 'e2b-editor-actions';
    actionsBar.setAttribute('data-testid', 'e2b-editor-actions');
    actionsBar.setAttribute('data-section-role', 'editor-actions');
    const save = document.createElement('button');
    save.type = 'submit';
    save.id = form.id + '-save';
    save.setAttribute('data-testid', 'catalog-save');
    save.className = 'btn btn-ghost';
    save.textContent = 'حفظ المسودة';
    if (note && (note.indexOf('حُفظت المسودة') === 0 || note.indexOf('نُشر في التطبيق') === 0)) status.classList.add('save-ok');
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn btn-ghost';
    submit.textContent = developerAccount ? 'نشر الآن' : 'إرسال للمراجعة';
    submit.setAttribute('data-testid', 'catalog-submit-review');
    /**
     * I-01: `.btn { display:inline-flex }` overrides HTML `hidden`. Always suppress with
     * class+attr, and pick exactly one final CTA from account + operation state.
     */
    function suppressCta(el, on) {
      if (!el) return;
      el.hidden = !!on;
      el.classList.toggle('hidden', !!on);
      el.classList.toggle('is-cta-suppressed', !!on);
      el.setAttribute('aria-hidden', on ? 'true' : 'false');
      if (on) {
        el.setAttribute('tabindex', '-1');
        el.disabled = true;
        // Inline !important beats site `.btn { display:inline-flex }` for geometry evaluators.
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      } else {
        el.removeAttribute('tabindex');
        el.disabled = false;
        el.style.removeProperty('display');
        el.style.removeProperty('visibility');
        el.style.removeProperty('pointer-events');
      }
    }
    function resumeNeededFromContext() {
      const mat = form.querySelector('[data-editor-v2-materialize="1"]');
      if (mat && mat.dataset.resumeActive === '1') return true;
      const ctxMat = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
      if (!ctxMat) return false;
      if (ctxMat.submitReviewStatus === 'submitted' || mat?.dataset.resumeActive === '0') return false;
      return (
        ctxMat.status === 'materialized' ||
        ctxMat.status === 'submit_failed' ||
        ctxMat.status === 'materializing' ||
        ctxMat.submitReviewStatus === 'failed'
      );
    }
    function applyFinalCtaPolicy() {
      const mat = form.querySelector('[data-editor-v2-materialize="1"]');
      const editorV2 = !!(window.MiraEditorV2 && MiraEditorV2.state.enabled);
      const resume = resumeNeededFromContext();
      // Always keep draft save available (never a second final publish/review).
      suppressCta(save, false);
      save.className = 'btn btn-ghost';
      save.textContent = 'حفظ المسودة';
      save.dataset.ctaRole = 'draft';
      // Legacy submit never shares the bar with materialize.
      suppressCta(submit, true);
      submit.dataset.ctaRole = 'legacy';
      if (mat && mat.parentElement !== actionsBar) actionsBar.appendChild(mat);
      if (editorV2 && mat) {
        if (resume) {
          // One final action: resume/review completion — not «نشر الآن» beside it.
          suppressCta(mat, false);
          mat.className = 'btn btn-primary';
          mat.dataset.ctaRole = 'final';
          if (!/استئناف النشر|استكمال النشر|استئناف الإرسال للمراجعة|مراجعة الحفظ/.test(mat.textContent || '')) {
            mat.textContent = developerAccount ? 'استئناف النشر' : 'استئناف الإرسال للمراجعة';
          } else if (developerAccount && /إرسال للمراجعة/.test(mat.textContent || '')) {
            mat.textContent = 'استئناف النشر';
          }
          actionsBar.dataset.finalCta = 'resume';
        } else if (developerAccount) {
          // Developer: sole final = save publish (relabel); materialize suppressed.
          suppressCta(mat, true);
          mat.dataset.ctaRole = 'suppressed';
          save.className = 'btn btn-primary';
          save.textContent = 'نشر الآن';
          save.dataset.ctaRole = 'final';
          actionsBar.dataset.finalCta = 'publish';
        } else {
          // Brand: sole final = materialize review; save stays draft.
          suppressCta(mat, false);
          mat.className = 'btn btn-primary';
          mat.textContent = 'إرسال للمراجعة';
          mat.dataset.ctaRole = 'final';
          actionsBar.dataset.finalCta = 'review';
        }
      } else if (developerAccount) {
        suppressCta(submit, false);
        submit.className = 'btn btn-primary';
        submit.textContent = 'نشر الآن';
        submit.dataset.ctaRole = 'final';
        save.className = 'btn btn-ghost';
        save.textContent = 'حفظ المسودة';
        save.dataset.ctaRole = 'draft';
        // Non-V2 developer: submit is final publish; save is draft only.
        // Actually persistListing on save with publish for developer — keep save as sole final.
        suppressCta(submit, true);
        save.className = 'btn btn-primary';
        save.textContent = 'نشر الآن';
        save.dataset.ctaRole = 'final';
        actionsBar.dataset.finalCta = 'publish';
      } else {
        suppressCta(submit, false);
        submit.className = 'btn btn-primary';
        submit.textContent = 'إرسال للمراجعة';
        submit.dataset.ctaRole = 'final';
        actionsBar.dataset.finalCta = 'review';
      }
      actionsBar.dataset.account = developerAccount ? 'developer' : 'brand';
      actionsBar.dataset.resume = resume ? '1' : '0';
    }
    form._miraApplyFinalCtaPolicy = applyFinalCtaPolicy;
    actionsBar.appendChild(save);
    actionsBar.appendChild(submit);
    const matExisting = form.querySelector('[data-editor-v2-materialize="1"]');
    if (matExisting && matExisting.parentElement !== actionsBar) actionsBar.appendChild(matExisting);
    applyFinalCtaPolicy();
    form.appendChild(actionsBar);

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
      refreshSubcategoryOptions({ keepValue: '' });
      if (type === 'brand') {
        // Keep selected values/variants; category drop of saved groups is a conflict (RC6-01).
        // Do not clear optionsState — merchant must revert category or explicit-clear.
        const next = category.value;
        const preset = optionPresets(next, subcategory && subcategory.value);
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
        remountAttributeFields({ preserveEdits: true });
      } else paintServiceTemplates();
    };
    subcategory.onchange = function () {
      if (type === 'brand') paintOptions();
      remountAttributeFields({ preserveEdits: true });
    };
    cosmeticVisible();

    const optionsSection = document.createElement('div');
    optionsSection.className = 'form-section e2b-core-offer';
    optionsSection.setAttribute('data-section-role', 'options');
    optionsSection.setAttribute('data-testid', 'e2b-core-offer');
    optionsSection.hidden = type !== 'brand';
    text(optionsSection, 'الخيارات الأساسية', 'h3');
    text(optionsSection, 'الألوان والمقاسات بجانب الخامات والكمية. التركيبات اختيار يدوي لاحقًا دون توليد تلقائي.');
    const optionsActionBar = document.createElement('div');
    optionsActionBar.setAttribute('data-options-action-bar', '1');
    const optionsBody = document.createElement('div');
    optionsBody.className = 'e2b-core-options-body';
    const qtyHost = document.createElement('div');
    qtyHost.className = 'e2b-qty-host';
    qtyHost.setAttribute('data-testid', 'e2b-qty-host');
    const optionsPreview = document.createElement('div');
    optionsPreview.className = 'options-preview';
    // I-02: colors/sizes first — materials + qty follow as siblings; preview must NOT sit between them.
    optionsSection.append(optionsActionBar, optionsBody);
    form.insertBefore(optionsSection, mediaSection);

    const attrSection = document.createElement('div');
    attrSection.className = 'form-section e2b-core-attrs';
    attrSection.setAttribute('data-section-role', 'attributes');
    attrSection.hidden = type !== 'brand' && window.__MIRA_TAXONOMY_LANE__ !== 'occasions';
    attrSection.setAttribute('data-testid', 'registry-attribute-section');
    text(attrSection, type === 'brand' ? 'الخامات وخصائص التصنيف' : 'خصائص المناسبة', 'h3');
    text(
      attrSection,
      'الخامات متعددة الاختيار من السجل المعتمد؛ القصة والطول حسب التصنيف. القيم تُحفظ عبر attributes دون مسح عند طي القسم.',
    );
    const attrSaveState = document.createElement('div');
    attrSaveState.className = 'mira-attr-save-state';
    attrSaveState.setAttribute('data-testid', 'attr-save-state');
    const attrHost = document.createElement('div');
    attrHost.setAttribute('data-testid', 'registry-attribute-host');
    attrSection.append(attrSaveState, attrHost, qtyHost);
    form.insertBefore(attrSection, mediaSection);
    // I-02: quantity sits with colors/sizes/materials — relocate without recreating (preserve value/listeners).
    if (stockInput) {
      const stockField = stockInput.closest('.field') || stockInput.parentElement;
      if (stockField) qtyHost.appendChild(stockField);
    }
    const optionsPreviewSection = document.createElement('div');
    optionsPreviewSection.className = 'form-section e2b-options-preview-section';
    optionsPreviewSection.setAttribute('data-section-role', 'options-preview');
    optionsPreviewSection.setAttribute('data-testid', 'e2b-options-preview-section');
    optionsPreviewSection.hidden = type !== 'brand';
    optionsPreviewSection.appendChild(optionsPreview);
    form.insertBefore(optionsPreviewSection, mediaSection);

    let attrMount = null;
    let attrRegistryCache = null;
    function resolveAttributesSeed() {
      if (item && item.draftTaxonomySet) {
        return item.draftAttributesJson && typeof item.draftAttributesJson === 'object'
          ? item.draftAttributesJson
          : {};
      }
      if (seed && seed.attributesJson && typeof seed.attributesJson === 'object') return seed.attributesJson;
      if (item && item.attributesJson && typeof item.attributesJson === 'object') return item.attributesJson;
      return {};
    }
    function profileIdFromTaxonomyNode(subId, catId) {
      const doc = taxonomyCache;
      if (!doc || !Array.isArray(doc.nodes)) return null;
      const id = subId || catId;
      if (!id) return null;
      const node = doc.nodes.find((n) => n && n.id === id);
      if (node && node.profileId) return node.profileId;
      if (subId && catId) {
        const parent = doc.nodes.find((n) => n && n.id === catId);
        if (parent && parent.profileId) return parent.profileId;
      }
      return null;
    }
    function profileIdForAttributes() {
      const preferred =
        (draftCtx && draftCtx.profileId) ||
        window.__MIRA_LANE_PROFILE_ID__ ||
        (item && item.draftTaxonomySet ? item.draftProfileId : null) ||
        (item && item.profileId) ||
        (seed && seed.profileId) ||
        null;
      const sub = subcategory && subcategory.value;
      const fromNode = profileIdFromTaxonomyNode(sub, category && category.value);
      if (fromNode) return fromNode;
      if (window.MiraEditorV2 && typeof MiraEditorV2.profileIdFor === 'function') {
        // Prefer taxonomy subcategory mapping for abaya etc.
        if (sub === 'clothes.abaya') return 'product.abaya';
        if (sub && String(sub).indexOf('bags') === 0) return 'product.bags';
        if (sub && String(sub).indexOf('shoes') === 0) return 'product.shoes';
        if (sub && String(sub).indexOf('jewelry') === 0) return 'product.jewelry';
        if (sub && String(sub).indexOf('children') === 0) return 'product.kids';
        if (sub && String(sub).indexOf('gifts') === 0) return 'product.gifts';
        if (sub && String(sub).indexOf('occasions') === 0) {
          return kind === 'service' || (window.__MIRA_TAXONOMY_LANE__ === 'occasions' && preferred === 'service.occasions')
            ? 'service.occasions'
            : 'product.occasions_favors';
        }
        return MiraEditorV2.profileIdFor(
          kind === 'service' ? 'service' : 'product',
          category.value,
          (window.sessionPartner && window.sessionPartner.type) || 'brand',
          preferred,
        );
      }
      return preferred || (kind === 'service' ? 'service.salon.generic' : 'product.clothes');
    }
    function setAttrSaveKind(kind, msg) {
      attrSaveState.dataset.kind = kind || '';
      attrSaveState.textContent = msg || '';
    }
    let attrRemountGen = 0;
    async function remountAttributeFields(opts) {
      const occasionsService =
        type !== 'brand' &&
        (window.__MIRA_TAXONOMY_LANE__ === 'occasions' ||
          (draftCtx && draftCtx.profileId === 'service.occasions') ||
          (category && category.value === 'occasions'));
      if (type !== 'brand' && !occasionsService) {
        attrSection.hidden = true;
        return;
      }
      const cat = category.value;
      const writeBlocked = false; // E4: bags/shoes write enabled
      attrSection.hidden = false;
      const preserve =
        opts && opts.preserveEdits && attrMount && typeof attrMount.captureEditorState === 'function'
          ? attrMount.captureEditorState()
          : null;
      const gen = ++attrRemountGen;
      if (attrMount && attrMount.destroy) attrMount.destroy();
      attrMount = null;
      if (!window.MiraRegistryAttributeFields) {
        attrHost.textContent = 'مكوّن الخصائص غير محمّل.';
        return;
      }
      try {
        if (!attrRegistryCache) {
          // Canonical registry is served by the API; static JSON is generated fallback only.
          if (window.PartnersApi && typeof PartnersApi.registry === 'function') {
            try {
              const meta = await PartnersApi.registry();
              attrRegistryCache = (meta && meta.registry) || meta;
            } catch (_) {
              /* fall through to generated static copy */
            }
          }
          if (!attrRegistryCache) {
            attrRegistryCache =
              (window.MiraEditorV2 && MiraEditorV2.state && MiraEditorV2.state.localRegistry) ||
              (await fetch('js/field-registry.v2.json').then((r) => r.json()));
          }
        }
        if (gen !== attrRemountGen) return; // stale remount
        const profileId = profileIdForAttributes();
        const ownerKey = resolveOwnerId() || (item && item.id) || form.id || 'new';
        attrMount = window.MiraRegistryAttributeFields.mount(attrHost, {
          registry: attrRegistryCache,
          profileId: profileId,
          category: category && category.value,
          subcategory: subcategory && subcategory.value,
          mountId: 'cat-' + String(ownerKey).slice(0, 12),
          initialAttributes: resolveAttributesSeed(),
          preserveState: preserve,
          includeComponentContract: writeBlocked || profileId === 'product.bags',
          persistComponentContract: profileId === 'product.bags',
          readOnly: writeBlocked,
          onChange: function (payload) {
            // R02: server/hydrate fills must not bump user-edit epoch or trigger autosave.
            if (payload && payload.source && payload.source !== 'user') return;
            bumpFormContentEpoch();
            setAttrSaveKind('dirty', 'تغييرات خصائص غير محفوظة');
            scheduleEditorDraftAutosave();
          },
        });
        if (writeBlocked) {
          setAttrSaveKind(
            'error',
            '', // E4 write unlocked
          );
        } else {
          setAttrSaveKind('', '');
        }
      } catch (e) {
        attrHost.textContent = 'تعذر تحميل خصائص السجل: ' + ((e && e.message) || String(e));
      }
    }
    remountAttributeFields();

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
        customsList: src.customsList || {},
        inputModes: src.inputModes || {},
        traits: src.traits || {},
        variants: src.variants || [],
        valueIds: src.valueIds || {},
        clearingOptions: !!src.clearingOptions,
        clearingVariants: !!src.clearingVariants,
        categoryConflict: src.categoryConflict || null,
        invalidVariantNote: src.invalidVariantNote || '',
        inventoryMode: src.inventoryMode === 'variant' ? 'variant' : 'product',
        inventoryLoadState: src.inventoryLoadState || 'idle',
        inventoryLoadError: src.inventoryLoadError || '',
        inventoryHydrateProductId: src.inventoryHydrateProductId || null,
      }));
    }

    function clearOptionsStateValues() {
      optionsState.selected = {};
      optionsState.customs = {};
      optionsState.customsList = {};
      optionsState.inputModes = {};
      optionsState.traits = {};
      optionsState.variants = [];
      optionsState.valueIds = {};
      optionsState.categoryConflict = null;
      optionsState.invalidVariantNote = '';
      optionsState._builtGroups = null;
    }

    function labelsForPreviewGroup(groupId) {
      if (window.MiraCatalogOptions && typeof window.MiraCatalogOptions.labelsForGroup === 'function') {
        return window.MiraCatalogOptions.labelsForGroup(optionsState, groupId);
      }
      const selected = (optionsState.selected[groupId] || []).slice();
      const split =
        window.MiraCatalogOptions && typeof window.MiraCatalogOptions.splitCustomLabels === 'function'
          ? window.MiraCatalogOptions.splitCustomLabels
          : (raw) => String(raw || '').split(/[,،]+/).map((s) => s.trim()).filter(Boolean);
      const fromList = Array.isArray(optionsState.customsList && optionsState.customsList[groupId])
        ? optionsState.customsList[groupId]
        : split(optionsState.customs[groupId] || '');
      fromList.forEach((part) => {
        if (selected.indexOf(part) < 0) selected.push(part);
      });
      return selected;
    }

    function revealInvalidInMobileStep(fieldName) {
      const el =
        (fieldName && form.querySelector('[name="' + fieldName + '"]')) ||
        (fieldName && form.querySelector('[data-field-id="' + fieldName + '"]')) ||
        form.querySelector('.field-error:not([hidden])') ||
        form.querySelector('.mira-attr-error:not([hidden])');
      if (window.MiraE2BProductShell && typeof MiraE2BProductShell.revealStepForElement === 'function' && el) {
        MiraE2BProductShell.revealStepForElement(el);
      }
    }

    /**
     * inventoryLoadState: idle | loading | loaded | failed
     * Never treat failed/loading as empty stock. Late responses for another product are ignored.
     * Local stock edits (_stockDirty / inventoryLocalEpoch) win over stale GET bodies.
     */
    let inventoryHydrateSeq = 0;
    if (!optionsState.inventoryLoadState) optionsState.inventoryLoadState = item && item.id ? 'idle' : 'loaded';
    if (optionsState.inventoryLocalEpoch == null) optionsState.inventoryLocalEpoch = 0;

    function markInventoryLocalEdit() {
      optionsState.inventoryLocalEpoch = (optionsState.inventoryLocalEpoch || 0) + 1;
    }

    async function hydrateVariantInventory() {
      if (type !== 'brand' || !item || !item.id || !window.PartnersApi || !PartnersApi.getVariantInventory) {
        optionsState.inventoryLoadState = 'loaded';
        return;
      }
      const productId = item.id;
      const seq = ++inventoryHydrateSeq;
      const epochAtStart = optionsState.inventoryLocalEpoch || 0;
      optionsState.inventoryLoadState = 'loading';
      optionsState.inventoryLoadError = '';
      optionsState.inventoryHydrateProductId = productId;
      try {
        const inv = await PartnersApi.getVariantInventory(productId);
        if (seq !== inventoryHydrateSeq) return; // superseded
        if (!item || item.id !== productId) return; // navigated away
        if (!inv) {
          optionsState.inventoryLoadState = 'failed';
          optionsState.inventoryLoadError = 'تعذر تحميل المخزون';
          paintOptions();
          return;
        }
        const preserveLocalQty = (optionsState.inventoryLocalEpoch || 0) !== epochAtStart;
        if (!window.MiraInventoryEditor || typeof window.MiraInventoryEditor.applyInventoryHydrate !== 'function') {
          throw new Error('MiraInventoryEditor غير محمّل');
        }
        window.MiraInventoryEditor.applyInventoryHydrate(optionsState, inv, { preserveLocalQty: preserveLocalQty });
        optionsState.inventoryLoadState = 'loaded';
        optionsState.inventoryLoadError = '';
        paintOptions();
      } catch (err) {
        if (seq !== inventoryHydrateSeq) return;
        if (!item || item.id !== productId) return;
        optionsState.inventoryLoadState = 'failed';
        optionsState.inventoryLoadError =
          (err && err.message) || 'تعذر تحميل المخزون — لن يُرسل تعديل مخزون حتى تنجح إعادة المحاولة';
        paintOptions();
      }
    }

    async function persistVariantInventory(productId) {
      if (type !== 'brand' || !productId || !window.PartnersApi || !PartnersApi.putVariantInventory) {
        return { ok: true, skipped: true };
      }
      const state = optionsState.inventoryLoadState;
      // Failed or never-loaded GET must not POST null/empty as intentional stock wipe.
      if (state === 'failed' || state === 'loading' || state === 'idle') {
        const err = new Error(
          state === 'failed'
            ? 'تعذر حفظ المخزون لأن التحميل فشل. أعيدي المحاولة بعد نجاح التحميل.'
            : 'المخزون ما زال يُحمَّل — انتظري ثم احفظي مرة أخرى.',
        );
        err.code = 'INVENTORY_NOT_READY';
        throw err;
      }
      if (optionsState.inventoryHydrateProductId && optionsState.inventoryHydrateProductId !== productId) {
        const err = new Error('سياق المخزون لا يطابق المنتج الحالي');
        err.code = 'INVENTORY_CONTEXT_MISMATCH';
        throw err;
      }
      if (!window.MiraInventoryEditor || typeof window.MiraInventoryEditor.buildInventoryPersistPayload !== 'function') {
        throw new Error('MiraInventoryEditor غير محمّل');
      }
      const built = window.MiraInventoryEditor.buildInventoryPersistPayload(optionsState);
      if (!built.ok) {
        const err = new Error(
          built.code === 'INVENTORY_REVISION_MISSING'
            ? 'لا يمكن حفظ تعديل المخزون قبل ربط رقم المراجعة — أعيدي تحميل المخزون مع الإبقاء على تعديلك.'
            : built.code === 'INVENTORY_INVALID_QTY'
              ? 'كمية المخزون غير صالحة بجانب إحدى التركيبات'
              : 'تعذر حفظ المخزون لأن التحميل لم يكتمل.',
        );
        err.code = built.code;
        throw err;
      }
      const res = await PartnersApi.putVariantInventory(productId, built.body);
      (res.updated || res.rows || []).forEach((r) => {
        const live = (optionsState.variants || []).find((v) => v.id === r.variantId);
        if (live) {
          live._inventoryRevision = r.revision;
          live._inventoryRowExists = true;
          live.stockMode = r.stockMode === 'untracked' ? 'untracked' : 'tracked';
          live._stockDirty = false;
          live._stockModeDirty = false;
          live._stockInvalid = false;
        }
      });
      optionsState._inventoryModeDirty = false;
      return res;
    }

    async function retryInventoryHydrate() {
      await hydrateVariantInventory();
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

    function optionPresets(cat, subcategory) {
      if (window.MiraCatalogOptions && typeof window.MiraCatalogOptions.optionPresets === 'function') {
        return window.MiraCatalogOptions.optionPresets(cat, subcategory);
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
          clearOptionsStateValues();
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
        if (optionsPreviewSection) optionsPreviewSection.hidden = true;
        if (attrSection) attrSection.hidden = true;
        syncOptionsActionBar();
        return;
      }
      optionsSection.hidden = false;
      if (optionsPreviewSection) optionsPreviewSection.hidden = false;
      if (attrSection) attrSection.hidden = false;
      syncOptionsActionBar();
      const preset = optionPresets(category.value, subcategory && subcategory.value);

      if (!preset.groups.length && !preset.traits.length) {
        text(optionsBody, 'هذا التصنيف لا يحتاج خيارات مقاس أو لون أو حجم.');
        paintOptionsPreview();
        return;
      }
      preset.groups.forEach((group) => {
        const block = document.createElement('div');
        block.className = 'option-group';
        block.setAttribute('data-option-kind', group.kind || group.id);
        text(block, group.label, 'h4');
        if (!optionsState.selected[group.id]) optionsState.selected[group.id] = [];

        function togglePresetLabel(label, on) {
          const list = optionsState.selected[group.id];
          const at = list.indexOf(label);
          if (on && at < 0) list.push(label);
          if (!on && at >= 0) list.splice(at, 1);
          optionsState.clearingOptions = false;
          optionsState.clearingVariants = false;
          onOptionsValuesChanged();
        }

        if (group.kind === 'color') {
          const palette = document.createElement('div');
          palette.className = 'e2b-color-palette';
          palette.setAttribute('data-testid', 'e2b-color-palette');
          const search = document.createElement('input');
          search.type = 'search';
          search.className = 'e2b-color-search';
          search.placeholder = 'ابحثي عن لون';
          search.setAttribute('aria-label', 'ابحثي عن لون');
          search.setAttribute('data-testid', 'e2b-color-search');
          const chips = document.createElement('div');
          chips.className = 'choice-row swatch-row e2b-swatch-grid';
          chips.setAttribute('role', 'group');
          chips.setAttribute('aria-label', group.label);
          const selectedBar = document.createElement('div');
          selectedBar.className = 'e2b-color-selected';
          selectedBar.setAttribute('data-testid', 'e2b-color-selected');
          const moreBtn = document.createElement('button');
          moreBtn.type = 'button';
          moreBtn.className = 'btn btn-ghost e2b-color-more';
          moreBtn.setAttribute('data-testid', 'e2b-color-more');
          moreBtn.textContent = 'جميع الألوان';
          let showAll = group.presets.length <= 12;
          const COLOR_PAGE = 12;

          function paintSelectedChips() {
            selectedBar.replaceChildren();
            (optionsState.selected[group.id] || []).forEach((label) => {
              const chip = document.createElement('button');
              chip.type = 'button';
              chip.className = 'e2b-color-chip';
              chip.setAttribute('data-color-label', label);
              chip.setAttribute('aria-label', 'إزالة ' + label);
              const style =
                window.MiraCatalogOptions && typeof window.MiraCatalogOptions.colorSwatchStyle === 'function'
                  ? window.MiraCatalogOptions.colorSwatchStyle(label)
                  : { background: '#d4c4ce', borderColor: '#d4c4ce' };
              const dot = document.createElement('span');
              dot.className = 'e2b-color-chip-dot';
              dot.style.background = style.background;
              chip.append(dot, document.createTextNode(label + ' ×'));
              chip.onclick = () => {
                togglePresetLabel(label, false);
                paintColorGrid();
                paintSelectedChips();
              };
              selectedBar.appendChild(chip);
            });
            if (!(optionsState.selected[group.id] || []).length) {
              const empty = document.createElement('span');
              empty.className = 'e2b-color-selected-empty';
              empty.textContent = 'لم يُختر لون بعد (اختياري)';
              selectedBar.appendChild(empty);
            }
          }

          function paintColorGrid() {
            chips.replaceChildren();
            const q = String(search.value || '').trim();
            const filtered = group.presets.filter((label) => !q || label.indexOf(q) >= 0);
            const visible = showAll || q ? filtered : filtered.slice(0, COLOR_PAGE);
            moreBtn.hidden = !!q || filtered.length <= COLOR_PAGE;
            moreBtn.textContent = showAll ? 'عرض أقل' : 'جميع الألوان';
            visible.forEach((label) => {
              const wrap = document.createElement('label');
              wrap.className = 'swatch-choice';
              const input = document.createElement('input');
              input.type = 'checkbox';
              input.checked = optionsState.selected[group.id].indexOf(label) >= 0;
              input.setAttribute('aria-label', label);
              input.onchange = () => {
                togglePresetLabel(label, input.checked);
                wrap.classList.toggle('is-selected', input.checked);
                paintSelectedChips();
              };
              const swatch = document.createElement('span');
              swatch.className = 'color-swatch';
              swatch.setAttribute('data-color-label', label);
              swatch.setAttribute('title', label);
              const style =
                window.MiraCatalogOptions && typeof window.MiraCatalogOptions.colorSwatchStyle === 'function'
                  ? window.MiraCatalogOptions.colorSwatchStyle(label)
                  : { background: '#d4c4ce', borderColor: '#d4c4ce' };
              swatch.style.background = style.background;
              swatch.style.borderColor = style.borderColor;
              if (input.checked) {
                wrap.classList.add('is-selected');
                const mark = document.createElement('span');
                mark.className = 'e2b-swatch-check';
                mark.setAttribute('aria-hidden', 'true');
                mark.textContent = '✓';
                swatch.appendChild(mark);
              }
              const name = document.createElement('span');
              name.className = 'swatch-name';
              name.textContent = label;
              wrap.append(input, swatch, name);
              chips.appendChild(wrap);
            });
          }

          search.addEventListener('input', () => {
            paintColorGrid();
          });
          moreBtn.addEventListener('click', () => {
            showAll = !showAll;
            paintColorGrid();
          });
          paintColorGrid();
          paintSelectedChips();
          palette.append(search, chips, moreBtn, selectedBar);
          block.appendChild(palette);
        } else {
          const chips = document.createElement('div');
          chips.className = 'choice-row' + (group.kind === 'size' ? ' size-row' : '');
          group.presets.forEach((label) => {
            const wrap = document.createElement('label');
            wrap.className = group.kind === 'size' ? 'size-choice' : 'chip-choice';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = optionsState.selected[group.id].indexOf(label) >= 0;
            input.setAttribute('aria-label', label);
            input.onchange = () => {
              togglePresetLabel(label, input.checked);
              wrap.classList.toggle('is-selected', input.checked);
            };
            if (input.checked) wrap.classList.add('is-selected');
            const mark = document.createElement('span');
            mark.className = 'e2b-choice-check';
            mark.setAttribute('aria-hidden', 'true');
            mark.textContent = input.checked ? '✓ ' : '';
            wrap.append(input, mark, document.createTextNode(label));
            input.addEventListener('change', () => {
              mark.textContent = input.checked ? '✓ ' : '';
            });
            chips.appendChild(wrap);
          });
          block.appendChild(chips);
        }
        if (!optionsState.inputModes) optionsState.inputModes = {};
        if (!optionsState.customsList) optionsState.customsList = {};
        const mode = optionsState.inputModes[group.id] || 'ready';
        const modeRow = document.createElement('div');
        modeRow.className = 'choice-row input-mode-row';
        modeRow.setAttribute('data-testid', 'input-mode-' + group.id);
        [['ready', 'اختيار جاهز'], ['manual', 'كتابة يدوية']].forEach(([id, labelText]) => {
          const lab = document.createElement('label');
          lab.className = 'input-mode-choice' + (mode === id ? ' is-selected' : '');
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'input-mode-' + group.id + '-' + (Date.now() % 100000);
          radio.value = id;
          radio.checked = mode === id;
          radio.onchange = () => {
            if (!radio.checked) return;
            optionsState.inputModes[group.id] = id;
            // Preserve ready selections + manual customs across mode switches.
            paintOptions();
          };
          lab.append(radio, document.createTextNode(' ' + labelText));
          modeRow.appendChild(lab);
        });
        block.appendChild(modeRow);
        const readyHost = block.querySelector('.e2b-color-palette, .choice-row:not(.input-mode-row)');
        if (readyHost) readyHost.hidden = mode === 'manual';
        const customDetails = document.createElement('details');
        customDetails.className = 'e2b-extra-details';
        customDetails.open = mode === 'manual';
        customDetails.hidden = mode === 'ready';
        const customSummary = document.createElement('summary');
        customSummary.textContent = 'كتابة يدوية لـ' + group.label;
        customDetails.appendChild(customSummary);
        const custom = field(
          customDetails,
          'كتابة يدوية (افصلي بفاصلة عربية أو إنجليزية؛ تُحفظ كقيم مستقلة)',
          'custom-' + group.id,
          optionsState.customs[group.id] || '',
          'text',
        );
        custom.setAttribute('data-testid', 'manual-input-' + group.id);
        custom.oninput = () => {
          optionsState.customs[group.id] = custom.value;
          const split =
            window.MiraCatalogOptions && typeof window.MiraCatalogOptions.splitCustomLabels === 'function'
              ? window.MiraCatalogOptions.splitCustomLabels
              : (raw) => String(raw || '').split(/[,،]+/).map((s) => s.trim()).filter(Boolean);
          optionsState.customsList[group.id] = split(custom.value);
          abandonClearIfValuesEntered();
          onOptionsValuesChanged();
        };
        block.appendChild(customDetails);
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
      // I-02: variants/advanced stay reachable but collapsed — values preserved when collapsed.
      const variantsDetails = document.createElement('details');
      variantsDetails.className = 'e2b-extra-details e2b-variants-details';
      variantsDetails.setAttribute('data-testid', 'e2b-variants-details');
      const variantsSummary = document.createElement('summary');
      variantsSummary.textContent = 'التركيبات المتقدمة (لا تُنشأ تلقائيًا)';
      variantsDetails.appendChild(variantsSummary);
      const variantList = document.createElement('div');
      variantList.className = 'variant-list';
      // P3.1 — inventory mode for variant stock adapter (empty ≠ 0).
      if (!optionsState.inventoryMode) optionsState.inventoryMode = 'product';
      if (optionsState.inventoryLoadState === 'failed') {
        const failBanner = document.createElement('p');
        failBanner.className = 'field-error';
        failBanner.setAttribute('role', 'alert');
        failBanner.setAttribute('data-testid', 'inventory-load-error');
        failBanner.textContent =
          optionsState.inventoryLoadError ||
          'تعذر تحميل المخزون. التعديلات المحلية محفوظة في النموذج ولن يُرسل مسح للمخزون.';
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'btn btn-ghost btn-sm';
        retryBtn.textContent = 'إعادة تحميل المخزون';
        retryBtn.onclick = () => {
          retryInventoryHydrate();
        };
        variantsDetails.appendChild(failBanner);
        variantsDetails.appendChild(retryBtn);
      } else if (optionsState.inventoryLoadState === 'loading') {
        const loadingNote = document.createElement('p');
        loadingNote.className = 'muted';
        loadingNote.setAttribute('data-testid', 'inventory-loading');
        loadingNote.textContent = 'جارٍ تحميل المخزون…';
        variantsDetails.appendChild(loadingNote);
      }
      const invModeRow = document.createElement('div');
      invModeRow.className = 'choice-row';
      const invLabel = document.createElement('label');
      const invCheck = document.createElement('input');
      invCheck.type = 'checkbox';
      invCheck.checked = optionsState.inventoryMode === 'variant';
      invCheck.onchange = () => {
        optionsState.inventoryMode = invCheck.checked ? 'variant' : 'product';
        optionsState._inventoryModeDirty = true;
        markInventoryLocalEdit();
        saveOptionsDraft();
        paintOptions();
      };
      invLabel.append(invCheck, document.createTextNode(' تتبع المخزون لكل تركيبة'));
      invModeRow.appendChild(invLabel);
      variantsDetails.appendChild(invModeRow);
      optionsBody.appendChild(variantsDetails);

      optionsState.variants.forEach((variant, index) => {
        const row = document.createElement('div');
        row.className = 'check-row variant-stock-row';
        row.setAttribute('data-variant-id', variant.id);
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
        let stockField = null;
        if (optionsState.inventoryMode === 'variant') {
          stockField = document.createElement('input');
          stockField.type = 'number';
          stockField.min = '0';
          stockField.step = '1';
          stockField.placeholder = 'كمية (فارغ = غير محدد)';
          stockField.setAttribute('aria-label', 'كمية المخزون للتركيبة');
          stockField.setAttribute('data-testid', 'variant-stock-qty');
          stockField.style.width = '8rem';
          // Distinguish empty (unspecified) from 0 — never coerce empty→0 or invalid→null silently.
          stockField.value =
            variant._stockRaw != null
              ? String(variant._stockRaw)
              : variant.stockQty == null
                ? ''
                : String(variant.stockQty);
          if (variant._stockInvalid) stockField.classList.add('is-invalid');
          stockField.oninput = () => {
            const raw = stockField.value.trim();
            variant._stockRaw = stockField.value;
            variant._stockDirty = true;
            markInventoryLocalEdit();
            if (raw === '') {
              variant.stockQty = null;
              variant._stockInvalid = false;
              stockField.classList.remove('is-invalid');
            } else if (/^\d+$/.test(raw)) {
              variant.stockQty = parseInt(raw, 10);
              variant._stockInvalid = false;
              stockField.classList.remove('is-invalid');
            } else {
              // Keep typed text; do not coerce to null.
              variant._stockInvalid = true;
              stockField.classList.add('is-invalid');
            }
            saveOptionsDraft();
            paintOptionsPreview();
          };
        }
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
        row.append(label, price, avail);
        if (stockField) row.appendChild(stockField);
        row.appendChild(remove);
        variantList.appendChild(row);
      });
      variantsDetails.appendChild(variantList);

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
          mediaIds: [],
        });
        optionsState.clearingOptions = false;
        optionsState.clearingVariants = false;
        Object.keys(pickers).forEach((id) => { pickers[id].value = ''; });
        saveOptionsDraft();
        paintOptions();
      };
      addBox.appendChild(addBtn);
      variantsDetails.appendChild(addBox);
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
      const preset = optionPresets(category.value, subcategory && subcategory.value);
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
      const preset = optionPresets(category.value, subcategory && subcategory.value);
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
          mediaIds: Array.isArray(variant.mediaIds) ? variant.mediaIds.slice() : [],
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
      const preset = optionPresets(category.value, subcategory && subcategory.value);
      preset.groups.forEach((group) => {
        const selected = labelsForPreviewGroup(group.id);
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
    hydrateVariantInventory();

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
          // C04: file select never implies publish — stage/upload only; explicit «نشر الآن» publishes.
          status: problem ? 'فشل' : (item && item.id ? 'جارٍ الرفع' : 'بانتظار الحفظ'),
          error: problem,
          percent: null,
          url: URL.createObjectURL(file),
          placement: placement === 'detail' ? 'detail' : 'main',
        };
        staged[form.id].push(entry);
        if (!problem && item && item.id) uploadOne(entry);
      }
      paintMedia(null);
      // Legacy (V2 off): selecting a file for a new item may create/save the draft owner so upload can start,
      // but must NOT call submitReview / publish. Explicit publish stays on «نشر الآن» / submit.
      if (
        developerAccount &&
        form.dataset.saving !== '1' &&
        !(item && item.id) &&
        staged[form.id].some((entry) => entry.status === 'بانتظار الحفظ' && entry.file && !entry.error)
      ) {
        const saved = await persistListing({ publish: false });
        if (!saved) {
          staged[form.id].forEach((entry) => {
            if (entry.status === 'بانتظار الحفظ') entry.status = 'بانتظار البيانات';
          });
          paintMedia(null);
        } else if (item && item.id) {
          // Draft owner exists — start staged uploads without publishing.
          for (const entry of staged[form.id].slice()) {
            if (!entry.error && entry.file && entry.status === 'بانتظار الحفظ') {
              entry.status = 'جارٍ الرفع';
              uploadOne(entry);
            }
          }
          paintMedia(null);
        }
      }
    }
    images.onchange = () => { addStaged(images.files, 'main'); images.value = ''; };
    videos.onchange = () => { addStaged(videos.files, 'main'); videos.value = ''; };
    detailImages.onchange = () => { addStaged(detailImages.files, 'detail'); detailImages.value = ''; };
    detailVideos.onchange = () => { addStaged(detailVideos.files, 'detail'); detailVideos.value = ''; };

    /** Media ids removed in this editor session — omit even if a stale preview still lists them. */
    const locallyRemovedMediaIds = new Set();
    let mediaPaintGeneration = 0;

    function stripDeletedFromOptionsState(mediaId) {
      if (window.MiraCatalogOptions && typeof window.MiraCatalogOptions.stripMediaIdsFromOptionsState === 'function') {
        window.MiraCatalogOptions.stripMediaIdsFromOptionsState(optionsState, [mediaId]);
        return;
      }
      if (!optionsState || !Array.isArray(optionsState.variants)) return;
      optionsState.variants.forEach(function (variant) {
        if (!variant || !Array.isArray(variant.mediaIds)) return;
        variant.mediaIds = variant.mediaIds.filter(function (id) { return id !== mediaId; });
      });
    }

    function syncOptionsMediaIdsFromItemOrPreview(previewData) {
      var serverVariants = [];
      if (previewData && previewData.draftVariantsSet && Array.isArray(previewData.draftVariantsJson)) {
        serverVariants = previewData.draftVariantsJson;
      } else if (previewData && Array.isArray(previewData.publishedVariantsJson)) {
        serverVariants = previewData.publishedVariantsJson;
      } else if (item && item.draftVariantsSet && Array.isArray(item.draftVariantsJson)) {
        serverVariants = item.draftVariantsJson;
      } else if (item && Array.isArray(item.variantsJson)) {
        serverVariants = item.variantsJson;
      }
      if (window.MiraCatalogOptions && typeof window.MiraCatalogOptions.syncVariantMediaIdsFromServer === 'function') {
        window.MiraCatalogOptions.syncVariantMediaIdsFromServer(optionsState, serverVariants, locallyRemovedMediaIds);
        return;
      }
      if (!optionsState || !Array.isArray(optionsState.variants)) return;
      optionsState.variants.forEach(function (variant) {
        if (!variant || !variant.id) return;
        var match = serverVariants.find(function (sv) { return sv && sv.id === variant.id; });
        if (!match) return;
        var next = Array.isArray(match.mediaIds) ? match.mediaIds.slice() : [];
        variant.mediaIds = next.filter(function (id) { return id && !locallyRemovedMediaIds.has(id); });
      });
    }

    async function paintMedia(serverMedia) {
      const paintGen = ++mediaPaintGeneration;
      mediaBox.replaceChildren();
      detailMediaBox.replaceChildren();
      const rows = staged[form.id];
      rows.forEach((entry, index) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.setAttribute('data-testid', 'media-card-staged');
        card.dataset.fileKey = entry.key;
        if (entry.uploadSessionId) card.dataset.uploadSessionId = entry.uploadSessionId;
        if (entry.file && entry.file.name) card.dataset.fileName = entry.file.name;
        text(card, (entry.placement === 'detail' ? 'داخل التفاصيل' : 'العرض الرئيسي') + ' · ' + entry.file.name + ' · ' + entry.status + (entry.error ? ' · ' + entry.error : ''));
        const stateLine = document.createElement('p');
        stateLine.className = 'media-state';
        stateLine.setAttribute('data-testid', 'media-state');
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
        retry.disabled = entry.status === 'جارٍ القراءة' || entry.status === 'جارٍ الرفع' || entry.status === 'جارٍ المعالجة' || entry.status === 'بانتظار الحفظ';
        retry.onclick = () => {
          // C04: retry may save draft / resume upload — never auto-publish.
          // Keep uploadSessionId/clientMediaId so durable completed parts resume.
          if (!item || !item.id) persistListing({ publish: false });
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
          ? 'اختيار الملف يبدأ الرفع بعد حفظ المسودة. النشر يتم فقط عند ضغط «نشر الآن».'
          : 'الرفع يبدأ بعد حفظ المسودة. الملفات المختارة تبقى هنا.');
        syncVideoCardChrome(null);
        return;
      }
      let media = serverMedia;
      let previewForSync = null;
      if (!media) {
        try {
          const previewData = await PartnersApi.preview(type === 'brand' ? 'products' : 'services', item.id);
          if (paintGen !== mediaPaintGeneration) return; // newer paint started; drop stale preview
          media = previewData.media || [];
          previewForSync = previewData;
          if (previewData.reviewNote) status.textContent = 'سبب المراجعة: ' + previewData.reviewNote;
          // Keep item draft/published variant fields aligned with preview for bindings UI.
          if (typeof previewData.draftVariantsSet === 'boolean') {
            item.draftVariantsSet = previewData.draftVariantsSet;
            item.draftVariantsJson = previewData.draftVariantsSet
              ? (previewData.draftVariantsJson ?? null)
              : null;
          }
          if (previewData.publishedVariantsJson !== undefined) {
            item.variantsJson = previewData.publishedVariantsJson;
          }
          // Sync mediaIds into optionsState (bindings only) without wiping unsaved edits.
          syncOptionsMediaIdsFromItemOrPreview(previewData);
          // Drop local omit markers once the server no longer lists the media.
          Array.from(locallyRemovedMediaIds).forEach(function (removedId) {
            if (!(media || []).some(function (m) { return m && m.id === removedId; })) {
              locallyRemovedMediaIds.delete(removedId);
            }
          });
        } catch (error) {
          // Do not wipe variant binding UI on a failed media reload.
          text(mediaBox, 'تعذر تحميل الوسائط المحفوظة: ' + error.message);
          videoStatus.textContent = 'تعذر مزامنة حالة الفيديو المحفوظ: ' + ((error && error.message) || error);
          videoStatus.dataset.state = 'failed';
          videoPick.textContent = 'إعادة المحاولة / استبدال المقطع';
          return;
        }
      } else if (paintGen !== mediaPaintGeneration) {
        return;
      } else {
        syncOptionsMediaIdsFromItemOrPreview(null);
      }
      void previewForSync;
      const ids = media.map((row) => row.id);
      media.forEach((row, index) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.setAttribute('data-testid', 'media-card-saved');
        card.dataset.mediaId = row.id;
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
        remove.setAttribute('data-testid', 'media-remove');
        remove.onclick = async () => {
          const wasMainVideo = row.kind === 'video' && row.placement !== 'detail';
          await PartnersApi.removeMedia(type === 'brand' ? 'products' : 'services', item.id, row.id);
          // Strip from editor optionsState immediately so general save cannot resurrect.
          locallyRemovedMediaIds.add(row.id);
          stripDeletedFromOptionsState(row.id);
          if (item && Array.isArray(item.draftVariantsJson)) {
            item.draftVariantsJson = item.draftVariantsJson.map(function (v) {
              if (!v || !Array.isArray(v.mediaIds)) return v;
              return Object.assign({}, v, {
                mediaIds: v.mediaIds.filter(function (id) { return id !== row.id; }),
              });
            });
          }
          if (item && Array.isArray(item.variantsJson)) {
            item.variantsJson = item.variantsJson.map(function (v) {
              if (!v || !Array.isArray(v.mediaIds)) return v;
              return Object.assign({}, v, {
                mediaIds: v.mediaIds.filter(function (id) { return id !== row.id; }),
              });
            });
          }
          if (wasMainVideo) syncVideoCardChrome(undefined, { mainRemoved: true });
          paintMedia(null);
        };
        card.append(up, cover, remove);
        (row.placement === 'detail' ? detailMediaBox : mediaBox).appendChild(card);
      });
      paintVariantMediaBindings(media);
      syncVideoCardChrome(media);
    }

    function paintVariantMediaBindings(serverMedia) {
      if (type !== 'brand' || !item || !item.id) {
        variantMediaSection.hidden = true;
        return;
      }
      // Effective variants: draft when set, else published / working variantsJson.
      var variants;
      if (item.draftVariantsSet) {
        variants = item.draftVariantsJson == null ? [] : (Array.isArray(item.draftVariantsJson) ? item.draftVariantsJson : []);
      } else if (Array.isArray(item.variantsJson)) {
        variants = item.variantsJson;
      } else {
        variants = [];
      }
      variantMediaSection.hidden = variants.length === 0;
      variantMediaBox.replaceChildren();
      if (!variants.length) return;
      // C01: use explicit ready flag from preview (no storageKey/url required in API).
      const readyMedia = (serverMedia || []).filter(function (row) {
        if (!row || !row.id || row.pendingRemoval) return false;
        if (typeof row.ready === 'boolean') return row.ready === true;
        return !!(row.storageKey || row.url);
      });
      variants.forEach(function (variant) {
        if (!variant || !variant.id) return;
        const row = document.createElement('div');
        row.className = 'variant-media-row';
        const title = document.createElement('p');
        title.textContent = 'تركيبة: ' + (variant.id || '');
        const select = document.createElement('select');
        select.multiple = true;
        select.setAttribute('aria-label', 'وسائط التركيبة ' + variant.id);
        const bound = Array.isArray(variant.mediaIds) ? variant.mediaIds : [];
        readyMedia.forEach(function (m) {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = (m.kind === 'video' ? 'فيديو' : 'صورة') + ' · ' + m.id.slice(0, 8);
          if (bound.indexOf(m.id) >= 0) opt.selected = true;
          select.appendChild(opt);
        });
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'حفظ ربط التركيبة';
        saveBtn.onclick = async function () {
          const chosen = Array.prototype.slice.call(select.selectedOptions).map(function (o) { return o.value; });
          try {
            await PartnersApi.bindVariantMedia(item.id, variant.id, chosen);
            status.textContent = 'تم حفظ ربط وسائط التركيبة.';
            // Keep easy-UI optionsState in sync so a later general save (persistListing /
            // structuredOptionsPayload) does not rewrite variants without mediaIds.
            if (optionsState && Array.isArray(optionsState.variants)) {
              const live = optionsState.variants.find(function (v) { return v && v.id === variant.id; });
              if (live) live.mediaIds = chosen.slice();
            }
            // Refresh via preview (same contract as picker) so draft bindings survive reload.
            const previewData = await PartnersApi.preview('products', item.id);
            if (previewData) {
              if (typeof previewData.draftVariantsSet === 'boolean') {
                item.draftVariantsSet = previewData.draftVariantsSet;
                item.draftVariantsJson = previewData.draftVariantsSet
                  ? (previewData.draftVariantsJson ?? null)
                  : null;
              }
              if (previewData.publishedVariantsJson !== undefined) {
                item.variantsJson = previewData.publishedVariantsJson;
              }
              // Re-hydrate mediaIds for all variants from server draft/published so
              // sibling variants keep their bindings after this save.
              var serverVariants = [];
              if (previewData.draftVariantsSet && Array.isArray(previewData.draftVariantsJson)) {
                serverVariants = previewData.draftVariantsJson;
              } else if (Array.isArray(previewData.publishedVariantsJson)) {
                serverVariants = previewData.publishedVariantsJson;
              } else if (Array.isArray(previewData.variantsJson)) {
                serverVariants = previewData.variantsJson;
              }
              if (optionsState && Array.isArray(optionsState.variants) && serverVariants.length) {
                optionsState.variants.forEach(function (v) {
                  if (!v || !v.id) return;
                  var match = serverVariants.find(function (sv) { return sv && sv.id === v.id; });
                  if (match) {
                    v.mediaIds = Array.isArray(match.mediaIds) ? match.mediaIds.slice() : [];
                  }
                });
              }
            }
            paintMedia(previewData && previewData.media ? previewData.media : null);
          } catch (err) {
            status.textContent = (err && err.message) || 'تعذر حفظ ربط التركيبة';
          }
        };
        row.append(title, select, saveBtn);
        variantMediaBox.appendChild(row);
      });
    }

    function syncMedia(entry) {
      const card = mediaBox.querySelector('[data-file-key="' + entry.key + '"]') || detailMediaBox.querySelector('[data-file-key="' + entry.key + '"]');
      const view = window.MiraMotion ? MiraMotion.describeMedia(entry) : { label: entry.status, mode: 'idle', percent: null };
      // Keep explicit phase in sync with status so video chrome updates mid-upload (not only on paintMedia).
      const st = String(entry.status || '');
      if (entry.error || st === 'فشل' || /فشل|خطأ|تعذر/.test(st)) entry.phase = 'failed';
      else if (st === 'أُلغي' || entry.aborted) entry.phase = 'cancelled';
      else if (/تحقق|معالجة|verif|process/i.test(st)) entry.phase = 'processing';
      else if (/رفع|تحضير|قراءة/.test(st) || entry._uploadBusy) entry.phase = 'uploading';
      else if (/رُفع|جاهز|مكتمل|ready/i.test(st) || entry.catalogMediaId) entry.phase = 'ready';
      else if (/انتظار|حفظ|البيانات/.test(st)) entry.phase = 'awaiting-save';
      else if (entry.file) entry.phase = entry.phase || 'selected';
      // Detail (or non-main) media must NOT reset the main video card via syncVideoCardChrome(null).
      if (typeof syncVideoCardChrome === 'function' && isMainVideoEntry(entry)) {
        syncVideoCardChrome(undefined);
      }
      if (!card) return;
      if (entry.uploadSessionId) card.dataset.uploadSessionId = entry.uploadSessionId;
      if (entry.catalogMediaId) card.dataset.mediaId = entry.catalogMediaId;
      card.setAttribute('data-testid', 'media-card-staged');
      const line = card.querySelector('.media-state');
      if (line) {
        line.textContent = view.label;
        line.setAttribute('data-testid', 'media-state');
      }
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
          // F06/U04: restore upload session after reload / re-pick.
          // If clientMediaId was freshly minted after a transport fail, never revive a
          // poisoned session via name+size scan — only exact key for that id.
          if (entry.clientMediaId && !entry.uploadSessionId) {
            try {
              const exactKey = 'mira_upload_resume:' + item.id + ':' + entry.clientMediaId;
              const saved = JSON.parse(sessionStorage.getItem(exactKey) || 'null');
              if (
                saved &&
                saved.sessionId &&
                saved.byteSize === entry.file.size &&
                saved.name === entry.file.name
              ) {
                entry.uploadSessionId = saved.sessionId;
                entry.uploadChecksum = saved.checksum || null;
              }
            } catch (_) {}
          } else if (!entry.clientMediaId) {
            try {
              const prefix = 'mira_upload_resume:' + item.id + ':';
              for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (!k || k.indexOf(prefix) !== 0) continue;
                const saved = JSON.parse(sessionStorage.getItem(k) || 'null');
                if (
                  saved &&
                  saved.sessionId &&
                  saved.byteSize === entry.file.size &&
                  saved.name === entry.file.name
                ) {
                  entry.clientMediaId = k.slice(prefix.length);
                  entry.uploadSessionId = saved.sessionId;
                  entry.uploadChecksum = saved.checksum || null;
                  break;
                }
              }
            } catch (_) {}
          }
          if (!entry.clientMediaId) {
            entry.clientMediaId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random();
          }
          const resumeKey = 'mira_upload_resume:' + item.id + ':' + entry.clientMediaId;
          entry.status = 'جارٍ التحضير';
          syncMedia(entry);
          try {
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
                syncMedia(entry);
                try {
                  sessionStorage.setItem(
                    resumeKey,
                    JSON.stringify({
                      sessionId: entry.uploadSessionId,
                      byteSize: entry.file.size,
                      checksum: session && session.declaredChecksum,
                      name: entry.file.name,
                      updatedAt: Date.now(),
                    }),
                  );
                } catch (_) {}
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
            try { sessionStorage.removeItem(resumeKey); } catch (_) {}
          } catch (uploadErr) {
            if (uploadErr && uploadErr.code === 'verify_pending') {
              entry.status = 'جارٍ التحقق';
              entry.error = '';
              syncMedia(entry);
              status.textContent = 'التحقق ما زال جاريًا على الخادم؛ لن يُعاد رفع الأجزاء.';
              throw uploadErr;
            }
            throw uploadErr;
          }
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
        // C04: upload completion only marks media ready in draft — never auto-publish.
        // Developer direct publish remains available via the explicit publish button.
        if (developerAccount) {
          status.textContent = 'رُفع الملف وأصبح جاهزًا في المسودة. اضغط «نشر الآن» لنشره.';
        } else {
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
        } else if (error && error.code === 'verify_pending') {
          entry.status = 'جارٍ التحقق';
          entry.error = '';
          status.textContent = 'انتهى انتظار الواجهة والتحقق مستمر على الخادم — أعد المحاولة دون إعادة الرفع.';
        } else if (error && error.code === 'file_mismatch') {
          entry.status = 'فشل';
          entry.error = error.message || 'الملف لا يطابق جلسة الرفع';
          entry.uploadSessionId = null;
          status.textContent = entry.error;
        } else {
          entry.status = 'فشل';
          entry.error = error.message || 'فشل الرفع';
          status.textContent = developerAccount ? 'فشل الرفع ولم يُنشر: ' + entry.error : 'فشل الرفع وبقيت المسودة: ' + entry.error;
        }
        // Paint chrome/cards immediately so «إعادة المحاولة» is bound before async preview returns.
        syncMedia(entry);
        if (window.MiraMotion) MiraMotion.announce(status.textContent);
      } finally {
        entry._uploadBusy = false;
      }
      paintMedia(null);
    }

    paintMedia(null);

    submit.onclick = async () => {
      // Explicit publish / submit-review only — never from file select.
      if (!item || !item.id) {
        if (developerAccount) {
          await persistListing({ publish: true });
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
      // Advanced JSON fields exist only for developer accounts — brand uses structured UI.
      const advancedOn = Boolean(
        optionsJsonInput &&
          optionsJsonInput._advancedToggle &&
          optionsJsonInput._advancedToggle.checked,
      );
      if (advancedOn && optionsJsonInput && variantsJsonInput) {
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

    /**
     * Persist listing fields (+ optional staged uploads).
     * @param {{ publish?: boolean }} [opts]
     *   publish=true  → developer may call submitReview after successful save/upload (explicit «نشر الآن»).
     *   publish=false → draft/media only (file select, retry, autosave). Never submitReview.
     */
    const persistListing = async (opts) => {
      const wantPublish = !!(opts && opts.publish === true);
      if (form.dataset.saving === '1') return false;

      const persistOp = capturePersistOp();
      const liveOwnerId = resolveOwnerId();

      // v2 without an owned item: draft autosave only (brand/salon/clinic).
      // Developer accounts fall through to createProduct/createService so «نشر الآن» can complete
      // without being trapped in draft-only flush (R02). Once targetOwnerId/item.id exists, never create again.
      const partnerIsDeveloper = !!(window.sessionPartner && window.sessionPartner.type === 'developer');
      if (window.MiraEditorV2 && MiraEditorV2.state.enabled && !liveOwnerId && !partnerIsDeveloper) {
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
        const firstBad =
          ['nameAr', 'priceSar', 'category', 'externalUrl', 'durationMin', 'stockQty', 'deliveryFeeSar', 'optionsJson', 'variantsJson']
            .find((name) => {
              const err = form.querySelector('[data-field-error="' + name + '"], [data-error-for="' + name + '"]');
              return err && err.textContent && !err.hidden;
            }) ||
          (nameAr.value.trim().length < 2 ? 'nameAr' : null) ||
          (!category.value ? 'category' : null) ||
          'nameAr';
        revealInvalidInMobileStep(firstBad);
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
        if (subcategory && subcategory.value) {
          payload.subcategory = subcategory.value;
        }
        // Never invent subcategory; never send profileId unless user explicitly manages it (E1).
        if (attrMount && typeof attrMount.hasBlockingErrors === 'function' && attrMount.hasBlockingErrors()) {
          const v = attrMount.validate();
          (v.errors || []).forEach((fe) => setFieldError(form, fe.fieldId, fe.message));
          const firstAttr = (v.errors && v.errors[0] && v.errors[0].fieldId) || 'attributes';
          revealInvalidInMobileStep(firstAttr);
          status.textContent = 'لم يُرسل الحفظ. أصلحي قيم الخصائص الرقمية. البيانات ما زالت في النموذج.';
          setAttrSaveKind('error', 'تحقق الخصائص فشل');
          return false;
        }
        if (attrMount && typeof attrMount.getAttributesPatch === 'function' && attrMount.hasDirty()) {
          payload.attributes = attrMount.getAttributesPatch();
        }
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
        const placeModeEl = form.querySelector('[name="placeMode"]');
        const branchEl = form.querySelector('[name="branchId"]');
        if (placeModeEl && String(placeModeEl.value || '').trim()) {
          payload.placeMode = String(placeModeEl.value).trim();
        }
        // Home/remote must clear branch even if the select was unmounted from placeDetails.
        if (payload.placeMode && payload.placeMode !== 'branch') {
          payload.branchId = null;
        } else if (branchEl) {
          payload.branchId = String(branchEl.value || '').trim() || null;
        }
        if (availabilityJson && typeof availabilityJson.build === 'function') {
          try {
            setFieldError(form, 'availabilityJson', '');
            payload.availabilityJson = availabilityJson.build();
            if (availabilityJson.unifyToggle && availabilityJson.unifyToggle.checked) {
              payload.unifySharedResources = true;
            }
          } catch (error) {
            const msg = error.message || 'أصلحي جدول التوفر.';
            setFieldError(form, 'availabilityJson', msg);
            status.textContent = 'لم يُرسل الحفظ. ' + msg;
            return false;
          }
        }
        // Optimistic concurrency for service basics — same tip as profile bind / last paint.
        const tipRev =
          boundServiceReviewRevision != null
            ? boundServiceReviewRevision
            : item && item.reviewRevision != null
              ? item.reviewRevision
              : null;
        if (tipRev != null && Number.isFinite(Number(tipRev))) {
          payload.expectedRevision = Number(tipRev);
        }
      }
      const idleLabel = save.textContent;
      beginPersistBusy(persistOp, developerAccount ? 'جارٍ النشر' : 'جارٍ الحفظ');
      status.textContent = wantPublish && developerAccount ? 'جارٍ النشر في التطبيق' : 'جارٍ حفظ المسودة';
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
        const attrRevAtSend =
          attrMount && typeof attrMount.getEditRevision === 'function' ? attrMount.getEditRevision() : 0;
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
        // After profile put, reviewRevision tip advanced — basics must send the new tip, not the pre-put tip.
        if (type !== 'brand' && ownerId && basicsPayload.expectedRevision != null) {
          if (boundServiceReviewRevision != null) {
            basicsPayload = Object.assign({}, basicsPayload, {
              expectedRevision: Number(boundServiceReviewRevision),
            });
          }
        }

        let saved;
        try {
          saved = ownerId
            ? await (type === 'brand'
                ? PartnersApi.updateProduct(ownerId, basicsPayload)
                : PartnersApi.updateService(ownerId, basicsPayload))
            : await (type === 'brand'
                ? PartnersApi.createProduct(basicsPayload)
                : PartnersApi.createService(basicsPayload));
        } catch (basicsErr) {
          const code = (basicsErr && basicsErr.code) || '';
          const bodyCode =
            (basicsErr && basicsErr.body && (basicsErr.body.code || (basicsErr.body.message && basicsErr.body.message.code))) ||
            '';
          const blob = String((basicsErr && basicsErr.message) || '') + ' ' + code + ' ' + bodyCode;
          if (
            code === 'SERVICE_REVISION_CONFLICT' ||
            bodyCode === 'SERVICE_REVISION_CONFLICT' ||
            /SERVICE_REVISION_CONFLICT/.test(blob)
          ) {
            releasePersistBusyIfOwned(persistOp, idleLabel);
            status.textContent =
              'تعارض مراجعة الخدمة مع نسخة أحدث. تعديلاتك ما زالت في النموذج — لم نكتب فوق الخادم.';
            status.setAttribute('data-service-revision-conflict', '1');
            if (window.MiraEditorV2) {
              MiraEditorV2.setStatus(form, 'تعارض مراجعة الخدمة', 'conflict');
            }
            showServiceProfileConflictUi(ownerId);
            return {
              ok: false,
              conflict: true,
              code: 'SERVICE_REVISION_CONFLICT',
              basicsSaved: false,
              published: false,
              id: ownerId || null,
            };
          }
          throw basicsErr;
        }
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
        if (type === 'brand' && attrMount && saved) {
          const attrsLive =
            saved.draftTaxonomySet && saved.draftAttributesJson != null
              ? saved.draftAttributesJson
              : saved.attributesJson;
          const attrRevNow =
            typeof attrMount.getEditRevision === 'function' ? attrMount.getEditRevision() : 0;
          const attrsUnchangedSinceSend =
            formContentEpoch === persistEpoch && attrRevNow === attrRevAtSend;
          if (attrsUnchangedSinceSend && typeof attrMount.setFromAttributes === 'function') {
            withProgrammaticPaint(function () {
              attrMount.setFromAttributes(attrsLive || {});
            });
            setAttrSaveKind('saved', 'خصائص محفوظة');
          } else if (typeof attrMount.applyServerSnapshot === 'function') {
            // Stale response must not clobber newer in-form attribute edits.
            withProgrammaticPaint(function () {
              attrMount.applyServerSnapshot(attrsLive || {}, { onlyClean: true });
            });
            if (attrMount.hasDirty && attrMount.hasDirty()) {
              setAttrSaveKind('dirty', 'خصائص أحدث لم تُحفظ بعد — الرد القديم لم يُطبَّق عليها');
            } else {
              setAttrSaveKind('saved', 'خصائص محفوظة');
            }
          } else if (attrMount.hasDirty && attrMount.hasDirty()) {
            setAttrSaveKind('dirty', 'خصائص أحدث لم تُحفظ بعد');
          } else {
            setAttrSaveKind('saved', 'خصائص محفوظة');
          }
        }
        let inventoryConflict = false;
        let inventoryPartialOther = false;
        if (type === 'brand' && saved && saved.id) {
          try {
            await persistVariantInventory(saved.id);
            status.removeAttribute('data-inventory-revision-conflict');
            status.removeAttribute('data-inventory-partial');
          } catch (invErr) {
            const code = invErr && invErr.code;
            const bodyCode =
              (invErr && invErr.body && (invErr.body.code || (invErr.body.message && invErr.body.message.code))) ||
              '';
            const blob = String((invErr && invErr.message) || '') + ' ' + code + ' ' + bodyCode;
            const isInvRevConflict =
              code === 'VARIANT_INVENTORY_REVISION_CONFLICT' ||
              bodyCode === 'VARIANT_INVENTORY_REVISION_CONFLICT' ||
              /VARIANT_INVENTORY_REVISION_CONFLICT|تعارض مراجعة مخزون/.test(blob);
            if (isInvRevConflict) {
              // Keep local dirty qty + expectedRevision the user read — never auto-rewrite.
              inventoryConflict = true;
              status.textContent =
                'حُفظت البيانات الأساسية، لكن مخزون التركيبات لم يُحفظ بسبب تعارض مراجعة. تعديلاتك المحلية ما زالت في النموذج.';
              status.setAttribute('data-inventory-partial', '1');
              status.setAttribute('data-inventory-revision-conflict', '1');
              status.setAttribute('data-catalog-persist-status', 'partial-inventory-conflict');
            } else if (code === 'INVENTORY_NOT_READY' || code === 'INVENTORY_CONTEXT_MISMATCH' || code === 'INVENTORY_INVALID_QTY') {
              inventoryPartialOther = true;
              status.textContent =
                'حُفظت بيانات المنتج دون تحديث المخزون: ' +
                ((invErr && invErr.message) || 'المخزون غير جاهز') +
                ' تعديلات المخزون ما زالت في النموذج.';
              status.setAttribute('data-inventory-partial', '1');
            } else {
              inventoryPartialOther = true;
              status.textContent =
                'حُفظ المنتج لكن مخزون التركيبات لم يُحدَّث: ' +
                ((invErr && invErr.message) || 'خطأ غير معروف');
              status.setAttribute('data-inventory-partial', '1');
            }
          }
        }
        // Inventory revision conflict: stop the full success path — no is-success, no submitReview, no renderForm wipe.
        if (inventoryConflict) {
          if (!assertPersistOpLive(persistOp)) return false;
          item = Object.assign({}, item || {}, saved);
          staged[form.id].ownerId = item.id;
          const ctxAfterConflict = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
          if (ctxAfterConflict && item.id && assertPersistOpLive(persistOp)) {
            if (!persistOp.clientDraftId || ctxAfterConflict.clientDraftId === persistOp.clientDraftId) {
              ctxAfterConflict.targetOwnerId = item.id;
            }
          }
          releasePersistBusyIfOwned(persistOp, idleLabel);
          save.classList.remove('is-success', 'is-busy');
          save.disabled = false;
          save.removeAttribute('aria-busy');
          if (window.MiraEditorV2) {
            MiraEditorV2.setStatus(form, 'حفظ جزئي · تعارض مخزون', 'error');
          }
          if (window.MiraMotion) MiraMotion.announce(status.textContent);
          lastSettledPersistEpoch = persistEpoch;
          return {
            ok: false,
            partial: true,
            inventoryConflict: true,
            basicsSaved: true,
            published: false,
            id: item.id,
          };
        }
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
        if (inventoryPartialOther) {
          saveNote =
            (status.textContent || saveNote) +
            ' لن يُعلن نجاحًا كاملًا ولن يُنشر هذا الحفظ تلقائيًا.';
        }
        if (newerEditsPending) {
          saveNote +=
            ' توجد تعديلات أحدث في النموذج لم يشملها هذا الطلب — ليست محفوظة بعد. احفظي مرة أخرى للإصدار الحالي.';
          if (window.MiraEditorV2) {
            MiraEditorV2.setStatus(form, 'محفوظ جزئيًا · تعديلات أحدث غير محفوظة', 'dirty');
          }
          status.setAttribute('data-unsaved-newer', '1');
        }
        status.textContent =
          inventoryPartialOther
            ? saveNote
            : developerAccount
              ? newerEditsPending
                ? saveNote
                : 'جارٍ رفع الملفات ثم النشر في التطبيق.'
              : saveNote;
        status.setAttribute('data-catalog-persist-status', inventoryPartialOther ? 'partial-inventory' : '1');
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
        // C04: submitReview only on explicit publish intent — never from file-select draft persist.
        // Inventory conflict already returned above; other inventory partials must not publish either.
        if (
          wantPublish &&
          window.sessionPartner &&
          window.sessionPartner.type === 'developer' &&
          !failures.length &&
          item &&
          item.id &&
          !newerEditsPending &&
          !inventoryPartialOther
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
              const matOk = form.querySelector('[data-editor-v2-materialize="1"]');
              if (matOk) matOk.dataset.resumeActive = '0';
              if (typeof form._miraApplyFinalCtaPolicy === 'function') form._miraApplyFinalCtaPolicy();
              await refreshLists();
            }
          } catch (error) {
            publishedNote = 'حُفظت البيانات ولم تُنشر: ' + error.message;
            // FIN-01: publish failure after the item exists must surface a real resume CTA
            // (app-painted — not a silent status-only note).
            const matFail = form.querySelector('[data-editor-v2-materialize="1"]');
            if (matFail) {
              matFail.dataset.resumeActive = '1';
              matFail.textContent = developerAccount ? 'استئناف النشر' : 'استئناف الإرسال للمراجعة';
            }
            const ctxFail = window.MiraEditorV2 && MiraEditorV2.getEditContext(form.id);
            if (ctxFail && item && item.id) {
              ctxFail.targetOwnerId = item.id;
              ctxFail.status = 'submit_failed';
              ctxFail.submitReviewStatus = 'failed';
            }
            if (typeof form._miraApplyFinalCtaPolicy === 'function') form._miraApplyFinalCtaPolicy();
          }
        } else if (!wantPublish && developerAccount && !failures.length && item && item.id) {
          publishedNote = 'حُفظت المسودة والوسائط. اضغط «نشر الآن» لنشرها في التطبيق.';
        }
        if (!assertPersistOpLive(persistOp)) return false;
        newerEditsPending = hasNewerEditsThan(persistEpoch);
        const noteOut = failures.length
          ? (wantPublish && developerAccount ? 'لم يُنشر. فشل الرفع. ' : 'حُفظت المسودة. لم يُسجَّل الرفع ناجحًا. ') + failures.join(' — ')
          : (publishedNote || saveNote);
        // F2: if the user typed newer edits mid-flight, keep the live DOM — do not re-render from the old response.
        if (newerEditsPending) {
          applyPersistSuccessChrome(true, { finalize: true });
          paintUnsavedNewerNotice(noteOut);
          lastSettledPersistEpoch = persistEpoch;
          return true;
        }
        lastSettledPersistEpoch = formContentEpoch;
        applyPersistSuccessChrome(false, { finalize: true });
        if (inventoryPartialOther) {
          save.classList.remove('is-success');
          status.textContent = saveNote;
          status.setAttribute('data-inventory-partial', '1');
          return {
            ok: false,
            partial: true,
            inventoryConflict: false,
            basicsSaved: true,
            published: false,
            id: item && item.id,
          };
        }
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
      // Publish only when developer final CTA is «نشر الآن» (not during resume/draft-save).
      const publish =
        !!developerAccount &&
        save.dataset.ctaRole === 'final' &&
        /نشر الآن/.test(save.textContent || '') &&
        !resumeNeededFromContext();
      return Promise.resolve(persistListing({ publish })).catch((err) => {
        status.textContent =
          'تعذر الحفظ: ' + ((err && (err.messageAr || err.message)) || String(err));
        return false;
      });
    };

    // E2ب: split fields ↔ video after the full form tree exists; re-sync taxonomy circles.
    if (type === 'brand' && window.MiraE2BProductShell) {
      try {
        if (typeof MiraE2BProductShell.composeCatalogLayout === 'function') {
          MiraE2BProductShell.composeCatalogLayout();
        }
        if (typeof MiraE2BProductShell.syncFromForm === 'function') {
          MiraE2BProductShell.syncFromForm();
        }
      } catch (_) {
        /* non-fatal shell enhance */
      }
    }
    // E2ج: دوائر الخدمة + compose منفصل عن المنتجات/المخزون.
    if (type !== 'brand' && window.MiraE2BServiceShell) {
      try {
        if (typeof MiraE2BServiceShell.enableServiceMode === 'function') {
          MiraE2BServiceShell.enableServiceMode(form.id);
        }
        if (typeof MiraE2BServiceShell.composeServiceLayout === 'function') {
          MiraE2BServiceShell.composeServiceLayout(form);
        }
        if (typeof MiraE2BServiceShell.syncFromForm === 'function') {
          MiraE2BServiceShell.syncFromForm(form);
        }
      } catch (_) {
        /* non-fatal service shell */
      }
    }
    // Re-apply after compose so legacy submit cannot reappear beside materialize.
    if (typeof form._miraApplyFinalCtaPolicy === 'function') form._miraApplyFinalCtaPolicy();
  }
})();
