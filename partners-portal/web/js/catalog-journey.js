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

  function mediaProblem(file) {
    const image = IMAGE_TYPES.indexOf(file.type) >= 0;
    const video = file.type === 'video/mp4';
    if (!image && !video) return 'الصيغة غير مقبولة. الصور: JPEG أو PNG أو WebP. الفيديو: MP4.';
    if (image && file.size > 5 * 1024 * 1024) return 'الصورة أكبر من 5 ميغابايت.';
    if (video && file.size > 20 * 1024 * 1024) return 'الفيديو أكبر من 20 ميغابايت.';
    return '';
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(reader.error);
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

  window.CatalogJourney = {
    formatPrice: formatPrice,
    renderCatalog: renderCatalog,
    renderForm: renderForm,
    refreshLists: refreshLists,
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
        document.getElementById(formId).scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  function renderForm(type, item, formId, titleId, note) {
    const form = document.getElementById(formId || 'catalogForm');
    const title = document.getElementById(titleId || 'catalogTitle');
    const fullCatalog = !document.getElementById('serviceSection').classList.contains('hidden');
    if (title && !fullCatalog) title.textContent = type === 'brand' ? 'منتجاتك' : 'خدماتك';
    const previous = staged[form.id] || [];
    const sameItem = item && previous.ownerId === item.id;
    staged[form.id] = sameItem ? previous : [];
    if (item) staged[form.id].ownerId = item.id;
    form.replaceChildren();

    const editing = Boolean(item && item.id);
    const status = text(form, note || (editing
      ? 'مسودة على المعرف نفسه. السعر الظاهر ' + formatPrice(item.priceHalalas) + ' ويخزَّن ' + item.priceHalalas + ' هللة. التعديل لا ينشر قبل اعتماد الإدارة.'
      : 'مسودة جديدة. لا يُطلب رابط متجر، والسعر يُكتب بالريال.'));
    if (item && item.reviewNote) text(form, 'سبب المراجعة: ' + item.reviewNote);
    if (item && item.draftNameAr) text(form, 'اسم المسودة: ' + item.draftNameAr + ' · المنشور: ' + (item.nameAr || ''));

    const basics = document.createElement('div');
    basics.className = 'form-section';
    text(basics, 'البيانات الأساسية', 'h3');
    form.appendChild(basics);
    const nameAr = field(basics, 'الاسم', 'nameAr', editing ? (item.draftNameAr || item.nameAr) : '', 'text');
    field(basics, 'الاسم بالإنجليزية (اختياري)', 'nameEn', editing ? (item.draftNameEn != null ? item.draftNameEn : (item.nameEn || '')) : '', 'text');
    field(basics, 'الوصف', 'descriptionAr', editing ? (item.draftDescriptionAr != null ? item.draftDescriptionAr : (item.descriptionAr || '')) : '', 'textarea');
    const categories = type === 'brand' ? PRODUCT_CATEGORIES : SERVICE_CATEGORIES;
    const category = selectField(basics, 'التصنيف', 'category', editing ? (item.category || '') : '', categories);
    const price = field(basics, 'السعر بالريال', 'priceSar', editing ? halalasToInput(item.priceHalalas) : '', 'text');
    price.inputMode = 'decimal';
    price.placeholder = '52';

    const cosmetic = document.createElement('div');
    const skin = field(cosmetic, 'نوع البشرة (اختياري)', 'skinTypes', editing ? (item.skinTypes || []).join(', ') : '', 'text');
    const step = field(cosmetic, 'خطوة الروتين (اختياري)', 'stepAr', editing ? (item.stepAr || '') : '', 'text');
    if (type === 'brand') basics.appendChild(cosmetic);

    let duration = null;
    if (type !== 'brand') {
      duration = field(basics, 'المدة بالدقائق (اختياري)', 'durationMin', editing && item.durationMin ? item.durationMin : '', 'number');
      duration.min = '5';
      const partner = window.sessionPartner || {};
      text(basics, 'الفرع والمدينة المسجّلة: ' + (partner.city || 'غير مسجّلة') + '. لا توجد إحداثيات فرع.');
      text(basics, partner.contactPhone ? 'وسيلة التواصل: ' + partner.contactPhone : 'لا توجد وسيلة تواصل مسجّلة على حساب الجهة.');
    }

    const mediaSection = document.createElement('div');
    mediaSection.className = 'form-section';
    text(mediaSection, 'الصور والفيديو', 'h3');
    text(mediaSection, 'الصور: JPEG أو PNG أو WebP حتى 5 ميغابايت. الفيديو: MP4 حتى 20 ميغابايت. يمكن اختيار أكثر من ملف. الغلاف صورة واحدة، والباقي للتفاصيل.');
    const images = document.createElement('input');
    images.type = 'file';
    images.accept = 'image/jpeg,image/png,image/webp';
    images.multiple = true;
    const videos = document.createElement('input');
    videos.type = 'file';
    videos.accept = 'video/mp4';
    videos.multiple = true;
    const imageLabel = document.createElement('label');
    imageLabel.textContent = 'اختيار صور';
    const videoLabel = document.createElement('label');
    videoLabel.textContent = 'اختيار فيديو';
    const mediaBox = document.createElement('div');
    mediaSection.append(imageLabel, images, videoLabel, videos, mediaBox);
    form.appendChild(mediaSection);

    const detail = document.createElement('div');
    detail.className = 'form-section';
    text(detail, 'التفاصيل', 'h3');
    const tags = field(detail, 'وسوم اختيارية', 'concernTags', editing ? (item.concernTags || []).join(', ') : '', 'text');
    form.appendChild(detail);

    const action = document.createElement('div');
    action.className = 'form-section';
    text(action, 'الإجراء', 'h3');
    form.appendChild(action);
    let url = null;
    if (type === 'brand') {
      const choices = document.createElement('div');
      choices.className = 'choice-row';
      choices.append(choice('purchaseMode', 'none', 'بدون شراء الآن', true), choice('purchaseMode', 'link', 'شراء عبر رابط', false), choice('purchaseMode', 'contact', 'تواصل', false));
      action.appendChild(choices);
      url = field(action, 'رابط الشراء (فقط عند اختيار الرابط)', 'externalUrl', editing && item.externalUrl ? item.externalUrl : '', 'url');
      url.required = false;
      if (editing && validUrl(item.externalUrl)) choices.querySelector('input[value="link"]').checked = true;
    }

    const preview = document.createElement('div');
    preview.className = 'form-section';
    text(preview, 'المعاينة والنشر', 'h3');
    const previewBody = text(preview, '');
    form.appendChild(preview);

    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'btn btn-primary';
    save.textContent = 'حفظ المسودة';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn btn-ghost';
    submit.textContent = 'إرسال للمراجعة';
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
    category.onchange = cosmeticVisible;
    cosmeticVisible();

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

    function addStaged(fileList) {
      Array.from(fileList || []).forEach((file) => {
        const problem = mediaProblem(file);
        const entry = {
          file: file,
          status: problem ? 'فشل' : (item && item.id ? 'جارٍ الرفع' : 'بانتظار الحفظ'),
          error: problem,
          url: URL.createObjectURL(file),
        };
        staged[form.id].push(entry);
        if (!problem && item && item.id) uploadOne(entry);
      });
      paintMedia(null);
    }
    images.onchange = () => { addStaged(images.files); images.value = ''; };
    videos.onchange = () => { addStaged(videos.files); videos.value = ''; };

    async function paintMedia(serverMedia) {
      mediaBox.replaceChildren();
      const rows = staged[form.id];
      rows.forEach((entry, index) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        text(card, entry.file.name + ' · ' + entry.status + (entry.error ? ' · ' + entry.error : ''));
        const view = document.createElement(entry.file.type === 'video/mp4' ? 'video' : 'img');
        view.src = entry.url;
        if (entry.file.type === 'video/mp4') view.controls = true;
        card.appendChild(view);
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'إعادة المحاولة';
        retry.disabled = !item || !item.id || !entry.error;
        retry.onclick = () => uploadOne(entry);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'إزالة';
        remove.onclick = () => {
          URL.revokeObjectURL(entry.url);
          rows.splice(index, 1);
          paintMedia(serverMedia);
        };
        const up = document.createElement('button');
        up.type = 'button';
        up.textContent = 'أعلى';
        up.disabled = index === 0;
        up.onclick = () => {
          const swap = rows[index - 1];
          rows[index - 1] = rows[index];
          rows[index] = swap;
          paintMedia(serverMedia);
        };
        card.append(up, retry, remove);
        mediaBox.appendChild(card);
      });
      if (!item || !item.id) {
        text(mediaBox, 'الرفع يبدأ بعد حفظ المسودة. الملفات المختارة تبقى هنا.');
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
        text(card, (row.kind === 'video' ? 'فيديو محفوظ' : 'صورة محفوظة') + (primary ? ' · غلاف' : ' · تفاصيل') + ' · ' + (row.publication || 'draft') + (row.pendingRemoval ? ' · طلب إزالة' : ''));
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
        up.disabled = index === 0;
        up.onclick = async () => {
          const order = ids.slice();
          const swap = order[index - 1];
          order[index - 1] = order[index];
          order[index] = swap;
          await PartnersApi.reorderMedia(type === 'brand' ? 'products' : 'services', item.id, order);
          paintMedia(null);
        };
        const cover = document.createElement('button');
        cover.type = 'button';
        cover.textContent = 'غلاف';
        cover.disabled = row.kind !== 'image';
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
        mediaBox.appendChild(card);
      });
    }

    async function uploadOne(entry) {
      const problem = mediaProblem(entry.file);
      if (problem) {
        entry.status = 'فشل';
        entry.error = problem;
        paintMedia(null);
        return;
      }
      if (!item || !item.id) {
        entry.status = 'بانتظار الحفظ';
        paintMedia(null);
        return;
      }
      entry.status = 'جارٍ الرفع';
      entry.error = '';
      paintMedia(null);
      try {
        const dataBase64 = await fileToBase64(entry.file);
        await PartnersApi.addMedia(type === 'brand' ? 'products' : 'services', item.id, entry.file.type, dataBase64);
        entry.status = 'رُفع';
        entry.error = '';
        URL.revokeObjectURL(entry.url);
        const at = staged[form.id].indexOf(entry);
        if (at >= 0) staged[form.id].splice(at, 1);
        status.textContent = 'رُفع الملف ورُبط بالمسودة. لن يظهر في التطبيق قبل الاعتماد.';
      } catch (error) {
        entry.status = 'فشل';
        entry.error = error.message || 'فشل الرفع';
        status.textContent = 'فشل الرفع وبقيت المسودة: ' + entry.error;
      }
      paintMedia(null);
    }

    paintMedia(null);

    submit.onclick = async () => {
      if (!item || !item.id) {
        status.textContent = 'احفظي المسودة قبل الإرسال للمراجعة.';
        return;
      }
      status.textContent = 'جارٍ التحقق ثم الإرسال';
      try {
        await PartnersApi.submitReview(type === 'brand' ? 'products' : 'services', item.id);
        status.textContent = 'أُرسل للمراجعة. لن يظهر في التطبيق قبل اعتماد الإدارة.';
        if (window.reloadPartnerDashboard) await window.reloadPartnerDashboard({ preserveForms: true });
      } catch (error) {
        status.textContent = 'تعذر الإرسال: ' + error.message;
      }
    };

    form.onsubmit = async (event) => {
      event.preventDefault();
      ['nameAr', 'priceSar', 'category', 'externalUrl', 'durationMin'].forEach((name) => setFieldError(form, name, ''));
      let blocked = false;
      if (nameAr.value.trim().length < 2) {
        setFieldError(form, 'nameAr', 'الاسم مطلوب.');
        blocked = true;
      }
      const halalas = riyalsToHalalas(price.value);
      if (halalas == null) {
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
      if (blocked) {
        status.textContent = 'لم يُرسل الحفظ. البيانات التي كتبتها ما زالت في النموذج.';
        return;
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
        if (cosmeticVisible()) {
          payload.skinTypes = skin.value.split(',').map((part) => part.trim()).filter(Boolean);
          payload.stepAr = step.value.trim();
        } else {
          payload.skinTypes = [];
          payload.stepAr = '';
        }
      } else if (duration && duration.value) {
        payload.durationMin = parseInt(duration.value, 10);
      }
      save.disabled = true;
      status.textContent = 'جارٍ حفظ المسودة';
      try {
        const saved = editing
          ? await (type === 'brand' ? PartnersApi.updateProduct(item.id, payload) : PartnersApi.updateService(item.id, payload))
          : await (type === 'brand' ? PartnersApi.createProduct(payload) : PartnersApi.createService(payload));
        item = Object.assign({}, item || {}, saved);
        staged[form.id].ownerId = item.id;
        status.textContent = 'حُفظت المسودة. السعر المخزن ' + item.priceHalalas + ' هللة (' + formatPrice(item.priceHalalas) + ').';
        await refreshLists();
        const pending = staged[form.id].slice();
        for (const entry of pending) {
          if (!entry.error) await uploadOne(entry);
        }
        const failures = staged[form.id].filter((entry) => entry && entry.error).map((entry) => entry.file.name + ': ' + entry.error);
        renderForm(type, item, form.id, titleId, failures.length ? 'حُفظت المسودة. لم يُسجَّل الرفع ناجحًا. ' + failures.join(' — ') : '');
      } catch (error) {
        status.textContent = 'تعذر الحفظ: ' + error.message + ' البيانات المكتوبة ما زالت في النموذج.';
        save.disabled = false;
      }
    };
  }
})();
