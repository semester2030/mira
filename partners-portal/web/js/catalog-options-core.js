/**
 * Shared catalog options/variants helpers used by the partner portal UI and Node tests.
 * Browser: load before catalog-journey.js (assigns globalThis.MiraCatalogOptions).
 * Node: vm.runInNewContext or require via catalog-options-rc2-tests.mjs.
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

  global.MiraCatalogOptions = {
    optionsStateFromServer: optionsStateFromServer,
    buildCommercePayload: buildCommercePayload,
    selectionKey: selectionKey,
    isDuplicateVariant: isDuplicateVariant,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
