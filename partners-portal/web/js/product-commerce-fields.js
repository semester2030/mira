/**
 * Shared product commerce fields (colors / sizes / variants) —
 * same presets and MiraCatalogOptions payload as «إضافة منتج».
 * Used by catalog-journey (via optionPresets) and bulk-group-journey.
 */
(function (global) {
  'use strict';

  function emptyState() {
    return {
      selected: {},
      customs: {},
      customsList: {},
      traits: {},
      variants: [],
      valueIds: {},
      inputModes: {},
      clearingOptions: false,
      clearingVariants: false,
      invalidVariantNote: '',
      inventoryMode: 'product',
    };
  }

  /**
   * Mount commerce UI into host.
   * @returns {{ getCommercePayload: Function, getOptionsState: Function, destroy: Function }}
   */
  function mountProductCommerceFields(host, opts) {
    const MO = global.MiraCatalogOptions;
    if (!MO || typeof MO.optionPresets !== 'function') {
      throw new Error('MiraCatalogOptions غير محمّل');
    }
    const category = opts.category || 'clothes';
    const subcategory = opts.subcategory || '';
    const preset = MO.optionPresets(category, subcategory);
    let optionsState =
      opts.initialRow && typeof MO.optionsStateFromServer === 'function'
        ? MO.optionsStateFromServer(opts.initialRow)
        : emptyState();
    if (opts.seedSelected) {
      optionsState.selected = Object.assign({}, optionsState.selected, opts.seedSelected);
    }
    if (!optionsState.inventoryMode) optionsState.inventoryMode = 'product';

    const root = document.createElement('div');
    root.className = 'product-commerce-fields option-group-host';
    root.setAttribute('data-category', category);
    host.appendChild(root);

    function notify() {
      if (typeof opts.onChange === 'function') opts.onChange(getCommercePayload());
    }

    function paint() {
      root.replaceChildren();
      if (!preset.groups.length && !preset.traits.length) {
        const p = document.createElement('p');
        p.className = 'lead';
        p.textContent = 'هذا التصنيف لا يحتاج خيارات مقاس أو لون أو حجم.';
        root.appendChild(p);
        return;
      }

      preset.groups.forEach((group) => {
        const block = document.createElement('div');
        block.className = 'option-group';
        const h = document.createElement('h4');
        h.textContent = group.label;
        block.appendChild(h);
        const chips = document.createElement('div');
        chips.className = group.kind === 'color' ? 'choice-row swatch-row' : 'choice-row';
        if (!optionsState.selected[group.id]) optionsState.selected[group.id] = [];
        (group.presets || []).forEach((label) => {
          const wrap = document.createElement('label');
          wrap.className =
            group.kind === 'color' ? 'swatch-choice' : group.kind === 'size' ? 'size-choice' : '';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = optionsState.selected[group.id].indexOf(label) >= 0;
          input.setAttribute('aria-label', label);
          input.onchange = () => {
            const list = optionsState.selected[group.id];
            const at = list.indexOf(label);
            if (input.checked && at < 0) list.push(label);
            if (!input.checked && at >= 0) list.splice(at, 1);
            optionsState.clearingOptions = false;
            optionsState.clearingVariants = false;
            if (group.kind === 'color') wrap.classList.toggle('is-selected', input.checked);
            notify();
            paintVariants();
          };
          if (group.kind === 'color') {
            const swatch = document.createElement('span');
            swatch.className = 'color-swatch';
            swatch.setAttribute('data-color-label', label);
            swatch.setAttribute('title', label);
            const style = MO.colorSwatchStyle(label);
            swatch.style.background = style.background;
            swatch.style.borderColor = style.borderColor;
            if (input.checked) wrap.classList.add('is-selected');
            const name = document.createElement('span');
            name.className = 'swatch-name';
            name.textContent = label;
            wrap.append(input, swatch, name);
          } else {
            wrap.append(input, document.createTextNode(' ' + label));
          }
          chips.appendChild(wrap);
        });
        block.appendChild(chips);
        if (!optionsState.inputModes) optionsState.inputModes = {};
        const mode = optionsState.inputModes[group.id] || 'ready';
        const modeRow = document.createElement('div');
        modeRow.className = 'choice-row input-mode-row';
        modeRow.setAttribute('data-testid', 'input-mode-' + group.id);
        [['ready', 'اختيار جاهز'], ['manual', 'كتابة يدوية']].forEach(([id, label]) => {
          const lab = document.createElement('label');
          lab.className = 'input-mode-choice' + (mode === id ? ' is-selected' : '');
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'input-mode-' + group.id;
          radio.value = id;
          radio.checked = mode === id;
          radio.onchange = () => {
            if (!radio.checked) return;
            optionsState.inputModes[group.id] = id;
            // Preserve ready selections and manual customs across mode switches.
            paint();
            notify();
          };
          lab.append(radio, document.createTextNode(' ' + label));
          modeRow.appendChild(lab);
        });
        block.appendChild(modeRow);
        chips.hidden = mode === 'manual';
        const customLab = document.createElement('label');
        customLab.className = 'manual-input-label';
        customLab.textContent = 'كتابة يدوية (افصلي بفاصلة عربية أو إنجليزية؛ تُحفظ كقيم مستقلة)';
        customLab.hidden = mode === 'ready';
        const custom = document.createElement('input');
        custom.type = 'text';
        custom.setAttribute('data-testid', 'manual-input-' + group.id);
        custom.value = optionsState.customs[group.id] || '';
        custom.oninput = () => {
          optionsState.customs[group.id] = custom.value;
          if (!optionsState.customsList) optionsState.customsList = {};
          optionsState.customsList[group.id] =
            typeof MO.splitCustomLabels === 'function'
              ? MO.splitCustomLabels(custom.value)
              : String(custom.value || '')
                  .split(/[,،]+/)
                  .map((p) => p.trim())
                  .filter(Boolean);
          notify();
        };
        customLab.appendChild(custom);
        block.appendChild(customLab);
        root.appendChild(block);
      });

      if (preset.traits.length) {
        const traitBox = document.createElement('details');
        const sum = document.createElement('summary');
        sum.textContent = 'تفاصيل إضافية (خصائص وصفية)';
        traitBox.appendChild(sum);
        preset.traits.forEach((key) => {
          const lab = document.createElement('label');
          lab.textContent = key;
          const input = document.createElement('input');
          input.type = 'text';
          input.value = optionsState.traits[key] || '';
          input.oninput = () => {
            optionsState.traits[key] = input.value;
            notify();
          };
          lab.appendChild(input);
          traitBox.appendChild(lab);
        });
        root.appendChild(traitBox);
      }

      const invModeRow = document.createElement('div');
      invModeRow.className = 'choice-row';
      const invLabel = document.createElement('label');
      const invCheck = document.createElement('input');
      invCheck.type = 'checkbox';
      invCheck.checked = optionsState.inventoryMode === 'variant';
      invCheck.onchange = () => {
        optionsState.inventoryMode = invCheck.checked ? 'variant' : 'product';
        notify();
        paintVariants();
      };
      invLabel.append(invCheck, document.createTextNode(' تتبع المخزون لكل تركيبة'));
      invModeRow.appendChild(invLabel);
      root.appendChild(invModeRow);

      const vTitle = document.createElement('h4');
      vTitle.textContent = 'التركيبات (لا تُنشأ تلقائيًا من كل الاحتمالات)';
      root.appendChild(vTitle);

      const addRow = document.createElement('div');
      addRow.className = 'journey-actions';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn btn-ghost';
      addBtn.textContent = 'إضافة تركيبة من الاختيارات الحالية';
      addBtn.onclick = () => {
        addVariantFromSelection();
        paintVariants();
        notify();
      };
      addRow.appendChild(addBtn);
      if ((optionsState.variants || []).length) {
        const clearVariantsBtn = document.createElement('button');
        clearVariantsBtn.type = 'button';
        clearVariantsBtn.className = 'btn btn-ghost';
        clearVariantsBtn.setAttribute('data-testid', 'commerce-clear-variants');
        clearVariantsBtn.textContent = 'مسح التركيبات';
        clearVariantsBtn.onclick = () => {
          optionsState.variants = [];
          optionsState.clearingVariants = true;
          optionsState.invalidVariantNote = '';
          paintVariants();
          notify();
        };
        addRow.appendChild(clearVariantsBtn);
      }
      root.appendChild(addRow);

      const variantHost = document.createElement('div');
      variantHost.className = 'variant-list';
      variantHost.id = 'commerceVariantList';
      variantHost.setAttribute('data-testid', 'commerce-variant-list');
      root.appendChild(variantHost);
      paintVariants();
    }

    function currentSelectionLabels() {
      const selections = {};
      const labels = {};
      (preset.groups || []).forEach((group) => {
        const chosen = (optionsState.selected[group.id] || [])[0];
        if (!chosen) return;
        labels[group.id] = chosen;
        if (!optionsState.valueIds) optionsState.valueIds = {};
        if (!optionsState.valueIds[group.id]) optionsState.valueIds[group.id] = {};
        const id =
          optionsState.valueIds[group.id][chosen] ||
          MO.canonicalOptionValueId(group.id, chosen, 0, null);
        optionsState.valueIds[group.id][chosen] = id;
        selections[group.id] = id;
      });
      return { selections, labels };
    }

    function addVariantFromSelection() {
      const { selections, labels } = currentSelectionLabels();
      if (!Object.keys(selections).length) {
        optionsState.invalidVariantNote = 'اختاري لونًا أو مقاسًا قبل إضافة تركيبة';
        return;
      }
      if (MO.isDuplicateVariant(optionsState.variants, selections)) {
        optionsState.invalidVariantNote = 'هذه التركيبة موجودة مسبقًا';
        return;
      }
      optionsState.invalidVariantNote = '';
      optionsState.variants.push({
        id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        selections: selections,
        labels: labels,
        priceHalalas: null,
        available: true,
        mediaIds: [],
        stockQty: null,
      });
    }

    function paintVariants() {
      const list = root.querySelector('#commerceVariantList');
      if (!list) return;
      list.replaceChildren();
      if (optionsState.invalidVariantNote) {
        const err = document.createElement('p');
        err.className = 'field-error';
        err.textContent = optionsState.invalidVariantNote;
        list.appendChild(err);
      }
      if (!(optionsState.variants || []).length) {
        const empty = document.createElement('p');
        empty.className = 'lead';
        empty.setAttribute('data-testid', 'commerce-variants-empty');
        empty.textContent = 'لا توجد تركيبات';
        list.appendChild(empty);
        return;
      }
      (optionsState.variants || []).forEach((variant, index) => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.setAttribute('data-testid', 'commerce-variant-row');
        row.setAttribute('data-variant-index', String(index));
        const title = document.createElement('strong');
        title.textContent =
          Object.values(variant.labels || {}).join(' / ') || 'تركيبة ' + (index + 1);
        row.appendChild(title);
        const priceLab = document.createElement('label');
        priceLab.textContent = 'السعر (ر.س) اختياري';
        const priceIn = document.createElement('input');
        priceIn.type = 'text';
        priceIn.inputMode = 'decimal';
        priceIn.value =
          variant.priceHalalas != null && Number.isFinite(variant.priceHalalas)
            ? (variant.priceHalalas / 100).toFixed(2).replace(/\.00$/, '')
            : '';
        priceIn.oninput = () => {
          const t = String(priceIn.value || '').trim();
          if (!t) {
            variant.priceHalalas = null;
            notify();
            return;
          }
          if (!/^\d+(\.\d{1,2})?$/.test(t)) return;
          const [r, f] = t.split('.');
          variant.priceHalalas = Number(r) * 100 + Number((f || '').padEnd(2, '0').slice(0, 2));
          notify();
        };
        priceLab.appendChild(priceIn);
        row.appendChild(priceLab);
        if (optionsState.inventoryMode === 'variant') {
          const qtyLab = document.createElement('label');
          qtyLab.textContent = 'الكمية';
          const qtyIn = document.createElement('input');
          qtyIn.type = 'number';
          qtyIn.min = '0';
          qtyIn.value = variant.stockQty != null ? String(variant.stockQty) : '';
          qtyIn.oninput = () => {
            const v = qtyIn.value;
            variant.stockQty = v === '' ? null : Number(v);
            notify();
          };
          qtyLab.appendChild(qtyIn);
          row.appendChild(qtyLab);
        }
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'btn btn-ghost';
        rm.setAttribute('data-testid', 'commerce-remove-variant');
        rm.textContent = 'إزالة التركيبة';
        rm.onclick = () => {
          optionsState.variants.splice(index, 1);
          if (!optionsState.variants.length) optionsState.clearingVariants = true;
          paint();
          notify();
        };
        row.appendChild(rm);
        list.appendChild(row);
      });
    }

    function getCommercePayload() {
      const groups = MO.buildOptionGroups(preset.groups, optionsState);
      optionsState._builtGroups = groups;
      let variantsJson = optionsState.variants || [];
      if (typeof MO.structuredOptionsPayload === 'function') {
        const payload = MO.structuredOptionsPayload(optionsState, preset.groups);
        if (payload && Array.isArray(payload.variantsJson)) variantsJson = payload.variantsJson;
        else if (payload && payload.clearing) variantsJson = [];
      }
      return {
        category: category,
        optionsJson: groups.length ? groups : null,
        variantsJson: variantsJson,
        inventoryMode: optionsState.inventoryMode === 'variant' ? 'variant' : 'product',
        traits: Object.assign({}, optionsState.traits),
      };
    }

    paint();

    return {
      getCommercePayload: getCommercePayload,
      getOptionsState: () => optionsState,
      destroy: () => {
        try {
          root.remove();
        } catch (_) {}
      },
    };
  }

  global.MiraProductCommerceFields = {
    mount: mountProductCommerceFields,
    emptyState: emptyState,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
