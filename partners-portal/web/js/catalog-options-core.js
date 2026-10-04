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
        Object.keys(variant.selections || {}).map((groupId) => {
          const group = groups.find((g) => g.id === groupId);
          const valueId = variant.selections[groupId];
          const value = group && (group.values || []).find((v) => v.id === valueId);
          return [groupId, value ? value.labelAr : valueId];
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

  function groupLabel(presetGroups, groupId) {
    const hit = (presetGroups || []).find((g) => g.id === groupId);
    return (hit && (hit.label || hit.labelAr)) || groupId;
  }

  /**
   * Same payload builder the save path uses.
   * Validates against groups the variants still reference — not only remaining UI groups —
   * so removing the last value of a used option group cannot silently shrink a SKU.
   */
  function structuredOptionsPayload(state, presetGroups) {
    if (state.clearingOptions) {
      return { optionsJson: null, variantsJson: null, clearing: true, error: null, conflicts: [] };
    }
    const groups = state._builtGroups || [];
    const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));
    const variants = [];
    const errors = [];
    const conflicts = [];

    (state.variants || []).forEach((variant) => {
      if (!variant || !variant.id) {
        errors.push('تركيبة بلا معرف ثابت.');
        return;
      }
      const referencedGroupIds = new Set([
        ...Object.keys(variant.selections || {}),
        ...Object.keys(variant.labels || {}),
      ]);
      if (!referencedGroupIds.size && groups.length) {
        const msg = 'التركيبة ' + variant.id + ' بلا اختيارات.';
        errors.push(msg);
        conflicts.push({ variantId: variant.id, groupId: null, messageAr: msg });
        return;
      }

      const selections = {};
      let ok = true;
      referencedGroupIds.forEach((groupId) => {
        const group = groupById[groupId];
        const label = variant.labels && variant.labels[groupId];
        const byId = variant.selections && variant.selections[groupId];
        if (!group) {
          ok = false;
          const msg =
            'التركيبة ' +
            variant.id +
            ' ما زالت تستخدم مجموعة «' +
            groupLabel(presetGroups, groupId) +
            '» التي حُذفت قيمها. استعيدي قيمة أو عدّلي التركيبة أو احذفيها صراحةً قبل الحفظ.';
          errors.push(msg);
          conflicts.push({ variantId: variant.id, groupId: groupId, messageAr: msg, kind: 'group_removed' });
          return;
        }
        const value =
          group.values.find((entry) => entry.id === byId) ||
          group.values.find((entry) => entry.labelAr === label);
        if (!value) {
          ok = false;
          const msg =
            'التركيبة ' +
            variant.id +
            ' تشير إلى قيمة غير موجودة في «' +
            group.labelAr +
            '». استعيدي القيمة أو عدّلي التركيبة أو احذفيها صراحةً.';
          errors.push(msg);
          conflicts.push({ variantId: variant.id, groupId: group.id, messageAr: msg, kind: 'value_missing' });
        }
      });
      if (!ok) return;

      // Every remaining option group must still be selected (no silent shrink the other way).
      groups.forEach((group) => {
        const label = variant.labels && variant.labels[group.id];
        const byId = variant.selections && variant.selections[group.id];
        const value =
          group.values.find((entry) => entry.id === byId) ||
          group.values.find((entry) => entry.labelAr === label);
        if (!value) {
          ok = false;
          const msg = 'التركيبة ' + variant.id + ' ناقصة اختيار «' + group.labelAr + '».';
          errors.push(msg);
          conflicts.push({ variantId: variant.id, groupId: group.id, messageAr: msg, kind: 'incomplete' });
          return;
        }
        selections[group.id] = value.id;
      });
      if (!ok) return;

      if (Object.keys(selections).length !== groups.length) {
        const msg = 'التركيبة ' + variant.id + ' ناقصة اختيارات.';
        errors.push(msg);
        conflicts.push({ variantId: variant.id, groupId: null, messageAr: msg, kind: 'incomplete' });
        return;
      }

      // Keep UI labels in sync only after validation succeeds — never strip removed groups silently.
      if (!variant.labels) variant.labels = {};
      groups.forEach((group) => {
        const value = group.values.find((entry) => entry.id === selections[group.id]);
        if (value) variant.labels[group.id] = value.labelAr;
      });
      variant.selections = Object.assign({}, selections);

      variants.push({
        id: variant.id,
        selections: selections,
        priceHalalas: typeof variant.priceHalalas === 'number' ? variant.priceHalalas : null,
        available: variant.available !== false,
      });
    });

    if ((state.variants || []).length > 0 && groups.length === 0 && !state.clearingOptions) {
      const msg =
        'حُذفت كل قيم الخيارات بينما ما زالت هناك تركيبات. استخدمي مسح الخيارات الصريح أو احذفي التركيبات أولًا.';
      errors.push(msg);
      conflicts.push({ variantId: null, groupId: null, messageAr: msg, kind: 'all_values_cleared' });
    }

    return {
      optionsJson: groups,
      variantsJson: conflicts.length ? [] : variants,
      clearing: false,
      error: errors[0] || null,
      conflicts: conflicts,
    };
  }

  function buildCommercePayload(state, groups) {
    if (state.clearingOptions) return { optionsJson: null, variantsJson: null };
    state._builtGroups = groups;
    const built = structuredOptionsPayload(state);
    if (built.error) {
      return { optionsJson: groups, variantsJson: null, error: built.error, conflicts: built.conflicts };
    }
    return { optionsJson: built.optionsJson, variantsJson: built.variantsJson };
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
