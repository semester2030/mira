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
  };

  var E2_COMPONENT_CONTRACT_IDS = {
    carryStyle: true,
  };

  /** Flat attribute field ids used when hydrating card/product values. */
  var FLAT_ATTR_FIELD_IDS = ['material', 'cut', 'occasion', 'lengthCm', 'carryStyle'];

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
   * Restore attributes from card/product values independently of material/cut.
   * Priority: attributes bag → attributesJson → flat field ids (hasOwnProperty).
   * Distinguishes missing key vs intentional null vs 0 vs present array/value.
   */
  function extractAttributesFromValues(vals, fieldIds) {
    var ids = fieldIds || FLAT_ATTR_FIELD_IDS;
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
      if (Object.prototype.hasOwnProperty.call(vals, fid)) {
        // Flat key wins when present (newer card form stores flat registry ids).
        out[fid] = vals[fid];
      }
    });

    return out;
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
   * Compatible keys keep values+clears; incompatible keys listed separately.
   */
  function projectStateOntoDefs(state, defs) {
    state = state || {};
    var values = isPlainObject(state.values) ? state.values : {};
    var cleared = state.cleared || {};
    var dirty = state.dirty || {};
    var allowed = Object.create(null);
    (defs || []).forEach(function (def) {
      var key = storageAttrKey(def);
      if (key) allowed[key] = def;
    });
    var nextValues = {};
    var nextCleared = Object.create(null);
    var nextDirty = Object.create(null);
    var incompatible = {};
    Object.keys(values).forEach(function (k) {
      if (allowed[k]) nextValues[k] = values[k];
      else incompatible[k] = values[k];
    });
    Object.keys(cleared).forEach(function (k) {
      if (allowed[k]) {
        nextCleared[k] = true;
        delete nextValues[k];
      } else if (!Object.prototype.hasOwnProperty.call(incompatible, k)) {
        incompatible[k] = null;
      }
    });
    Object.keys(dirty).forEach(function (k) {
      if (allowed[k]) nextDirty[k] = true;
    });
    return {
      values: nextValues,
      cleared: nextCleared,
      dirty: nextDirty,
      incompatible: incompatible,
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
    var incompatibleNotice = null;

    function seedFrom(attrs, opts) {
      opts = opts || {};
      values = {};
      cleared = Object.create(null);
      dirty = Object.create(null);
      fieldErrors = Object.create(null);
      invalidInputs = Object.create(null);
      if (!isPlainObject(attrs) && !(opts.cleared && Object.keys(opts.cleared).length)) return;
      if (isPlainObject(attrs)) {
        defs.forEach(function (def) {
          var key = storageAttrKey(def);
          if (!key) return;
          if (Object.prototype.hasOwnProperty.call(attrs, key)) {
            values[key] = attrs[key];
          }
        });
        Object.keys(attrs).forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(values, k)) {
            values[k] = attrs[k];
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
    }

    function applyInitial() {
      var projected = null;
      if (options.preserveState) {
        projected = projectStateOntoDefs(options.preserveState, defs);
        incompatibleNotice = projected.incompatible;
        seedFrom(projected.values, {
          cleared: projected.cleared,
          dirty: projected.dirty,
          invalidInputs: options.preserveState.invalidInputs,
        });
        // Also seed any compatible keys from server seed that weren't dirty
        var server = options.initialAttributes;
        if (isPlainObject(server)) {
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

    function notify() {
      if (typeof options.onChange === 'function') {
        options.onChange({
          values: Object.assign({}, values),
          dirty: Object.assign({}, dirty),
          cleared: Object.assign({}, cleared),
          attributesPatch: buildAttributesPatch(),
          blockingErrors: validateAll().errors,
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
      if (nextVal === null || nextVal === undefined) {
        cleared[key] = true;
        delete values[key];
      } else {
        delete cleared[key];
        values[key] = nextVal;
      }
      notify();
    }

    function buildAttributesPatch() {
      var patch = {};
      Object.keys(dirty).forEach(function (key) {
        if (cleared[key]) patch[key] = null;
        else if (Object.prototype.hasOwnProperty.call(values, key)) patch[key] = values[key];
      });
      return patch;
    }

    function buildFlatValues() {
      var flat = {};
      defs.forEach(function (def) {
        var key = storageAttrKey(def);
        if (!key) return;
        if (cleared[key]) {
          flat[def.id] = null;
          return;
        }
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          flat[def.id] = values[key];
        }
      });
      return flat;
    }

    function currentValue(key) {
      if (cleared[key]) return null;
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    }

    function validateAll() {
      var errors = [];
      Object.keys(invalidInputs).forEach(function (fieldId) {
        var def = defs.find(function (d) {
          return d.id === fieldId;
        });
        var raw = invalidInputs[fieldId];
        var v = validateNumberValue(def || { id: fieldId }, raw);
        if (!v.ok) {
          errors.push({ fieldId: fieldId, message: v.message });
          setError(fieldId, v.message);
        }
      });
      defs.forEach(function (def) {
        if (!(def.type === 'number' || def.widget === 'number')) return;
        if (invalidInputs[def.id]) return;
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
      return { ok: errors.length === 0, errors: errors };
    }

    function captureEditorState() {
      return {
        values: Object.assign({}, values),
        cleared: Object.assign({}, cleared),
        dirty: Object.assign({}, dirty),
        invalidInputs: Object.assign({}, invalidInputs),
        profileId: profileId,
      };
    }

    function paint() {
      host.innerHTML = '';
      host.classList.add('mira-attr-fields');
      host.setAttribute('dir', 'rtl');
      host.setAttribute('data-mount-id', mountId);

      if (incompatibleNotice && Object.keys(incompatibleNotice).length) {
        host.appendChild(
          el('p', {
            className: 'lead mira-attr-incompatible',
            'data-testid': 'attr-incompatible-notice',
            text:
              'بعض القيم غير متوافقة مع التصنيف الحالي وحُفظت مؤقتًا للرجوع: ' +
              Object.keys(incompatibleNotice).join('، '),
          }),
        );
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

      defs.forEach(function (def) {
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

        if (def.type === 'array' && (def.widget === 'chips' || !def.widget)) {
          var row = el('div', {
            className: 'choice-row mira-attr-chips',
            role: 'group',
            'aria-label': def.labelAr || def.id,
          });
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
        } else if (def.type === 'enum' || def.widget === 'select') {
          var groupName = 'mira-attr-' + mountId + '-' + def.id;
          var group = el('div', {
            className: 'choice-row mira-attr-single',
            role: 'radiogroup',
            'aria-label': def.labelAr || def.id,
            'data-radio-group': groupName,
          });
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
          if (invalidInputs[def.id] != null) num.value = String(invalidInputs[def.id]);
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
              setError(def.id, v.message);
              notify();
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
              setError(def.id, v.message);
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
        return Object.assign({}, values);
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
        notify();
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
    attributeFieldDefsForProfile: attributeFieldDefsForProfile,
    classifyField: classifyField,
    storageAttrKey: storageAttrKey,
    labelFor: labelFor,
    extractAttributesFromValues: extractAttributesFromValues,
    validateNumberValue: validateNumberValue,
    projectStateOntoDefs: projectStateOntoDefs,
    subcategoriesFromTaxonomy: subcategoriesFromTaxonomy,
    mount: mount,
    applySingleSelect: applySingleSelect,
    applyMultiSelect: applyMultiSelect,
    profileById: profileById,
    fieldDef: fieldDef,
  };
})(typeof window !== 'undefined' ? window : globalThis);
