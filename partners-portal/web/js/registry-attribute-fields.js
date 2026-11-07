/**
 * Shared registry-driven attribute fields for partners portal (E2).
 * Single + group editors mount the same widgets; each mount owns independent state.
 *
 * Support tiers (from registry field + storage):
 *  - write: storage attributes.* and editable → round-trip via API attributes bag
 *  - read: editable false but storage present
 *  - deferred: no attributes.* storage or marked FUTURE / not in E2 allowlist
 */
(function (global) {
  'use strict';

  /** Fields fully wired for E2 clothes write round-trip. */
  var E2_WRITE_FIELD_IDS = {
    material: true,
    cut: true,
    occasion: true,
    lengthCm: true,
  };

  /** Component-contract single-select (bags carryStyle) — UI proven in E2; category write = E4. */
  var E2_COMPONENT_CONTRACT_IDS = {
    carryStyle: true,
  };

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

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null) return;
        if (k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'disabled') node.disabled = !!v;
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
   * @param {{
   *   registry: object,
   *   profileId: string,
   *   initialAttributes?: object|null,
   *   includeComponentContract?: boolean,
   *   readOnly?: boolean,
   *   onChange?: function(state),
   * }} options
   */
  function mount(host, options) {
    if (!host) throw new Error('registry-attribute-fields: host required');
    options = options || {};
    var registry = options.registry;
    var profileId = options.profileId;
    var readOnly = !!options.readOnly;
    var defs = attributeFieldDefsForProfile(registry, profileId, {
      includeComponentContract: !!options.includeComponentContract,
    });

    /** @type {Record<string, unknown>} */
    var values = {};
    /** keys explicitly cleared (send null) */
    var cleared = Object.create(null);
    /** keys user touched this session */
    var dirty = Object.create(null);
    var fieldErrors = Object.create(null);

    function seedFrom(attrs) {
      values = {};
      cleared = Object.create(null);
      dirty = Object.create(null);
      fieldErrors = Object.create(null);
      if (!isPlainObject(attrs)) return;
      defs.forEach(function (def) {
        var key = storageAttrKey(def);
        if (!key) return;
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          values[key] = attrs[key];
        }
      });
      // Preserve unknown keys so reopen does not drop them from payload builders that merge.
      Object.keys(attrs).forEach(function (k) {
        if (!Object.prototype.hasOwnProperty.call(values, k)) {
          values[k] = attrs[k];
        }
      });
    }

    seedFrom(options.initialAttributes || null);

    function notify() {
      if (typeof options.onChange === 'function') {
        options.onChange({
          values: Object.assign({}, values),
          dirty: Object.assign({}, dirty),
          cleared: Object.assign({}, cleared),
          attributesPatch: buildAttributesPatch(),
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

    /** Full bag for draft materialize paths that map flat field ids. */
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

    function paint() {
      host.innerHTML = '';
      host.classList.add('mira-attr-fields');
      host.setAttribute('dir', 'rtl');
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
        var disabled = readOnly || tier === 'read' || (tier === 'component' && options.persistComponentContract !== true);

        if (def.type === 'array' && (def.widget === 'chips' || !def.widget)) {
          var row = el('div', { className: 'choice-row mira-attr-chips', role: 'group', 'aria-label': def.labelAr || def.id });
          var selected = Array.isArray(cur) ? cur.slice() : [];
          (def.values || []).forEach(function (vid) {
            var lab = el('label', { className: 'mira-attr-chip' + (selected.indexOf(vid) >= 0 ? ' is-selected' : '') });
            var cb = el('input', {
              type: 'checkbox',
              value: vid,
              disabled: disabled,
            });
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
          var group = el('div', { className: 'choice-row mira-attr-single', role: 'radiogroup', 'aria-label': def.labelAr || def.id });
          (def.values || []).forEach(function (vid) {
            var lab = el('label', {
              className: 'mira-attr-choice' + (cur === vid ? ' is-selected' : ''),
            });
            var radio = el('input', {
              type: 'radio',
              name: 'mira-attr-' + def.id + '-' + String(Math.random()).slice(2, 8),
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
              lab.classList.add('is-selected');
              setError(def.id, '');
              markDirty(key, vid);
            });
            lab.appendChild(radio);
            lab.appendChild(document.createTextNode(' ' + labelFor(def, vid)));
            group.appendChild(lab);
          });
          // Optional clear
          if (!disabled && def.nullMeaning) {
            var clearBtn = el('button', {
              type: 'button',
              className: 'btn btn-ghost mira-attr-clear',
              text: 'مسح',
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
          });
          if (def.min != null) num.min = String(def.min);
          if (def.max != null) num.max = String(def.max);
          if (def.unit) num.setAttribute('data-unit', def.unit);
          if (cur != null && cur !== '') num.value = String(cur);
          var unitHint = def.unit ? el('span', { className: 'mira-attr-unit', text: ' ' + def.unit }) : null;
          num.addEventListener('change', function () {
            var raw = String(num.value || '').trim();
            if (raw === '') {
              setError(def.id, '');
              markDirty(key, null);
              return;
            }
            var n = Number(raw);
            if (!Number.isFinite(n)) {
              setError(def.id, 'أدخلي رقمًا صالحًا أو اتركي الحقل فارغًا.');
              return;
            }
            if (def.min != null && n < def.min) {
              setError(def.id, 'الحد الأدنى ' + def.min + (def.unit ? ' ' + def.unit : ''));
              return;
            }
            if (def.max != null && n > def.max) {
              setError(def.id, 'الحد الأقصى ' + def.max + (def.unit ? ' ' + def.unit : ''));
              return;
            }
            setError(def.id, '');
            markDirty(key, n);
          });
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
      getAttributesPatch: buildAttributesPatch,
      getFlatValues: buildFlatValues,
      getValues: function () {
        return Object.assign({}, values);
      },
      hasDirty: function () {
        return Object.keys(dirty).length > 0;
      },
      setFromAttributes: function (attrs) {
        seedFrom(attrs);
        paint();
        notify();
      },
      setFieldError: setError,
      getDefs: function () {
        return defs.slice();
      },
      repaint: paint,
    };
  }

  /** Pure helpers for tests without DOM. */
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

  global.MiraRegistryAttributeFields = {
    E2_WRITE_FIELD_IDS: E2_WRITE_FIELD_IDS,
    E2_COMPONENT_CONTRACT_IDS: E2_COMPONENT_CONTRACT_IDS,
    attributeFieldDefsForProfile: attributeFieldDefsForProfile,
    classifyField: classifyField,
    storageAttrKey: storageAttrKey,
    labelFor: labelFor,
    mount: mount,
    applySingleSelect: applySingleSelect,
    applyMultiSelect: applyMultiSelect,
    profileById: profileById,
    fieldDef: fieldDef,
  };
})(typeof window !== 'undefined' ? window : globalThis);
