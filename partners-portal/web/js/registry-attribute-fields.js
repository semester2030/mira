/**
 * Shared registry-driven attribute fields for partners portal (E2 corrections).
 * Single + group editors mount the same widgets; each mount owns independent state.
 */
(function (global) {
  'use strict';

  var E2_WRITE_FIELD_IDS = {
    material: true,
    cut: true,
    occasion: true,
    lengthCm: true,
    shoeUsage: true,
    heelHeightCm: true,
    itemDimensions: true,
    carryStyle: true,
  };

  var E2_COMPONENT_CONTRACT_IDS = {
    // carryStyle is now a writable bags field; keep empty for legacy callers.
  };

  /**
   * Fallback flat ids only when no registry is passed to extractAttributesFromValues.
   * Prefer attrFieldIdsFromRegistry(registry) so new registry fields need no second list.
   */
  var FLAT_ATTR_FIELD_IDS = [
    'material',
    'cut',
    'occasion',
    'lengthCm',
    'carryStyle',
    'shoeUsage',
    'heelHeightCm',
    'itemDimensions',
  ];

  function fieldDependsVisible(def, ctx) {
    if (!def || !def.dependsOn) return true;
    var dep = def.dependsOn;
    ctx = ctx || {};
    if (dep.field === 'subcategory' && Array.isArray(dep.includes)) {
      var sub = String(ctx.subcategory || '');
      return dep.includes.indexOf(sub) >= 0;
    }
    if (dep.field && Object.prototype.hasOwnProperty.call(ctx, dep.field)) {
      var cur = ctx[dep.field];
      if (Array.isArray(dep.includes)) return dep.includes.indexOf(cur) >= 0;
      if (dep.equals != null) return cur === dep.equals;
    }
    return true;
  }

  var mountSeq = 0;

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function registryRoot(registry) {
    if (!registry) return { fields: {}, profiles: [] };
    return registry.registry || registry;
  }

  function profileById(registry, profileId) {
    var root = registryRoot(registry);
    var list = root.profiles || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === profileId) return list[i];
    }
    return null;
  }

  function fieldDef(registry, fieldId) {
    var root = registryRoot(registry);
    var f = (root.fields || {})[fieldId];
    if (!f) return null;
    return Object.assign({ id: fieldId }, f);
  }

  function storageAttrKey(def) {
    var s = def && def.storage;
    if (typeof s !== 'string' || s.indexOf('attributes.') !== 0) return null;
    return s.slice('attributes.'.length);
  }

  function classifyField(def) {
    if (!def) return 'deferred';
    var key = storageAttrKey(def);
    if (!key) return 'deferred';
    if (def.editable === false) return 'read';
    if (E2_WRITE_FIELD_IDS[def.id]) return 'write';
    if (E2_COMPONENT_CONTRACT_IDS[def.id]) return 'component';
    if (def.currentStatus === 'ATTRIBUTES_JSON' || def.currentStatus === 'LIVE') return 'write';
    if (def.currentStatus === 'PROPOSED') return 'deferred';
    return 'deferred';
  }

  function labelFor(def, valueId) {
    var labels = (def && def.valueLabels) || {};
    if (labels[valueId] != null && String(labels[valueId]).trim() !== '') return String(labels[valueId]);
    return String(valueId);
  }

  function attributeFieldDefsForProfile(registry, profileId, opts) {
    opts = opts || {};
    var profile = profileById(registry, profileId);
    if (!profile) return [];
    var out = [];
    var ids = profile.fields || [];
    for (var i = 0; i < ids.length; i++) {
      var def = fieldDef(registry, ids[i]);
      if (!def) continue;
      var tier = classifyField(def);
      if (tier === 'deferred' && !(opts.includeDeferred)) continue;
      if (tier === 'component' && !(opts.includeComponentContract)) continue;
      if (!storageAttrKey(def)) continue;
      out.push(Object.assign({}, def, { supportTier: tier }));
    }
    return out;
  }

  /**
   * Derive supported attribute field ids from registry definitions.
   * Write-tier by default; optional component-contract ids; never promotes deferred to writable.
   */
  function attrFieldIdsFromRegistry(registry, opts) {
    opts = opts || {};
    var root = registryRoot(registry);
    var ids = [];
    Object.keys(root.fields || {}).forEach(function (id) {
      var def = fieldDef(registry, id);
      if (!def || !storageAttrKey(def)) return;
      var tier = classifyField(def);
      if (tier === 'write') ids.push(id);
      else if (tier === 'component' && opts.includeComponentContract) ids.push(id);
      // deferred / read: intentionally omitted from writable flat extract lists
    });
    return ids;
  }

  var CUSTOM_ATTR_LABELS_KEY = 'customAttrLabels';
  var MAX_CUSTOM_LABEL_LEN = 80;

  /**
   * Restore attributes from card/product values independently of material/cut.
   * Priority documentation (nested vs flat):
   *   1) Start from nested bag: vals.attributes, else vals.attributesJson (storage keys).
   *   2) Flat keys (field id or storage key) win when present via hasOwnProperty —
   *      so a newer flat card edit overrides nested without dropping sibling bag keys.
   * Distinguishes missing key vs intentional null vs 0 vs present array/value.
   *
   * @param {object} vals
   * @param {string[]|object} [fieldIdsOrRegistry] array of ids, or registry object to derive ids
   * @param {object} [opts] when registry passed: { includeComponentContract }
   */
  function extractAttributesFromValues(vals, fieldIdsOrRegistry, opts) {
    var registry = null;
    var ids;
    if (Array.isArray(fieldIdsOrRegistry)) {
      ids = fieldIdsOrRegistry;
    } else if (fieldIdsOrRegistry && typeof fieldIdsOrRegistry === 'object') {
      registry = fieldIdsOrRegistry;
      ids = attrFieldIdsFromRegistry(registry, opts || {});
    } else {
      ids = FLAT_ATTR_FIELD_IDS.slice();
    }
    var out = {};
    if (!vals || typeof vals !== 'object') return out;

    var bag = null;
    if (isPlainObject(vals.attributes)) bag = vals.attributes;
    else if (isPlainObject(vals.attributesJson)) bag = vals.attributesJson;

    if (bag) {
      Object.keys(bag).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(bag, k)) out[k] = bag[k];
      });
    }

    ids.forEach(function (fid) {
      var storageKey = fid;
      if (registry) {
        var def = fieldDef(registry, fid);
        storageKey = storageAttrKey(def) || fid;
      }
      if (Object.prototype.hasOwnProperty.call(vals, fid)) {
        out[storageKey] = vals[fid];
      } else if (storageKey !== fid && Object.prototype.hasOwnProperty.call(vals, storageKey)) {
        out[storageKey] = vals[storageKey];
      }
    });

    if (Object.prototype.hasOwnProperty.call(vals, CUSTOM_ATTR_LABELS_KEY)) {
      out[CUSTOM_ATTR_LABELS_KEY] = vals[CUSTOM_ATTR_LABELS_KEY];
    }

    return out;
  }

  function supportsManualInput(def) {
    var modes = (def && def.inputModes) || [];
    return Array.isArray(modes) && modes.indexOf('manual') >= 0;
  }

  function hashLabel(label) {
    var s = String(label || '');
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  /**
   * Stable custom id from original label. Different labels must not collide.
   * Original display text is kept separately in customAttrLabels — never show this slug to users.
   */
  function customAttrId(label, index) {
    var trimmed = String(label || '').trim();
    var base = 'custom:v' + hashLabel(trimmed || 'empty');
    if (index == null || index === 0) return base;
    return base + '_' + String(index);
  }

  function isAllowedCustomAttrId(id) {
    return typeof id === 'string' && /^custom:[A-Za-z0-9\u0600-\u06FF\-_.]{1,48}$/.test(id);
  }

  function cloneCustomLabelMap(raw) {
    var out = Object.create(null);
    if (!isPlainObject(raw)) return out;
    Object.keys(raw).forEach(function (fieldId) {
      var bag = raw[fieldId];
      if (!isPlainObject(bag)) return;
      out[fieldId] = Object.create(null);
      Object.keys(bag).forEach(function (id) {
        if (!isAllowedCustomAttrId(id)) return;
        var label = bag[id];
        if (typeof label !== 'string') return;
        out[fieldId][id] = label;
      });
    });
    return out;
  }

  function findCustomIdForLabel(labelMap, fieldId, label) {
    var bag = labelMap && labelMap[fieldId];
    if (!bag) return null;
    var keys = Object.keys(bag);
    for (var i = 0; i < keys.length; i++) {
      if (bag[keys[i]] === label) return keys[i];
    }
    return null;
  }

  /**
   * Allocate a stable custom id for an original label without colliding with a different label.
   * Reuses an existing id when the same original text is already mapped.
   */
  function allocateCustomAttrValue(label, fieldId, labelMap, usedIds) {
    var trimmed = String(label || '').trim();
    if (!trimmed) return null;
    if (trimmed.length > MAX_CUSTOM_LABEL_LEN) {
      return { error: 'الحد الأقصى لنص القيمة اليدوية ' + MAX_CUSTOM_LABEL_LEN + ' حرفًا.' };
    }
    if (!labelMap[fieldId]) labelMap[fieldId] = Object.create(null);
    var existingForLabel = findCustomIdForLabel(labelMap, fieldId, trimmed);
    if (existingForLabel) return { id: existingForLabel, label: trimmed };
    var used = usedIds || new Set();
    Object.keys(labelMap[fieldId]).forEach(function (id) {
      used.add(id);
    });
    var n = 0;
    var id = customAttrId(trimmed, 0);
    while (used.has(id) && labelMap[fieldId][id] !== trimmed) {
      n += 1;
      id = customAttrId(trimmed, n);
    }
    labelMap[fieldId][id] = trimmed;
    used.add(id);
    return { id: id, label: trimmed };
  }

  function displayLabelForCustomId(id, fieldId, labelMap) {
    if (!isAllowedCustomAttrId(id)) return id;
    var bag = labelMap && labelMap[fieldId];
    if (bag && typeof bag[id] === 'string' && bag[id]) return bag[id];
    // Legacy ids without a label map: keep id stable; do not invent a prettier rewrite.
    return String(id).replace(/^custom:/, '');
  }

  function normalizeDimensionsObject(raw) {
    if (raw == null) return null;
    if (!isPlainObject(raw)) return undefined;
    var out = {};
    ['w', 'h', 'd'].forEach(function (axis) {
      if (!Object.prototype.hasOwnProperty.call(raw, axis)) return;
      var v = raw[axis];
      if (v === null || v === '') return;
      var n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!Number.isFinite(n) || n < 0) {
        out[axis] = v;
      } else {
        out[axis] = n;
      }
    });
    return Object.keys(out).length ? out : null;
  }

  function dimensionsAxisInvalidKey(fieldId, axis) {
    return String(fieldId) + '.' + String(axis);
  }

  function parseDimensionsInvalidKey(key) {
    var m = String(key || '').match(/^(itemDimensions|dimensionsCm)\.(w|h|d)$/);
    if (!m) return null;
    return { fieldId: m[1], axis: m[2] };
  }

  function validateDimensionAxisValue(raw, unit) {
    return validateNumberValue({ id: 'dim', min: 0, unit: unit || 'cm' }, raw);
  }

  /** Prefer itemDimensions; fall back to legacy dimensionsCm without dropping either when identical. */
  function coalesceDimensions(attrs) {
    if (!isPlainObject(attrs)) return attrs;
    var item = normalizeDimensionsObject(attrs.itemDimensions);
    var legacy = normalizeDimensionsObject(attrs.dimensionsCm);
    if (item && !legacy) {
      attrs.itemDimensions = item;
      attrs.dimensionsCm = Object.assign({}, item);
    } else if (!item && legacy) {
      attrs.itemDimensions = Object.assign({}, legacy);
      attrs.dimensionsCm = legacy;
    } else if (item && legacy) {
      // Canonical editor field wins; keep legacy mirrored so one source stays authoritative.
      attrs.itemDimensions = item;
      attrs.dimensionsCm = Object.assign({}, item);
    }
    return attrs;
  }

  function validateNumberValue(def, raw) {
    if (raw === undefined) return { ok: true, value: undefined };
    if (raw === null) return { ok: true, value: null };
    var s = String(raw).trim();
    if (s === '') return { ok: true, value: null };
    if (!/^-?\d+(\.\d+)?$/.test(s) && !Number.isFinite(Number(s))) {
      return { ok: false, message: 'أدخلي رقمًا صالحًا أو اتركي الحقل فارغًا.' };
    }
    var n = Number(s);
    if (!Number.isFinite(n)) {
      return { ok: false, message: 'أدخلي رقمًا صالحًا أو اتركي الحقل فارغًا.' };
    }
    if (def && def.min != null && n < def.min) {
      return {
        ok: false,
        message: 'الحد الأدنى ' + def.min + (def.unit ? ' ' + def.unit : ''),
      };
    }
    if (def && def.max != null && n > def.max) {
      return {
        ok: false,
        message: 'الحد الأقصى ' + def.max + (def.unit ? ' ' + def.unit : ''),
      };
    }
    return { ok: true, value: n };
  }

  /**
   * Filter a captured editor state onto defs of a (possibly new) profile.
   * Compatible keys keep values+clears+invalidInputs; incompatible keys stay in parked*
   * so a later return to a compatible profile can restore them without sending them
   * while the active profile forbids them.
   */
  function projectStateOntoDefs(state, defs) {
    state = state || {};
    var values = isPlainObject(state.values) ? state.values : {};
    var cleared = state.cleared || {};
    var dirty = state.dirty || {};
    var invalidInputs = state.invalidInputs || {};
    var allowed = Object.create(null);
    (defs || []).forEach(function (def) {
      var key = storageAttrKey(def);
      if (key) allowed[key] = def;
    });
    var nextValues = {};
    var nextCleared = Object.create(null);
    var nextDirty = Object.create(null);
    var nextInvalid = Object.create(null);
    var parked = Object.assign({}, isPlainObject(state.parked) ? state.parked : {});
    var parkedCleared = Object.assign({}, state.parkedCleared || {});
    var parkedDirty = Object.assign({}, state.parkedDirty || {});
    var parkedInvalid = Object.assign({}, state.parkedInvalid || {});

    Object.keys(values).forEach(function (k) {
      if (allowed[k]) nextValues[k] = values[k];
      else parked[k] = values[k];
    });
    Object.keys(cleared).forEach(function (k) {
      if (allowed[k]) {
        nextCleared[k] = true;
        delete nextValues[k];
      } else {
        parkedCleared[k] = true;
        if (!Object.prototype.hasOwnProperty.call(parked, k)) parked[k] = null;
      }
    });
    Object.keys(dirty).forEach(function (k) {
      if (allowed[k]) nextDirty[k] = true;
      else parkedDirty[k] = true;
    });
    /**
     * Map invalid-input keys that may be field ids onto storage keys for the active defs.
     * Falls back to the raw key when no mapping exists (parked keys from another profile).
     */
    function resolveInvalidStorageKey(k) {
      if (allowed[k]) return k;
      for (var i = 0; i < (defs || []).length; i++) {
        var def = defs[i];
        if (def && def.id === k) {
          var sk = storageAttrKey(def);
          if (sk) return sk;
        }
      }
      return k;
    }

    Object.keys(invalidInputs).forEach(function (k) {
      var sk = resolveInvalidStorageKey(k);
      if (allowed[sk]) {
        // Keep field-id keys for mount paint/validate (def.id).
        nextInvalid[allowed[sk].id || sk] = invalidInputs[k];
      } else {
        parkedInvalid[sk] = invalidInputs[k];
      }
    });

    function findAllowedDef(k) {
      if (allowed[k]) return allowed[k];
      var found = null;
      Object.keys(allowed).forEach(function (sk) {
        if (allowed[sk] && allowed[sk].id === k) found = allowed[sk];
      });
      return found;
    }

    // Restore parked entries that are compatible with the new profile.
    Object.keys(parkedCleared).forEach(function (k) {
      var def = findAllowedDef(k);
      if (!def) return;
      var sk = storageAttrKey(def) || k;
      nextCleared[sk] = true;
      delete nextValues[sk];
      if (parkedDirty[k] || parkedDirty[sk]) nextDirty[sk] = true;
      if (Object.prototype.hasOwnProperty.call(parkedInvalid, k) || Object.prototype.hasOwnProperty.call(parkedInvalid, sk)) {
        nextInvalid[def.id] = parkedInvalid[k] != null ? parkedInvalid[k] : parkedInvalid[sk];
      }
      delete parked[k];
      delete parked[sk];
      delete parkedCleared[k];
      delete parkedCleared[sk];
      delete parkedDirty[k];
      delete parkedDirty[sk];
      delete parkedInvalid[k];
      delete parkedInvalid[sk];
    });
    Object.keys(parked).forEach(function (k) {
      var def = findAllowedDef(k);
      if (!def) return;
      var sk = storageAttrKey(def) || k;
      if (nextCleared[sk]) {
        delete parked[k];
        delete parked[sk];
        delete parkedDirty[k];
        delete parkedDirty[sk];
        delete parkedInvalid[k];
        delete parkedInvalid[sk];
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(nextValues, sk)) {
        nextValues[sk] = parked[k];
        if (parkedDirty[k] || parkedDirty[sk]) nextDirty[sk] = true;
      }
      // invalid raw may accompany a prior value — prefer invalid for blocking UI
      if (Object.prototype.hasOwnProperty.call(parkedInvalid, k) || Object.prototype.hasOwnProperty.call(parkedInvalid, sk)) {
        nextInvalid[def.id] = parkedInvalid[k] != null ? parkedInvalid[k] : parkedInvalid[sk];
        nextDirty[sk] = true;
        delete parkedInvalid[k];
        delete parkedInvalid[sk];
      }
      delete parked[k];
      delete parked[sk];
      delete parkedDirty[k];
      delete parkedDirty[sk];
    });

    // R01: restore parked invalid raw input even when no prior valid value / clear exists.
    Object.keys(parkedInvalid).forEach(function (k) {
      var def = findAllowedDef(k);
      if (!def) return;
      var sk = storageAttrKey(def) || k;
      nextInvalid[def.id] = parkedInvalid[k];
      nextDirty[sk] = true;
      delete parkedInvalid[k];
      delete parkedDirty[k];
      delete parkedDirty[sk];
      delete parked[k];
      delete parked[sk];
    });

    return {
      values: nextValues,
      cleared: nextCleared,
      dirty: nextDirty,
      invalidInputs: nextInvalid,
      parked: parked,
      parkedCleared: parkedCleared,
      parkedDirty: parkedDirty,
      parkedInvalid: parkedInvalid,
      /** Remaining parked keys (for UI notice) — not sent while incompatible. */
      incompatible: parked,
    };
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null) return;
        if (k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'disabled') node.disabled = !!v;
        else if (k === 'checked') node.checked = !!v;
        else if (k === 'value') {
          node.value = v;
          node.setAttribute('value', v);
        } else if (k === 'hidden') node.hidden = !!v;
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /**
   * @param {HTMLElement} host
   * @param {object} options
   */
  function mount(host, options) {
    if (!host) throw new Error('registry-attribute-fields: host required');
    options = options || {};
    var registry = options.registry;
    var profileId = options.profileId;
    var readOnly = !!options.readOnly;
    var mountId = String(options.mountId || 'm' + ++mountSeq);
    var defs = attributeFieldDefsForProfile(registry, profileId, {
      includeComponentContract: !!options.includeComponentContract,
    });

    var values = {};
    var cleared = Object.create(null);
    var dirty = Object.create(null);
    var fieldErrors = Object.create(null);
    /** Invalid typed number strings that must block save. */
    var invalidInputs = Object.create(null);
    /** Parked (incompatible-with-active-profile) editor bag — survives remount via captureEditorState. */
    var parkedBag = Object.create(null);
    var parkedClearedBag = Object.create(null);
    var parkedDirtyBag = Object.create(null);
    var parkedInvalidBag = Object.create(null);
    var incompatibleNotice = null;
    var editRevision = 0;

    function bumpEditRevision() {
      editRevision += 1;
    }

    var inputModes = Object.create(null);
    var manualDrafts = Object.create(null);
    var customLabelMap = Object.create(null);

    function seedFrom(attrs, opts) {
      opts = opts || {};
      values = {};
      cleared = Object.create(null);
      dirty = Object.create(null);
      fieldErrors = Object.create(null);
      invalidInputs = Object.create(null);
      inputModes = Object.create(null);
      manualDrafts = Object.create(null);
      customLabelMap = Object.create(null);
      if (!isPlainObject(attrs) && !(opts.cleared && Object.keys(opts.cleared).length)) return;
      if (isPlainObject(attrs)) {
        coalesceDimensions(attrs);
        if (isPlainObject(attrs[CUSTOM_ATTR_LABELS_KEY])) {
          customLabelMap = cloneCustomLabelMap(attrs[CUSTOM_ATTR_LABELS_KEY]);
        }
        defs.forEach(function (def) {
          var key = storageAttrKey(def);
          if (!key) return;
          if (Object.prototype.hasOwnProperty.call(attrs, key)) {
            values[key] = attrs[key];
          }
        });
        Object.keys(attrs).forEach(function (k) {
          if (k === CUSTOM_ATTR_LABELS_KEY) return;
          if (!Object.prototype.hasOwnProperty.call(values, k)) {
            values[k] = attrs[k];
          }
        });
        // Restore manual mode + original labels when saved values include custom: ids.
        defs.forEach(function (def) {
          if (!supportsManualInput(def)) return;
          var key = storageAttrKey(def);
          var cur = values[key];
          if (Array.isArray(cur) && cur.some(isAllowedCustomAttrId)) {
            inputModes[def.id] = 'manual';
            manualDrafts[def.id] = cur
              .filter(isAllowedCustomAttrId)
              .map(function (id) {
                return displayLabelForCustomId(id, def.id, customLabelMap);
              })
              .join('، ');
          } else if (typeof cur === 'string' && isAllowedCustomAttrId(cur)) {
            inputModes[def.id] = 'manual';
            manualDrafts[def.id] = displayLabelForCustomId(cur, def.id, customLabelMap);
          }
        });
      }
      if (opts.cleared) {
        Object.keys(opts.cleared).forEach(function (k) {
          if (opts.cleared[k]) {
            cleared[k] = true;
            delete values[k];
          }
        });
      }
      if (opts.dirty) {
        Object.keys(opts.dirty).forEach(function (k) {
          if (opts.dirty[k]) dirty[k] = true;
        });
      }
      if (opts.invalidInputs) {
        Object.keys(opts.invalidInputs).forEach(function (k) {
          invalidInputs[k] = opts.invalidInputs[k];
        });
      }
      if (opts.customLabelMap) {
        customLabelMap = cloneCustomLabelMap(opts.customLabelMap);
      }
    }

    function applyInitial() {
      var projected = null;
      if (options.preserveState) {
        projected = projectStateOntoDefs(options.preserveState, defs);
        parkedBag = Object.assign(Object.create(null), projected.parked || {});
        parkedClearedBag = Object.assign(Object.create(null), projected.parkedCleared || {});
        parkedDirtyBag = Object.assign(Object.create(null), projected.parkedDirty || {});
        parkedInvalidBag = Object.assign(Object.create(null), projected.parkedInvalid || {});
        incompatibleNotice = projected.incompatible;
        seedFrom(projected.values, {
          cleared: projected.cleared,
          dirty: projected.dirty,
          invalidInputs: projected.invalidInputs,
        });
        if (options.preserveState && options.preserveState.inputModes) {
          inputModes = Object.assign(Object.create(null), options.preserveState.inputModes);
        }
        if (options.preserveState && options.preserveState.manualDrafts) {
          manualDrafts = Object.assign(Object.create(null), options.preserveState.manualDrafts);
        }
        if (options.preserveState && options.preserveState.customLabelMap) {
          customLabelMap = cloneCustomLabelMap(options.preserveState.customLabelMap);
        }
        // Also seed any compatible keys from server seed that weren't dirty
        var server = options.initialAttributes;
        if (isPlainObject(server)) {
          if (isPlainObject(server[CUSTOM_ATTR_LABELS_KEY]) && !Object.keys(customLabelMap).length) {
            customLabelMap = cloneCustomLabelMap(server[CUSTOM_ATTR_LABELS_KEY]);
          }
          defs.forEach(function (def) {
            var key = storageAttrKey(def);
            if (!key) return;
            if (dirty[key] || cleared[key]) return;
            if (Object.prototype.hasOwnProperty.call(server, key) && !Object.prototype.hasOwnProperty.call(values, key)) {
              values[key] = server[key];
            }
          });
        }
      } else {
        seedFrom(options.initialAttributes || null);
      }
    }

    applyInitial();

    /**
     * @param {{ source?: 'user'|'server'|'hydrate'|'programmatic' }} [meta]
     * source=user → real editor input (bumps host form epoch / autosave).
     * source=server|hydrate|programmatic → fill from API/paint; must not look like a user edit.
     */
    function notify(meta) {
      meta = meta || {};
      var source = meta.source || 'user';
      if (typeof options.onChange === 'function') {
        options.onChange({
          values: Object.assign({}, values),
          dirty: Object.assign({}, dirty),
          cleared: Object.assign({}, cleared),
          attributesPatch: buildAttributesPatch(),
          blockingErrors: validateAll().errors,
          source: source,
        });
      }
    }

    function setError(fieldId, message) {
      if (!message) delete fieldErrors[fieldId];
      else fieldErrors[fieldId] = message;
      var errEl = host.querySelector('[data-attr-error="' + fieldId + '"]');
      if (errEl) {
        errEl.textContent = message || '';
        errEl.hidden = !message;
      }
    }

    function markDirty(key, nextVal) {
      dirty[key] = true;
      bumpEditRevision();
      if (nextVal === null || nextVal === undefined) {
        cleared[key] = true;
        delete values[key];
      } else {
        delete cleared[key];
        values[key] = nextVal;
      }
      // Keep legacy dimensionsCm aligned with itemDimensions (single editor source).
      if (key === 'itemDimensions') {
        dirty.dimensionsCm = true;
        if (nextVal === null || nextVal === undefined) {
          cleared.dimensionsCm = true;
          delete values.dimensionsCm;
        } else {
          delete cleared.dimensionsCm;
          values.dimensionsCm = nextVal;
        }
      }
      notify({ source: 'user' });
    }

    /**
     * Apply server attributes onto clean keys only — never overwrite dirty/cleared/invalid local edits.
     * Notifies with source=server so hosts do not bump user-edit epochs / autosave.
     */
    function applyServerSnapshot(serverAttrs, opts) {
      opts = opts || {};
      var onlyClean = opts.onlyClean !== false;
      if (!isPlainObject(serverAttrs)) return;
      defs.forEach(function (def) {
        var key = storageAttrKey(def);
        if (!key) return;
        if (
          onlyClean &&
          (dirty[key] ||
            cleared[key] ||
            fieldHasBlockingInvalid(def.id) ||
            Object.prototype.hasOwnProperty.call(invalidInputs, def.id) ||
            Object.prototype.hasOwnProperty.call(invalidInputs, key))
        ) {
          return;
        }
        if (Object.prototype.hasOwnProperty.call(serverAttrs, key)) {
          values[key] = serverAttrs[key];
          delete cleared[key];
          if (!onlyClean) delete dirty[key];
        }
      });
      if (isPlainObject(serverAttrs[CUSTOM_ATTR_LABELS_KEY]) && !dirty[CUSTOM_ATTR_LABELS_KEY]) {
        customLabelMap = cloneCustomLabelMap(serverAttrs[CUSTOM_ATTR_LABELS_KEY]);
      }
      paint();
      notify({ source: 'server' });
    }

    function visibilityCtx() {
      return {
        subcategory: options.subcategory || '',
        category: options.category || '',
        profileId: profileId,
      };
    }

    function isDefVisible(def) {
      return fieldDependsVisible(def, visibilityCtx());
    }

    function fieldHasBlockingInvalid(fieldId) {
      if (Object.prototype.hasOwnProperty.call(invalidInputs, fieldId)) return true;
      var prefix = String(fieldId) + '.';
      return Object.keys(invalidInputs).some(function (k) {
        return k === fieldId || k.indexOf(prefix) === 0;
      });
    }

    function buildCustomAttrLabelsPatch() {
      var out = Object.create(null);
      Object.keys(customLabelMap).forEach(function (fieldId) {
        var bag = customLabelMap[fieldId];
        if (!bag) return;
        var next = Object.create(null);
        Object.keys(bag).forEach(function (id) {
          next[id] = bag[id];
        });
        if (Object.keys(next).length) out[fieldId] = next;
      });
      return Object.keys(out).length ? out : null;
    }

    function buildAttributesPatch() {
      var patch = {};
      var ctx = visibilityCtx();
      Object.keys(dirty).forEach(function (key) {
        if (key === CUSTOM_ATTR_LABELS_KEY) return;
        var def = defs.find(function (d) {
          return storageAttrKey(d) === key;
        });
        // Hidden-by-dependsOn values must not be sent with the active subcategory.
        if (def && !fieldDependsVisible(def, ctx)) {
          if (Object.prototype.hasOwnProperty.call(values, key)) {
            parkedBag[key] = values[key];
          }
          return;
        }
        // Never emit a stale committed value while the user still has an invalid typed draft.
        if (def && fieldHasBlockingInvalid(def.id)) return;
        if (key === 'itemDimensions' && fieldHasBlockingInvalid('itemDimensions')) return;
        if (cleared[key]) patch[key] = null;
        else if (Object.prototype.hasOwnProperty.call(values, key)) patch[key] = values[key];
      });
      if (dirty[CUSTOM_ATTR_LABELS_KEY] || Object.keys(customLabelMap).length) {
        var labels = buildCustomAttrLabelsPatch();
        if (labels) patch[CUSTOM_ATTR_LABELS_KEY] = labels;
        else if (dirty[CUSTOM_ATTR_LABELS_KEY]) patch[CUSTOM_ATTR_LABELS_KEY] = null;
      }
      return patch;
    }

    function buildFlatValues() {
      var flat = {};
      var ctx = visibilityCtx();
      defs.forEach(function (def) {
        if (!fieldDependsVisible(def, ctx)) return;
        var key = storageAttrKey(def);
        if (!key) return;
        if (fieldHasBlockingInvalid(def.id)) return;
        if (cleared[key]) {
          flat[def.id] = null;
          return;
        }
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          flat[def.id] = values[key];
        }
      });
      var labels = buildCustomAttrLabelsPatch();
      if (labels) flat[CUSTOM_ATTR_LABELS_KEY] = labels;
      return flat;
    }

    function currentValue(key) {
      if (cleared[key]) return null;
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    }

    function invalidRawForDef(def) {
      if (!def) return undefined;
      if (Object.prototype.hasOwnProperty.call(invalidInputs, def.id)) return invalidInputs[def.id];
      var key = storageAttrKey(def);
      if (key && Object.prototype.hasOwnProperty.call(invalidInputs, key)) return invalidInputs[key];
      return undefined;
    }

    function validateAll() {
      var errors = [];
      var seen = Object.create(null);
      defs.forEach(function (def) {
        var raw = invalidRawForDef(def);
        if (raw === undefined) return;
        seen[def.id] = true;
        var v = validateNumberValue(def, raw);
        if (!v.ok) {
          errors.push({ fieldId: def.id, message: v.message });
          setError(def.id, v.message);
        }
      });
      Object.keys(invalidInputs).forEach(function (key) {
        if (seen[key]) return;
        var dimKey = parseDimensionsInvalidKey(key);
        if (dimKey) {
          seen[key] = true;
          var rawDim = invalidInputs[key];
          var unit =
            (defs.find(function (d) {
              return d.id === dimKey.fieldId;
            }) || {}).unit || 'cm';
          var dv = validateDimensionAxisValue(rawDim, unit);
          if (!dv.ok) {
            errors.push({ fieldId: dimKey.fieldId, message: dv.message, axis: dimKey.axis });
            setError(dimKey.fieldId, dv.message);
          }
          return;
        }
        var def = defs.find(function (d) {
          return d.id === key || storageAttrKey(d) === key;
        });
        var raw = invalidInputs[key];
        var v = validateNumberValue(def || { id: key }, raw);
        if (!v.ok) {
          errors.push({ fieldId: (def && def.id) || key, message: v.message });
          setError((def && def.id) || key, v.message);
        }
      });
      defs.forEach(function (def) {
        if (!(def.type === 'number' || def.widget === 'number')) return;
        if (invalidRawForDef(def) !== undefined) return;
        var key = storageAttrKey(def);
        if (!key) return;
        if (!Object.prototype.hasOwnProperty.call(values, key) && !cleared[key]) return;
        var cur = cleared[key] ? null : values[key];
        if (cur == null) return;
        var v = validateNumberValue(def, cur);
        if (!v.ok) {
          errors.push({ fieldId: def.id, message: v.message });
          setError(def.id, v.message);
        }
      });
      // Validate committed dimension objects too (negative / non-numeric axes).
      defs.forEach(function (def) {
        if (!(def.widget === 'dimensions' || def.id === 'itemDimensions' || def.type === 'object')) return;
        if (def.id !== 'itemDimensions' && def.widget !== 'dimensions') return;
        var key = storageAttrKey(def);
        if (!key || cleared[key]) return;
        var cur = values[key];
        if (!isPlainObject(cur)) return;
        var unit = def.unit || 'cm';
        ['w', 'h', 'd'].forEach(function (axis) {
          if (!Object.prototype.hasOwnProperty.call(cur, axis)) return;
          if (Object.prototype.hasOwnProperty.call(invalidInputs, dimensionsAxisInvalidKey(def.id, axis))) return;
          var axisVal = cur[axis];
          var dv = validateDimensionAxisValue(axisVal, unit);
          if (!dv.ok) {
            errors.push({ fieldId: def.id, message: dv.message, axis: axis });
            setError(def.id, dv.message);
          }
        });
      });
      return { ok: errors.length === 0, errors: errors };
    }

    function captureEditorState() {
      return {
        values: Object.assign({}, values),
        cleared: Object.assign({}, cleared),
        dirty: Object.assign({}, dirty),
        invalidInputs: Object.assign({}, invalidInputs),
        inputModes: Object.assign({}, inputModes),
        manualDrafts: Object.assign({}, manualDrafts),
        customLabelMap: cloneCustomLabelMap(customLabelMap),
        parked: Object.assign({}, parkedBag),
        parkedCleared: Object.assign({}, parkedClearedBag),
        parkedDirty: Object.assign({}, parkedDirtyBag),
        parkedInvalid: Object.assign({}, parkedInvalidBag),
        profileId: profileId,
        mountId: mountId,
        editRevision: editRevision,
      };
    }

    function syncErrorsFromInvalidInputs() {
      Object.keys(invalidInputs).forEach(function (key) {
        var dimKey = parseDimensionsInvalidKey(key);
        if (dimKey) {
          var unit =
            (defs.find(function (d) {
              return d.id === dimKey.fieldId;
            }) || {}).unit || 'cm';
          var dv = validateDimensionAxisValue(invalidInputs[key], unit);
          if (!dv.ok) fieldErrors[dimKey.fieldId] = dv.message;
          return;
        }
        var def = defs.find(function (d) {
          return d.id === key || storageAttrKey(d) === key;
        });
        var raw = invalidInputs[key];
        var v = validateNumberValue(def || { id: key }, raw);
        if (!v.ok) fieldErrors[(def && def.id) || key] = v.message;
      });
    }

    function paint() {
      host.innerHTML = '';
      host.classList.add('mira-attr-fields');
      host.setAttribute('dir', 'rtl');
      host.setAttribute('data-mount-id', mountId);
      syncErrorsFromInvalidInputs();

      var parkedKeys = Object.keys(parkedBag);
      if (parkedKeys.length) {
        incompatibleNotice = parkedBag;
        host.appendChild(
          el('p', {
            className: 'lead mira-attr-incompatible',
            'data-testid': 'attr-incompatible-notice',
            text:
              'قيم محفوظة مؤقتًا لهذا العنصر فقط — ستُستعاد عند الرجوع لتصنيف يدعمها، ولن تُرسل مع التصنيف الحالي: ' +
              parkedKeys.join('، '),
          }),
        );
      } else {
        incompatibleNotice = null;
      }

      if (!defs.length) {
        host.appendChild(
          el('p', {
            className: 'lead mira-attr-empty',
            text: 'لا حقول خصائص مدعومة لهذا الملف في المرحلة الحالية.',
          }),
        );
        return;
      }

      var visibilityCtx = {
        subcategory: options.subcategory || '',
        category: options.category || '',
        profileId: profileId,
      };
      defs.forEach(function (def) {
        if (!fieldDependsVisible(def, visibilityCtx)) return;
        var key = storageAttrKey(def);
        var tier = def.supportTier || classifyField(def);
        var block = el('div', {
          className: 'mira-attr-field',
          'data-field-id': def.id,
          'data-support': tier,
        });
        var title = el('div', { className: 'mira-attr-label' });
        title.appendChild(document.createTextNode(def.labelAr || def.id));
        if (tier === 'component') {
          title.appendChild(
            el('span', {
              className: 'mira-attr-badge',
              text: ' مكوّن E2 — حفظ الفئة E4',
            }),
          );
        } else if (tier === 'read') {
          title.appendChild(el('span', { className: 'mira-attr-badge', text: ' قراءة فقط' }));
        }
        block.appendChild(title);

        var cur = currentValue(key);
        var disabled =
          readOnly || tier === 'read' || (tier === 'component' && options.persistComponentContract !== true);

        if (supportsManualInput(def) && !disabled) {
          var mode = inputModes[def.id] || 'ready';
          var modeRow = el('div', {
            className: 'choice-row input-mode-row',
            'data-testid': 'attr-input-mode-' + def.id,
          });
          [['ready', 'اختيار جاهز'], ['manual', 'كتابة يدوية']].forEach(function (pair) {
            var id = pair[0];
            var labelText = pair[1];
            var lab = el('label', {
              className: 'input-mode-choice' + (mode === id ? ' is-selected' : ''),
            });
            var radio = el('input', {
              type: 'radio',
              name: 'attr-mode-' + mountId + '-' + def.id,
              value: id,
            });
            radio.checked = mode === id;
            radio.addEventListener('change', function () {
              if (!radio.checked) return;
              inputModes[def.id] = id;
              // Preserve ready/manual drafts across mode switches; do not wipe values.
              paint();
              notify({ source: 'user' });
            });
            lab.appendChild(radio);
            lab.appendChild(document.createTextNode(' ' + labelText));
            modeRow.appendChild(lab);
          });
          block.appendChild(modeRow);
        }

        var attrMode = inputModes[def.id] || 'ready';

        if (def.type === 'array' && (def.widget === 'chips' || !def.widget)) {
          var row = el('div', {
            className: 'choice-row mira-attr-chips',
            role: 'group',
            'aria-label': def.labelAr || def.id,
          });
          if (supportsManualInput(def) && attrMode === 'manual') row.hidden = true;
          var selected = Array.isArray(cur) ? cur.slice() : [];
          (def.values || []).forEach(function (vid) {
            var lab = el('label', {
              className: 'mira-attr-chip' + (selected.indexOf(vid) >= 0 ? ' is-selected' : ''),
            });
            var cb = el('input', { type: 'checkbox', value: vid, disabled: disabled });
            cb.checked = selected.indexOf(vid) >= 0;
            cb.setAttribute('aria-label', labelFor(def, vid));
            cb.addEventListener('change', function () {
              var next = Array.isArray(currentValue(key)) ? currentValue(key).slice() : [];
              var idx = next.indexOf(vid);
              if (cb.checked && idx < 0) next.push(vid);
              if (!cb.checked && idx >= 0) next.splice(idx, 1);
              lab.classList.toggle('is-selected', cb.checked);
              setError(def.id, '');
              if (next.length === 0) markDirty(key, null);
              else markDirty(key, next);
            });
            lab.appendChild(cb);
            lab.appendChild(document.createTextNode(' ' + labelFor(def, vid)));
            row.appendChild(lab);
          });
          block.appendChild(row);
          if (supportsManualInput(def) && !disabled) {
            var manualLab = el('label', {
              className: 'manual-input-label',
              text: 'كتابة يدوية (فاصلة عربية أو إنجليزية؛ تُحفظ كقيم custom: مستقرة)',
            });
            manualLab.hidden = attrMode !== 'manual';
            var manualIn = el('input', {
              type: 'text',
              'data-testid': 'attr-manual-' + def.id,
              value: manualDrafts[def.id] || '',
            });
            manualIn.addEventListener('input', function () {
              manualDrafts[def.id] = manualIn.value;
              var split =
                global.MiraCatalogOptions && typeof global.MiraCatalogOptions.splitCustomLabels === 'function'
                  ? global.MiraCatalogOptions.splitCustomLabels
                  : function (raw) {
                      return String(raw || '')
                        .split(/[,،]+/)
                        .map(function (p) {
                          return p.trim();
                        })
                        .filter(Boolean);
                    };
              var parts = split(manualIn.value);
              var used = new Set();
              var next = [];
              var errMsg = '';
              // Drop previous labels for this field then re-allocate from current draft text.
              customLabelMap[def.id] = Object.create(null);
              for (var pi = 0; pi < parts.length; pi++) {
                var allocated = allocateCustomAttrValue(parts[pi], def.id, customLabelMap, used);
                if (allocated && allocated.error) {
                  errMsg = allocated.error;
                  break;
                }
                if (allocated && allocated.id) next.push(allocated.id);
              }
              dirty[CUSTOM_ATTR_LABELS_KEY] = true;
              if (errMsg) {
                setError(def.id, errMsg);
                dirty[key] = true;
                bumpEditRevision();
                notify({ source: 'user' });
                return;
              }
              setError(def.id, '');
              if (!next.length) markDirty(key, null);
              else markDirty(key, next);
            });
            manualLab.appendChild(manualIn);
            block.appendChild(manualLab);
          }
        } else if (def.type === 'enum' || def.widget === 'select') {
          var groupName = 'mira-attr-' + mountId + '-' + def.id;
          var group = el('div', {
            className: 'choice-row mira-attr-single',
            role: 'radiogroup',
            'aria-label': def.labelAr || def.id,
            'data-radio-group': groupName,
          });
          if (supportsManualInput(def) && attrMode === 'manual') group.hidden = true;
          (def.values || []).forEach(function (vid) {
            var lab = el('label', {
              className: 'mira-attr-choice' + (cur === vid ? ' is-selected' : ''),
            });
            var radio = el('input', {
              type: 'radio',
              name: groupName,
              value: vid,
              disabled: disabled,
            });
            radio.checked = cur === vid;
            radio.setAttribute('aria-label', labelFor(def, vid));
            radio.addEventListener('change', function () {
              if (!radio.checked) return;
              Array.prototype.forEach.call(group.querySelectorAll('.mira-attr-choice'), function (n) {
                n.classList.remove('is-selected');
              });
              Array.prototype.forEach.call(group.querySelectorAll('input[type=radio]'), function (r) {
                r.checked = r === radio;
              });
              lab.classList.add('is-selected');
              setError(def.id, '');
              markDirty(key, vid);
            });
            lab.appendChild(radio);
            lab.appendChild(document.createTextNode(' ' + labelFor(def, vid)));
            group.appendChild(lab);
          });
          if (!disabled && def.nullMeaning) {
            var clearBtn = el('button', {
              type: 'button',
              className: 'btn btn-ghost mira-attr-clear',
              text: 'مسح',
              'data-testid': 'attr-clear-' + def.id,
            });
            clearBtn.addEventListener('click', function () {
              Array.prototype.forEach.call(group.querySelectorAll('input[type=radio]'), function (r) {
                r.checked = false;
              });
              Array.prototype.forEach.call(group.querySelectorAll('.mira-attr-choice'), function (n) {
                n.classList.remove('is-selected');
              });
              markDirty(key, null);
            });
            block.appendChild(group);
            block.appendChild(clearBtn);
          } else {
            block.appendChild(group);
          }
          if (supportsManualInput(def) && !disabled) {
            var enumManualLab = el('label', {
              className: 'manual-input-label',
              text: 'كتابة يدوية لقيمة مخصصة (تُحفظ كـ custom:…)',
            });
            enumManualLab.hidden = attrMode !== 'manual';
            var enumManualIn = el('input', {
              type: 'text',
              'data-testid': 'attr-manual-' + def.id,
              value: manualDrafts[def.id] || '',
            });
            enumManualIn.addEventListener('input', function () {
              manualDrafts[def.id] = enumManualIn.value;
              var label = String(enumManualIn.value || '').trim();
              customLabelMap[def.id] = Object.create(null);
              dirty[CUSTOM_ATTR_LABELS_KEY] = true;
              if (!label) {
                setError(def.id, '');
                markDirty(key, null);
                return;
              }
              var allocated = allocateCustomAttrValue(label, def.id, customLabelMap, new Set());
              if (allocated && allocated.error) {
                setError(def.id, allocated.error);
                dirty[key] = true;
                bumpEditRevision();
                notify({ source: 'user' });
                return;
              }
              setError(def.id, '');
              markDirty(key, allocated.id);
            });
            enumManualLab.appendChild(enumManualIn);
            block.appendChild(enumManualLab);
          }
        } else if (def.widget === 'dimensions' || def.id === 'itemDimensions') {
          var dimCur = normalizeDimensionsObject(cur) || {};
          var dimRow = el('div', {
            className: 'mira-attr-dimensions',
            'data-testid': 'attr-dimensions-' + def.id,
          });
          var unit = def.unit || 'cm';
          [['w', 'العرض'], ['h', 'الارتفاع'], ['d', 'العمق']].forEach(function (pair) {
            var axis = pair[0];
            var axisLabel = pair[1];
            var axisInvalidKey = dimensionsAxisInvalidKey(def.id, axis);
            var lab = el('label', { className: 'mira-attr-dim-field', text: axisLabel + ' (' + unit + ')' });
            var inp = el('input', {
              type: 'number',
              min: '0',
              step: 'any',
              'data-dim-axis': axis,
              'data-testid': 'attr-dim-' + def.id + '-' + axis,
              disabled: disabled,
            });
            if (Object.prototype.hasOwnProperty.call(invalidInputs, axisInvalidKey)) {
              inp.value = String(invalidInputs[axisInvalidKey]);
            } else if (dimCur[axis] != null && dimCur[axis] !== '') {
              inp.value = String(dimCur[axis]);
            }
            function commitDim() {
              var next = Object.assign({}, normalizeDimensionsObject(currentValue(key)) || {});
              var raw = String(inp.value || '').trim();
              if (raw === '') {
                delete next[axis];
                delete invalidInputs[axisInvalidKey];
                setError(def.id, '');
              } else {
                var v = validateDimensionAxisValue(raw, unit);
                if (!v.ok) {
                  invalidInputs[axisInvalidKey] = raw;
                  dirty[key] = true;
                  bumpEditRevision();
                  setError(def.id, v.message);
                  notify({ source: 'user' });
                  return;
                }
                delete invalidInputs[axisInvalidKey];
                next[axis] = v.value;
                setError(def.id, '');
              }
              if (!Object.keys(next).length) markDirty(key, null);
              else markDirty(key, next);
            }
            inp.addEventListener('change', commitDim);
            inp.addEventListener('input', function () {
              var raw = String(inp.value || '').trim();
              if (raw === '') {
                delete invalidInputs[axisInvalidKey];
                // Partial clear of one axis is committed only on change/blur; keep typing free.
                setError(def.id, '');
                return;
              }
              var v = validateDimensionAxisValue(raw, unit);
              if (!v.ok) {
                invalidInputs[axisInvalidKey] = raw;
                dirty[key] = true;
                bumpEditRevision();
                setError(def.id, v.message);
                notify({ source: 'user' });
              } else {
                delete invalidInputs[axisInvalidKey];
                setError(def.id, '');
              }
            });
            lab.appendChild(inp);
            dimRow.appendChild(lab);
          });
          if (!disabled) {
            var clearDim = el('button', {
              type: 'button',
              className: 'btn btn-ghost mira-attr-clear',
              text: 'مسح الأبعاد',
              'data-testid': 'attr-clear-' + def.id,
            });
            clearDim.addEventListener('click', function () {
              ['w', 'h', 'd'].forEach(function (axis) {
                delete invalidInputs[dimensionsAxisInvalidKey(def.id, axis)];
              });
              setError(def.id, '');
              markDirty(key, null);
              paint();
            });
            dimRow.appendChild(clearDim);
          }
          block.appendChild(dimRow);
        } else if (def.type === 'object') {
          block.appendChild(
            el('p', {
              className: 'lead',
              text: 'نوع الحقل غير معروض في E2: ' + (def.widget || def.type),
            }),
          );
        } else if (def.type === 'number' || def.widget === 'number') {
          var num = el('input', {
            type: 'number',
            className: 'mira-attr-number',
            disabled: disabled,
            'data-field-id': def.id,
          });
          if (def.min != null) num.min = String(def.min);
          if (def.max != null) num.max = String(def.max);
          if (def.unit) num.setAttribute('data-unit', def.unit);
          var invalidRaw = invalidRawForDef(def);
          if (invalidRaw != null) num.value = String(invalidRaw);
          else if (cur != null && cur !== '') num.value = String(cur);
          var unitHint = def.unit ? el('span', { className: 'mira-attr-unit', text: ' ' + def.unit }) : null;
          function commitNumber() {
            var raw = String(num.value || '').trim();
            if (raw === '') {
              delete invalidInputs[def.id];
              setError(def.id, '');
              markDirty(key, null);
              return;
            }
            var v = validateNumberValue(def, raw);
            if (!v.ok) {
              invalidInputs[def.id] = raw;
              // Track as user edit without installing an out-of-range value into values.
              dirty[key] = true;
              bumpEditRevision();
              setError(def.id, v.message);
              notify({ source: 'user' });
              return;
            }
            delete invalidInputs[def.id];
            setError(def.id, '');
            markDirty(key, v.value);
          }
          num.addEventListener('input', function () {
            var raw = String(num.value || '').trim();
            if (raw === '') {
              delete invalidInputs[def.id];
              setError(def.id, '');
              return;
            }
            var v = validateNumberValue(def, raw);
            if (!v.ok) {
              invalidInputs[def.id] = raw;
              dirty[key] = true;
              bumpEditRevision();
              setError(def.id, v.message);
              notify({ source: 'user' });
            } else {
              delete invalidInputs[def.id];
              setError(def.id, '');
            }
          });
          num.addEventListener('change', commitNumber);
          var numRow = el('div', { className: 'mira-attr-number-row' }, [num]);
          if (unitHint) numRow.appendChild(unitHint);
          block.appendChild(numRow);
        } else {
          block.appendChild(
            el('p', {
              className: 'lead',
              text: 'نوع الحقل غير معروض في E2: ' + (def.widget || def.type),
            }),
          );
        }

        var err = el('div', {
          className: 'field-error mira-attr-error',
          'data-attr-error': def.id,
          text: fieldErrors[def.id] || '',
        });
        err.hidden = !fieldErrors[def.id];
        block.appendChild(err);
        host.appendChild(block);
      });
    }

    paint();

    return {
      destroy: function () {
        host.innerHTML = '';
      },
      mountId: mountId,
      getAttributesPatch: buildAttributesPatch,
      getFlatValues: buildFlatValues,
      getValues: function () {
        var out = Object.assign({}, values);
        var labels = buildCustomAttrLabelsPatch();
        if (labels) out[CUSTOM_ATTR_LABELS_KEY] = labels;
        return out;
      },
      getCustomAttrLabels: function () {
        return cloneCustomLabelMap(customLabelMap);
      },
      hasDirty: function () {
        return Object.keys(dirty).length > 0;
      },
      hasBlockingErrors: function () {
        return !validateAll().ok;
      },
      validate: validateAll,
      captureEditorState: captureEditorState,
      setFromAttributes: function (attrs) {
        seedFrom(attrs);
        paint();
        // Server/hydrate fill — not a user edit (R02).
        notify({ source: 'server' });
      },
      applyServerSnapshot: applyServerSnapshot,
      getEditRevision: function () {
        return editRevision;
      },
      getParkedKeys: function () {
        return Object.keys(parkedBag);
      },
      setFieldError: setError,
      getDefs: function () {
        return defs.slice();
      },
      getSelectedSingle: function (fieldId) {
        var def = defs.find(function (d) {
          return d.id === fieldId;
        });
        if (!def) return null;
        var key = storageAttrKey(def);
        return currentValue(key);
      },
      getRadioGroupName: function (fieldId) {
        return 'mira-attr-' + mountId + '-' + fieldId;
      },
      repaint: paint,
    };
  }

  function applySingleSelect(current, next) {
    if (next === undefined) return current;
    return next;
  }

  function applyMultiSelect(current, toggleId, selected) {
    var arr = Array.isArray(current) ? current.slice() : [];
    var idx = arr.indexOf(toggleId);
    if (selected && idx < 0) arr.push(toggleId);
    if (!selected && idx >= 0) arr.splice(idx, 1);
    return arr;
  }

  /**
   * Writable elegance subcategories from taxonomy projection.
   * Only nodes with parentId and writeEnabled !== false (and not browseOnly).
   */
  function subcategoriesFromTaxonomy(taxonomyDoc, categoryId) {
    var nodes = (taxonomyDoc && (taxonomyDoc.nodes || taxonomyDoc.tree)) || [];
    if (!Array.isArray(nodes)) return [];
    return nodes
      .filter(function (n) {
        if (!n || !n.id || !n.parentId) return false;
        if (n.browseOnly) return false;
        if (n.writeEnabled === false) return false;
        if (categoryId && n.parentId !== categoryId) return false;
        return true;
      })
      .map(function (n) {
        return {
          value: n.id,
          label: n.labelAr || n.label || n.id,
          profileId: n.profileId || null,
          writeEnabled: n.writeEnabled !== false,
        };
      });
  }

  global.MiraRegistryAttributeFields = {
    E2_WRITE_FIELD_IDS: E2_WRITE_FIELD_IDS,
    E2_COMPONENT_CONTRACT_IDS: E2_COMPONENT_CONTRACT_IDS,
    FLAT_ATTR_FIELD_IDS: FLAT_ATTR_FIELD_IDS,
    CUSTOM_ATTR_LABELS_KEY: CUSTOM_ATTR_LABELS_KEY,
    MAX_CUSTOM_LABEL_LEN: MAX_CUSTOM_LABEL_LEN,
    attrFieldIdsFromRegistry: attrFieldIdsFromRegistry,
    attributeFieldDefsForProfile: attributeFieldDefsForProfile,
    classifyField: classifyField,
    storageAttrKey: storageAttrKey,
    labelFor: labelFor,
    extractAttributesFromValues: extractAttributesFromValues,
    validateNumberValue: validateNumberValue,
    validateDimensionAxisValue: validateDimensionAxisValue,
    coalesceDimensions: coalesceDimensions,
    supportsManualInput: supportsManualInput,
    customAttrId: customAttrId,
    isAllowedCustomAttrId: isAllowedCustomAttrId,
    allocateCustomAttrValue: allocateCustomAttrValue,
    displayLabelForCustomId: displayLabelForCustomId,
    projectStateOntoDefs: projectStateOntoDefs,
    subcategoriesFromTaxonomy: subcategoriesFromTaxonomy,
    mount: mount,
    applySingleSelect: applySingleSelect,
    applyMultiSelect: applyMultiSelect,
    profileById: profileById,
    fieldDef: fieldDef,
  };
})(typeof window !== 'undefined' ? window : globalThis);
