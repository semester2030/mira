/**
 * Shared catalog options/variants helpers used by the partner portal UI and Node tests.
 * Browser: load before catalog-journey.js (assigns globalThis.MiraCatalogOptions).
 * Node tests must call the same buildOptionGroups / structuredOptionsPayload as save.
 */
(function (global) {
  'use strict';

  function optionsStateFromServer(row) {
    const empty = {
      selected: {},
      customs: {},
      traits: {},
      variants: [],
      valueIds: {},
      clearingOptions: false,
      clearingVariants: false,
      invalidVariantNote: '',
    };
    if (!row) return empty;

    let groups = [];
    let clearingOptions = false;
    if (row.draftOptionsSet) {
      if (row.draftOptionsJson == null) clearingOptions = true;
      else groups = Array.isArray(row.draftOptionsJson) ? row.draftOptionsJson : [];
    } else if (Array.isArray(row.optionsJson)) {
      groups = row.optionsJson;
    }

    let variants = [];
    let clearingVariants = false;
    if (row.draftVariantsSet) {
      if (row.draftVariantsJson == null) clearingVariants = true;
      else variants = Array.isArray(row.draftVariantsJson) ? row.draftVariantsJson : [];
    } else if (Array.isArray(row.variantsJson)) {
      variants = row.variantsJson;
    }
    if (clearingOptions) {
      clearingVariants = true;
      variants = [];
      groups = [];
    }

    const selected = {};
    const valueIds = {};
    groups.forEach((group) => {
      selected[group.id] = (group.values || []).map((v) => v.labelAr || v.id).filter(Boolean);
      valueIds[group.id] = {};
      (group.values || []).forEach((v) => {
        if (v && v.labelAr) valueIds[group.id][v.labelAr] = v.id;
      });
    });

    const variantRows = variants.map((variant) => ({
      id: variant.id,
      selections: Object.assign({}, variant.selections),
      labels: Object.fromEntries(
        groups.map((g) => {
          const valueId = variant.selections && variant.selections[g.id];
          const value = (g.values || []).find((v) => v.id === valueId);
          return [g.id, value ? value.labelAr : valueId];
        }),
      ),
      priceHalalas: typeof variant.priceHalalas === 'number' ? variant.priceHalalas : null,
      available: variant.available !== false,
    }));

    return {
      selected: selected,
      customs: {},
      traits: {},
      valueIds: valueIds,
      variants: variantRows,
      clearingOptions: clearingOptions,
      clearingVariants: clearingVariants,
      invalidVariantNote: '',
    };
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

  /**
   * Build optionsJson groups from UI state + preset descriptors.
   * presetGroups: [{ id, label, kind, presets?: string[] }]
   */
  function buildOptionGroups(presetGroups, state) {
    const groups = [];
    if (!state.valueIds) state.valueIds = {};
    (presetGroups || []).forEach((group) => {
      const labels = (state.selected[group.id] || []).slice();
      String(state.customs[group.id] || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          if (labels.indexOf(part) < 0) labels.push(part);
        });
      if (!labels.length) return;
      if (!state.valueIds[group.id]) state.valueIds[group.id] = {};
      groups.push({
        id: group.id,
        labelAr: group.label || group.labelAr,
        kind: group.kind,
        values: labels.map((label, index) => {
          const existing = state.valueIds[group.id][label];
          const id = existing || slugValue(label, index);
          state.valueIds[group.id][label] = id;
          return { id: id, labelAr: label };
        }),
      });
    });
    return groups;
  }

  function selectionKey(selections) {
    return Object.keys(selections || {})
      .sort()
      .map((k) => k.length + ':' + k + String(selections[k] || '').length + ':' + (selections[k] || ''))
      .join(';');
  }

  function isDuplicateVariant(variants, selections) {
    const key = selectionKey(selections);
    return (variants || []).some((v) => selectionKey(v.selections) === key);
  }

  /** Same payload builder the save path uses. */
  function structuredOptionsPayload(state) {
    if (state.clearingOptions) {
      return { optionsJson: null, variantsJson: null, clearing: true, error: null, conflicts: [] };
    }
    const groups = state._builtGroups || [];
    const variants = [];
    const errors = [];
    const conflicts = [];
    (state.variants || []).forEach((variant) => {
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

  function buildCommercePayload(state, groups) {
    if (state.clearingOptions) return { optionsJson: null, variantsJson: null };
    const variants = (state.variants || []).map((v) => ({
      id: v.id,
      selections: v.selections,
      priceHalalas: v.priceHalalas,
      available: v.available !== false,
    }));
    return { optionsJson: groups, variantsJson: variants };
  }

  /** Refresh select options; keep still-valid chosen values. */
  function syncPickerOptions(selectEl, values, previousValueId) {
    const keep = values.some((v) => v.id === previousValueId) ? previousValueId : '';
    while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = selectEl.getAttribute('data-placeholder') || 'اختاري';
    selectEl.appendChild(placeholder);
    values.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value.id;
      opt.textContent = value.labelAr;
      selectEl.appendChild(opt);
    });
    selectEl.value = keep;
    return keep;
  }

  global.MiraCatalogOptions = {
    optionsStateFromServer: optionsStateFromServer,
    buildOptionGroups: buildOptionGroups,
    structuredOptionsPayload: structuredOptionsPayload,
    buildCommercePayload: buildCommercePayload,
    selectionKey: selectionKey,
    isDuplicateVariant: isDuplicateVariant,
    slugValue: slugValue,
    syncPickerOptions: syncPickerOptions,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
