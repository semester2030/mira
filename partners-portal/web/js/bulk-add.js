/**
 * P6 — إضافة مجموعة (بوابة الشركاء)
 * Creates independent editor drafts via bulk-batches API; does not treat file count as product count.
 */
(function () {
  const DEFAULT_LIMIT = 10;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'className') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function profileOptions(partner, kind) {
    const type = partner && partner.type;
    if (kind === 'product') {
      return [
        { id: 'product.clothes', label: 'ملابس' },
        { id: 'product.face', label: 'وجه' },
        { id: 'product.accessories', label: 'إكسسوارات' },
      ];
    }
    if (type === 'clinic') {
      return [
        { id: 'service.clinic_skin', label: 'بشرة' },
        { id: 'service.clinic.generic', label: 'عيادة عامة' },
      ];
    }
    return [
      { id: 'service.salon_hair_cut', label: 'قص شعر' },
      { id: 'service.salon.generic', label: 'صالون عام' },
    ];
  }

  async function openBulkUi(root, partner) {
    root.innerHTML = '';
    const status = el('p', { className: 'lead', id: 'bulkStatus', role: 'status' }, ['أنشئي دفعة جديدة. كل بطاقة عرض مستقل تحت حسابك.']);
    const kindSelect = el('select', { id: 'bulkKind' }, [
      el('option', { value: 'product', text: 'منتجات' }),
      el('option', { value: 'service', text: 'خدمات' }),
    ]);
    const profileSelect = el('select', { id: 'bulkProfile' });
    const countInput = el('input', {
      id: 'bulkCount',
      type: 'number',
      min: '1',
      max: '50',
      value: String(DEFAULT_LIMIT),
    });
    const refillProfiles = () => {
      profileSelect.innerHTML = '';
      profileOptions(partner, kindSelect.value).forEach((p) => {
        profileSelect.appendChild(el('option', { value: p.id, text: p.label }));
      });
    };
    refillProfiles();
    kindSelect.addEventListener('change', refillProfiles);

    const createBtn = el('button', { type: 'button', className: 'btn btn-primary', text: 'إنشاء البطاقات' });
    const listHost = el('div', { id: 'bulkCards' });
    const sharedName = el('input', { id: 'bulkSharedName', type: 'text', placeholder: 'اسم مشترك (اختياري)' });
    const sharedPrice = el('input', { id: 'bulkSharedPrice', type: 'number', placeholder: 'سعر هللة (اختياري)' });
    const overwriteCk = el('input', { id: 'bulkOverwrite', type: 'checkbox' });
    const applySharedBtn = el('button', { type: 'button', className: 'btn btn-ghost', text: 'تعبئة مشتركة للبطاقات المحددة' });
    const previewBtn = el('button', { type: 'button', className: 'btn btn-ghost', text: 'معاينة التعبئة' });
    const matBtn = el('button', { type: 'button', className: 'btn btn-primary', text: 'حفظ / تحويل الدفعة' });
    const fileInput = el('input', { id: 'bulkFiles', type: 'file', multiple: 'multiple', accept: 'image/*,video/*' });
    const fileNote = el('p', { className: 'lead' }, [
      'الملفات للتعيين اليدوي على البطاقات — عدد الملفات لا يغيّر عدد المنتجات تلقائيًا.',
    ]);

    let batch = null;
    let fileAssignments = {}; // cardId -> File name only (portal assigns; upload uses existing media path later)

    const renderCards = () => {
      listHost.innerHTML = '';
      if (!batch) return;
      batch.cards.forEach((card) => {
        const ck = el('input', { type: 'checkbox', className: 'bulk-card-ck', 'data-card': card.cardId });
        ck.checked = true;
        const name = el('input', {
          type: 'text',
          value: card.values && card.values.nameAr != null ? String(card.values.nameAr) : '',
          'data-field': 'nameAr',
          'data-card': card.cardId,
        });
        const price = el('input', {
          type: 'number',
          value: card.values && card.values.priceHalalas != null ? String(card.values.priceHalalas) : '',
          'data-field': 'priceHalalas',
          'data-card': card.cardId,
        });
        const duration =
          batch.kind === 'service'
            ? el('input', {
                type: 'number',
                value: card.values && card.values.durationMin != null ? String(card.values.durationMin) : '',
                'data-field': 'durationMin',
                'data-card': card.cardId,
              })
            : null;
        const saveCard = el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: 'حفظ البطاقة',
          onClick: async () => {
            try {
              status.textContent = 'جاري حفظ البطاقة…';
              const values = {};
              if (name.value.trim()) values.nameAr = name.value.trim();
              if (price.value !== '') values.priceHalalas = Number(price.value);
              if (duration && duration.value !== '') values.durationMin = Number(duration.value);
              if (batch.kind === 'product') {
                values.purchaseMode = card.values.purchaseMode || 'external';
                if (!values.externalUrl && !card.values.externalUrl) values.externalUrl = '';
              }
              const put = await PartnersApi.putBulkCard(batch.batchId, card.cardId, {
                expectedRevision: card.revision,
                values,
                overwriteWritten: true,
              });
              card.revision = put.revision;
              card.values = Object.assign({}, card.values, values);
              status.textContent = 'حُفظت البطاقة ' + card.cardId + ' · rev ' + put.revision;
            } catch (e) {
              status.textContent = (e && e.messageAr) || (e && e.message) || String(e);
            }
          },
        });
        const assignFile = el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: fileAssignments[card.cardId] ? 'ملف: ' + fileAssignments[card.cardId] : 'تعيين ملف',
          onClick: () => {
            const files = fileInput.files;
            if (!files || !files.length) {
              status.textContent = 'اختاري ملفات أولًا ثم عيّني لكل بطاقة.';
              return;
            }
            const idx = batch.cards.indexOf(card) % files.length;
            fileAssignments[card.cardId] = files[idx].name;
            assignFile.textContent = 'ملف: ' + files[idx].name;
            status.textContent = 'عُيّن «' + files[idx].name + '» للبطاقة ' + card.cardId + ' (الرفع عبر مسار الوسائط عند التحويل/المحرر).';
          },
        });
        listHost.appendChild(
          el('div', { className: 'bulk-card', 'data-status': card.status }, [
            el('div', { className: 'bulk-card-head' }, [
              ck,
              el('strong', { text: card.cardId }),
              el('span', { text: ' · ' + card.status }),
              card.targetOwnerId ? el('a', { href: card.openUrl, text: ' فتح العنصر' }) : null,
            ]),
            el('label', null, ['الاسم ', name]),
            el('label', null, ['السعر ', price]),
            duration ? el('label', null, ['المدة ', duration]) : null,
            saveCard,
            assignFile,
          ]),
        );
      });
    };

    createBtn.addEventListener('click', async () => {
      try {
        status.textContent = 'جاري إنشاء الدفعة…';
        const count = Math.max(1, Math.min(50, Number(countInput.value) || DEFAULT_LIMIT));
        batch = await PartnersApi.createBulkBatch({
          kind: kindSelect.value,
          profileId: profileSelect.value,
          count,
        });
        fileAssignments = {};
        status.textContent =
          'دفعة ' + batch.batchId + ' · ' + batch.cards.length + ' بطاقة (الحد ' + batch.maxCards + ').';
        renderCards();
      } catch (e) {
        status.textContent = (e && e.messageAr) || (e && e.message) || String(e);
      }
    });

    const selectedIds = () =>
      Array.from(listHost.querySelectorAll('.bulk-card-ck:checked')).map((n) => n.getAttribute('data-card'));

    previewBtn.addEventListener('click', async () => {
      if (!batch) return;
      const values = {};
      if (sharedName.value.trim()) values.nameAr = sharedName.value.trim();
      if (sharedPrice.value !== '') values.priceHalalas = Number(sharedPrice.value);
      try {
        const preview = await PartnersApi.applyBulkShared(batch.batchId, {
          previewOnly: true,
          cardIds: selectedIds(),
          values,
        });
        status.textContent =
          'معاينة: ستتغير [' + (preview.fieldsThatWillChange || []).join(', ') + '] على ' + preview.cardIds.length + ' بطاقة.';
      } catch (e) {
        status.textContent = (e && e.messageAr) || (e && e.message) || String(e);
      }
    });

    applySharedBtn.addEventListener('click', async () => {
      if (!batch) return;
      const values = {};
      if (sharedName.value.trim()) values.nameAr = sharedName.value.trim();
      if (sharedPrice.value !== '') values.priceHalalas = Number(sharedPrice.value);
      if (batch.kind === 'product') {
        values.purchaseMode = 'external';
        values.externalUrl = values.externalUrl || '';
      }
      try {
        status.textContent = 'تطبيق التعبئة المشتركة…';
        await PartnersApi.applyBulkShared(batch.batchId, {
          cardIds: selectedIds(),
          values,
          overwriteWritten: overwriteCk.checked,
        });
        batch = await PartnersApi.getBulkBatch(batch.batchId);
        renderCards();
        status.textContent = 'تم تطبيق التعبئة المشتركة.';
      } catch (e) {
        status.textContent = (e && e.messageAr) || (e && e.message) || String(e);
      }
    });

    matBtn.addEventListener('click', async () => {
      if (!batch) return;
      try {
        status.textContent = 'تحويل الدفعة…';
        const key = 'bulk-ui-' + batch.batchId + '-' + Date.now();
        const out = await PartnersApi.materializeBulkBatch(
          batch.batchId,
          { submitReview: false, failedOnly: true },
          key,
        );
        batch = await PartnersApi.getBulkBatch(batch.batchId);
        renderCards();
        status.textContent =
          'نتيجة التحويل: نجح ' + out.succeeded + ' · تعثر ' + out.failed + ' · تخطي ' + out.skipped;
      } catch (e) {
        status.textContent = (e && e.messageAr) || (e && e.message) || String(e);
      }
    });

    root.appendChild(status);
    root.appendChild(el('div', { className: 'journey-actions' }, [
      el('label', null, ['النوع ', kindSelect]),
      el('label', null, ['القالب ', profileSelect]),
      el('label', null, ['العدد ', countInput]),
      createBtn,
    ]));
    root.appendChild(fileNote);
    root.appendChild(fileInput);
    root.appendChild(el('div', { className: 'journey-actions' }, [
      sharedName,
      sharedPrice,
      el('label', null, [overwriteCk, ' استبدال المكتوب']),
      previewBtn,
      applySharedBtn,
      matBtn,
    ]));
    root.appendChild(listHost);

    const q = new URLSearchParams(location.search);
    const existing = q.get('bulk');
    if (existing) {
      try {
        batch = await PartnersApi.getBulkBatch(existing);
        status.textContent = 'استُعيدت الدفعة ' + batch.batchId;
        renderCards();
      } catch (e) {
        status.textContent = (e && e.messageAr) || (e && e.message) || String(e);
      }
    }
  }

  window.MiraBulkAdd = {
    open: openBulkUi,
    defaultLimit: DEFAULT_LIMIT,
  };
})();
