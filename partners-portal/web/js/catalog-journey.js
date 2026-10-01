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
    const categories = type === 'brand'
      ? PRODUCT_CATEGORIES
      : (type === 'clinic' ? CLINIC_CATEGORIES : (type === 'salon' ? SALON_CATEGORIES : SERVICE_CATEGORIES));
    const category = selectField(basics, 'التصنيف', 'category', editing ? (item.category || '') : '', categories);
    const price = field(basics, 'السعر بالريال', 'priceSar', editing ? halalasToInput(item.priceHalalas) : '', 'text');
    price.inputMode = 'decimal';
    price.placeholder = '52';

    const cosmetic = document.createElement('div');
    const skin = field(cosmetic, 'نوع البشرة (اختياري)', 'skinTypes', editing ? (item.skinTypes || []).join(', ') : '', 'text');
    const step = field(cosmetic, 'خطوة الروتين (اختياري)', 'stepAr', editing ? (item.stepAr || '') : '', 'text');
    if (type === 'brand') basics.appendChild(cosmetic);

    let duration = null;
    let bookingToggle = null;
    let availabilityJson = null;
    if (type !== 'brand') {
      duration = field(basics, 'المدة بالدقائق (اختياري)', 'durationMin', editing && item.durationMin ? item.durationMin : '', 'number');
      duration.min = '5';
      const partner = window.sessionPartner || {};
      text(basics, 'الفرع والمدينة المسجّلة: ' + (partner.city || 'غير مسجّلة') + '. لا توجد إحداثيات فرع.');
      text(basics, partner.contactPhone ? 'وسيلة التواصل: ' + partner.contactPhone : 'لا توجد وسيلة تواصل مسجّلة على حساب الجهة.');
      const bookingWrap = document.createElement('label');
      bookingWrap.className = 'check-row';
      bookingToggle = document.createElement('input');
      bookingToggle.type = 'checkbox';
      bookingToggle.name = 'bookingEnabled';
      bookingToggle.checked = Boolean(editing && item.bookingEnabled);
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
        on.onchange = () => { availState[weekday].on = on.checked; };
        const start = document.createElement('input');
        start.type = 'time';
        start.value = availState[weekday].start;
        start.onchange = () => { availState[weekday].start = start.value; };
        const end = document.createElement('input');
        end.type = 'time';
        end.value = availState[weekday].end;
        end.onchange = () => { availState[weekday].end = end.value; };
        const cap = document.createElement('input');
        cap.type = 'number';
        cap.min = '1';
        cap.max = '100';
        cap.value = availState[weekday].capacity;
        cap.style.width = '4rem';
        cap.onchange = () => { availState[weekday].capacity = cap.value; };
        const res = document.createElement('input');
        res.type = 'text';
        res.placeholder = 'مورد/فرع (اختياري)';
        res.value = availState[weekday].resourceId;
        res.onchange = () => { availState[weekday].resourceId = res.value.trim(); };
        row.append(on, document.createTextNode(' ' + name + ' '), start, document.createTextNode(' — '), end, document.createTextNode(' سعة '), cap, res);
        availBox.appendChild(row);
      });
      basics.appendChild(availBox);
      availabilityJson = {
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

    const templateState = loadServiceTemplateDraft(editing ? item.id : null);

    function loadServiceTemplateDraft(id) {
      try {
        const raw = localStorage.getItem('mira-service-template:' + (id || 'new'));
        if (!raw) return { templateId: '', answers: {}, priceMode: 'fixed' };
        return Object.assign({ templateId: '', answers: {}, priceMode: 'fixed' }, JSON.parse(raw));
      } catch (error) {
        return { templateId: '', answers: {}, priceMode: 'fixed' };
      }
    }

    function saveServiceTemplateDraft() {
      const key = 'mira-service-template:' + ((item && item.id) || 'new');
      localStorage.setItem(key, JSON.stringify(templateState));
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
      text(templatePreview, 'طريقة السعر: ' + (templateState.priceMode || 'fixed') + ' · الخصائص تُحفظ محليًا مع المسودة.');
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

    const previousCategoryOnChange = category.onchange;
    category.onchange = function () {
      if (previousCategoryOnChange) previousCategoryOnChange();
      if (type !== 'brand') paintServiceTemplates();
    };
    if (type !== 'brand') paintServiceTemplates();

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
    form.insertBefore(templateSection, mediaSection);

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
      if (editing && validUrl(item.externalUrl)) choices.querySelector('input[value="link"]').checked = true;

      // Operational commerce: in-Mira cart + cash on delivery. External URL stays the default.
      text(action, 'الشراء داخل ميرا (الدفع عند الاستلام)', 'h4');
      const internal = document.createElement('label');
      internalToggle = document.createElement('input');
      internalToggle.type = 'checkbox';
      internalToggle.name = 'internalCod';
      internalToggle.checked = Boolean(editing && item.purchaseMode === 'internal_cod');
      internal.append(internalToggle, document.createTextNode(' تفعيل الطلب داخل ميرا (دفع نقدًا عند الاستلام). رابط الشراء الخارجي يبقى للمنتجات الخارجية فقط.'));
      action.appendChild(internal);
      stockInput = field(action, 'المخزون (اتركيه فارغًا إذا لا يُتتبع)', 'stockQty', editing && item.stockQty != null ? item.stockQty : '', 'number');
      stockInput.min = '0';
      stockInput.step = '1';
      feeInput = field(action, 'رسوم التوصيل بالريال (اتركيها فارغة إذا غير محددة، ولا تُعرض كمجانية)', 'deliveryFeeSar', editing && item.deliveryFeeHalalas != null ? halalasToInput(item.deliveryFeeHalalas) : '', 'text');
      feeInput.inputMode = 'decimal';
      optionsJsonInput = field(action, 'خيارات المنتج JSON (اختياري، متقدم)', 'optionsJson', editing && item.optionsJson ? JSON.stringify(item.optionsJson) : '', 'textarea');
      optionsJsonInput.placeholder = '[{"id":"size","labelAr":"المقاس","kind":"size","values":[{"id":"m","labelAr":"M"}]}]';
      variantsJsonInput = field(action, 'التركيبات JSON (اختياري، متقدم)', 'variantsJson', editing && item.variantsJson ? JSON.stringify(item.variantsJson) : '', 'textarea');
      variantsJsonInput.placeholder = '[{"id":"m-black","selections":{"size":"m"},"priceHalalas":5200,"available":true}]';
      text(action, 'الطلب داخل ميرا يتطلب سعرًا أكبر من صفر. تغيير هذه الحقول يسري مباشرة على المنتج المنشور ولا يمر بمراجعة المحتوى.');
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
    category.onchange = function () {
      cosmeticVisible();
      if (type === 'brand') paintOptions();
      else paintServiceTemplates();
    };
    cosmeticVisible();

    const optionsSection = document.createElement('div');
    optionsSection.className = 'form-section';
    optionsSection.hidden = type !== 'brand';
    text(optionsSection, 'خيارات المنتج', 'h3');
    text(optionsSection, 'الحقول تتغير حسب التصنيف. الخيارات الجاهزة اقتراحات فقط وليست محددة تلقائيًا. التركيبات المتاحة تُختار يدويًا دون إنشاء كل الاحتمالات.');
    const optionsBody = document.createElement('div');
    const optionsPreview = document.createElement('div');
    optionsPreview.className = 'options-preview';
    optionsSection.append(optionsBody, optionsPreview);
    form.insertBefore(optionsSection, mediaSection);

    const optionsState = optionsStateFromServer(editing ? item : null);

    function optionPresets(cat) {
      if (cat === 'clothes') {
        return {
          groups: [
            { id: 'size', label: 'المقاس', kind: 'size', presets: ['XS', 'S', 'M', 'L', 'XL'] },
            { id: 'color', label: 'اللون', kind: 'color', presets: [] },
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

    /** Hydrate easy UI from server options (draft pending review wins over live published). */
    function optionsStateFromServer(row) {
      const empty = { selected: {}, customs: {}, variantsText: '', traits: {} };
      if (!row) return empty;
      const groups = Array.isArray(row.draftOptionsJson) && row.draftOptionsJson.length
        ? row.draftOptionsJson
        : (Array.isArray(row.optionsJson) ? row.optionsJson : []);
      const variants = Array.isArray(row.draftVariantsJson) && row.draftVariantsJson.length
        ? row.draftVariantsJson
        : (Array.isArray(row.variantsJson) ? row.variantsJson : []);
      const selected = {};
      const customs = {};
      groups.forEach((group) => {
        if (!group || !group.id) return;
        selected[group.id] = (group.values || []).map((v) => v.labelAr || v.id).filter(Boolean);
        customs[group.id] = '';
      });
      const variantsText = variants.map((variant) => {
        if (!variant || !variant.selections) return '';
        return groups.map((g) => {
          const valueId = variant.selections[g.id];
          const value = (g.values || []).find((v) => v.id === valueId);
          return value ? value.labelAr : valueId;
        }).join('|');
      }).filter(Boolean).join('\n');
      return { selected: selected, customs: customs, variantsText: variantsText, traits: {} };
    }

    function saveOptionsDraft() {
      // localStorage is a UI convenience only; authoritative copy is optionsJson on the API.
      try {
        const key = 'mira-product-options:' + ((item && item.id) || 'new');
        localStorage.setItem(key, JSON.stringify(optionsState));
      } catch (error) {}
    }

    function paintOptions() {
      optionsBody.replaceChildren();
      optionsPreview.replaceChildren();
      if (type !== 'brand') {
        optionsSection.hidden = true;
        return;
      }
      optionsSection.hidden = false;
      const preset = optionPresets(category.value);
      if (!preset.groups.length && !preset.traits.length) {
        text(optionsBody, 'هذا التصنيف لا يحتاج خيارات مقاس أو لون أو حجم.');
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
            saveOptionsDraft();
            paintOptionsPreview();
          };
          wrap.append(input, document.createTextNode(' ' + label));
          chips.appendChild(wrap);
        });
        block.appendChild(chips);
        const custom = field(block, 'قيم خاصة (افصلي بفاصلة)', 'custom-' + group.id, optionsState.customs[group.id] || '', 'text');
        custom.oninput = () => {
          optionsState.customs[group.id] = custom.value;
          saveOptionsDraft();
          paintOptionsPreview();
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
      const variants = field(optionsBody, 'التركيبات المتاحة (سطر لكل تركيبة، مثال: وردي|M)', 'variantsText', optionsState.variantsText || '', 'textarea');
      variants.placeholder = 'وردي|M\nأسود|S\nأسود|L';
      variants.oninput = () => {
        optionsState.variantsText = variants.value;
        saveOptionsDraft();
        paintOptionsPreview();
      };
      paintOptionsPreview();
    }

    function slugValue(label, index) {
      const base = String(label || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\u0600-\u06FF\-]/g, '')
        .slice(0, 40);
      return base || ('v' + (index + 1));
    }

    /** Structured options from the easy UI → backend optionsJson / variantsJson (not localStorage-only). */
    function structuredOptionsPayload() {
      const preset = optionPresets(category.value);
      const groups = [];
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
        groups.push({
          id: group.id,
          labelAr: group.label,
          kind: group.kind,
          values: labels.map((label, index) => ({ id: slugValue(label, index), labelAr: label })),
        });
      });
      const variants = [];
      String(optionsState.variantsText || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line, index) => {
          const parts = line.split('|').map((part) => part.trim()).filter(Boolean);
          if (!parts.length || parts.length !== groups.length) return;
          const selections = {};
          let ok = true;
          groups.forEach((group, gi) => {
            const label = parts[gi];
            const value = group.values.find((entry) => entry.labelAr === label);
            if (!value) {
              ok = false;
              return;
            }
            selections[group.id] = value.id;
          });
          if (!ok) return;
          variants.push({ id: 'var-' + (index + 1), selections: selections });
        });
      return { optionsJson: groups, variantsJson: variants };
    }

    function paintOptionsPreview() {
      optionsPreview.replaceChildren();
      text(optionsPreview, 'معاينة الظهور في التفاصيل', 'h4');
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
      const lines = String(optionsState.variantsText || '').split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length) text(optionsPreview, 'التركيبات المسجّلة: ' + lines.join(' · '));
      else text(optionsPreview, 'لا تُنشأ تركيبات تلقائيًا من حاصل ضرب الخيارات.');
      const built = structuredOptionsPayload();
      text(
        optionsPreview,
        built.optionsJson.length
          ? 'عند الحفظ تُرسل الخيارات إلى الخادم (' + built.optionsJson.length + ' مجموعة، ' + built.variantsJson.length + ' تركيبة).'
          : 'لا خيارات منظمة للإرسال بعد.',
      );
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

      const options = parseJsonList(optionsJsonInput.value, 'optionsJson', 'الخيارات');
      if (options.error) return options;
      const variants = parseJsonList(variantsJsonInput.value, 'variantsJson', 'التركيبات');
      if (variants.error) return variants;
      const built = structuredOptionsPayload();
      // Prefer explicit JSON when provided; otherwise send the easy UI structure to the API.
      if (options.value !== undefined) value.optionsJson = options.value;
      else if (built.optionsJson.length) value.optionsJson = built.optionsJson;
      else if (editing && item.optionsJson) value.optionsJson = null;

      if (variants.value !== undefined) value.variantsJson = variants.value;
      else if (built.variantsJson.length) value.variantsJson = built.variantsJson;
      else if (editing && item.variantsJson) value.variantsJson = null;

      if (value.optionsJson === undefined) delete value.optionsJson;
      if (value.variantsJson === undefined) delete value.variantsJson;
      return { value: value };
    }

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
          } catch (error) {
            status.textContent = 'لم يُرسل الحفظ. ' + (error.message || 'أصلحي جدول التوفر.');
            return;
          }
        }
      }
      save.disabled = true;
      status.textContent = 'جارٍ حفظ المسودة';
      try {
        const saved = editing
          ? await (type === 'brand' ? PartnersApi.updateProduct(item.id, payload) : PartnersApi.updateService(item.id, payload))
          : await (type === 'brand' ? PartnersApi.createProduct(payload) : PartnersApi.createService(payload));
        if (type === 'brand' && !editing) {
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
