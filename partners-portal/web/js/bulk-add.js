/**
 * P6 — إضافة مجموعة
 * Every async op freezes {batchId, kind, profileId, ...} at click time.
 * Never retargets using the currently open `batch` after an await.
 */
(function () {
  const DEFAULT_LIMIT = 10;
  const BATCH_KEY = 'mira_bulk_pending_batch_id';
  const MEDIA_STORE_KEY = 'mira_bulk_media_jobs_v3';
  const HALALAS_PER_SAR = 100;
  const MAX_UPLOAD_INFLIGHT = 2;
  const VIDEO_MAX_SECONDS = 300;

  const mediaJobs = Object.create(null);
  const cardsByBatch = Object.create(null);
  let uploadInflight = 0;
  let uploadPumpRunning = false;
  /** batchId -> true while materialize/save-commit in flight (explicit or auto-before-upload) */
  const commitLocks = Object.create(null);
  /** batchId::cardId -> true while that card's auto-materialize is in flight */
  const cardMatLocks = Object.create(null);
  /** batchId::cardId -> Promise<ownerId> shared by concurrent uploads for the same card */
  const cardOwnerPromises = Object.create(null);
  /** batchId::cardId -> Promise for single-flight save before upload */
  const cardSavePromises = Object.create(null);
  const VARIANT_PAGE_SIZE = 50;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'className') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] === false || attrs[k] == null) {
          /* skip */
        } else if (attrs[k] === true) node.setAttribute(k, k);
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function newBatchId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function newClientMediaId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'm' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function sarToHalalas(sarStr) {
    const t = String(sarStr == null ? '' : sarStr).trim();
    if (!t) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(t)) throw new Error('السعر بالريال غير صالح');
    const [r, f] = t.split('.');
    const frac = (f || '').padEnd(2, '0').slice(0, 2);
    const h = Number(r) * HALALAS_PER_SAR + Number(frac || 0);
    if (!Number.isInteger(h) || h < 0) throw new Error('السعر بالريال غير صالح');
    return h;
  }

  function halalasToSar(h) {
    if (h == null || h === '') return '';
    const n = Number(h);
    if (!Number.isFinite(n)) return '';
    return (n / HALALAS_PER_SAR).toFixed(2).replace(/\.00$/, '');
  }

  function setBulkUrl(batchId) {
    const u = new URL(location.href);
    if (batchId) u.searchParams.set('bulk', batchId);
    else u.searchParams.delete('bulk');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  function profilesFromRegistry(registry, partner, kind) {
    const root = (registry && registry.registry) || registry || {};
    const profiles = root.profiles || [];
    const type = partner && partner.type;
    return profiles
      .filter((p) => p.kind === kind)
      .filter((p) => {
        if (p.enabledByDefault === false || p.phase === 'FUTURE_EXTENSION') return false;
        const allowed = p.partnerTypes || [];
        if (!allowed.length) return true;
        if (type === 'developer') return true;
        return allowed.indexOf(type) >= 0;
      })
      .map((p) => ({ id: p.id, label: p.labelAr || p.label || p.id, fields: p.fields || [] }));
  }

  /** Nested editors too heavy for bulk cards — handled by compact panels below instead. */
  const SKIP_BULK_FIELDS = {
    media: 1,
    coverMediaId: 1,
    optionsJson: 1,
    variantsJson: 1,
    serviceProfile: 1,
    resources: 1,
    weeklyHours: 1,
    dateExceptions: 1,
    coverageZones: 1,
    addons: 1,
    measurements: 1,
    itemDimensions: 1,
    /** Specialized length editor only — avoid duplicate generic number input. */
    lengthCm: 1,
  };

  const WEEK_DAYS = [
    { id: 'sun', label: 'أحد' },
    { id: 'mon', label: 'إثنين' },
    { id: 'tue', label: 'ثلاثاء' },
    { id: 'wed', label: 'أربعاء' },
    { id: 'thu', label: 'خميس' },
    { id: 'fri', label: 'جمعة' },
    { id: 'sat', label: 'سبت' },
  ];

  function variantSelectionKey(selections) {
    const s = selections || {};
    return Object.keys(s)
      .sort()
      .map((k) => k + '=' + String(s[k]))
      .join('|');
  }

  function findExistingVariant(existing, selections, stableId) {
    const list = Array.isArray(existing) ? existing : [];
    const key = variantSelectionKey(selections);
    let hit = list.find((v) => v && variantSelectionKey(v.selections) === key);
    if (hit) return hit;
    if (stableId) hit = list.find((v) => v && v.id === stableId);
    return hit || null;
  }

  /**
   * Generate variants from colors×sizes, preserving id/price/qty/availability/media
   * for combinations that already exist.
   */
  function buildVariantsFromColorsSizes(state) {
    const colors = Array.isArray(state.localValues.colors) ? state.localValues.colors : [];
    const sizes = Array.isArray(state.localValues.sizes) ? state.localValues.sizes : [];
    const basePrice =
      typeof state.localValues.priceHalalas === 'number' ? state.localValues.priceHalalas : null;
    const existing = Array.isArray(state.localValues.variantsJson) ? state.localValues.variantsJson : [];
    if (!colors.length && !sizes.length) {
      return { optionsJson: null, variantsJson: null, error: 'اختاري لونًا أو مقاسًا أولًا' };
    }
    const MO = window.MiraCatalogOptions;
    const selected = {};
    if (colors.length) selected.color = colors.map((c) => COLOR_LABELS_AR[c] || c);
    if (sizes.length) selected.size = sizes.slice();
    const presetGroups = [];
    if (colors.length) presetGroups.push({ id: 'color', label: 'اللون', kind: 'color', presets: colors });
    if (sizes.length) presetGroups.push({ id: 'size', label: 'المقاس', kind: 'size', presets: sizes });
    const optState = {
      selected: selected,
      customs: {},
      valueIds: {},
      variants: [],
      clearingOptions: false,
      clearingVariants: false,
    };
    if (MO && MO.buildOptionGroups) {
      optState._builtGroups = MO.buildOptionGroups(presetGroups, optState);
    } else {
      optState._builtGroups = presetGroups.map((g) => ({
        id: g.id,
        labelAr: g.label,
        kind: g.kind,
        values: (selected[g.id] || []).map((lab, i) => ({
          id: g.id === 'color' ? colors[i] || lab : sizes[i] || lab,
          labelAr: lab,
        })),
      }));
    }
    const groups = optState._builtGroups || [];
    const colorVals = (groups.find((g) => g.id === 'color') || { values: [] }).values;
    const sizeVals = (groups.find((g) => g.id === 'size') || { values: [] }).values;
    const variants = [];
    const cList = colorVals.length ? colorVals : [{ id: null, labelAr: null }];
    const sList = sizeVals.length ? sizeVals : [{ id: null, labelAr: null }];
    cList.forEach((c) => {
      sList.forEach((s) => {
        const selections = {};
        const labels = {};
        if (c.id) {
          selections.color = c.id;
          labels.color = c.labelAr;
        }
        if (s.id) {
          selections.size = s.id;
          labels.size = s.labelAr;
        }
        const idParts = [c.id, s.id].filter(Boolean);
        const stableId = idParts.join('-') || 'default';
        const prev = findExistingVariant(existing, selections, stableId);
        if (prev) {
          variants.push({
            id: prev.id || stableId,
            selections: selections,
            labels: labels,
            priceHalalas: Object.prototype.hasOwnProperty.call(prev, 'priceHalalas')
              ? prev.priceHalalas
              : basePrice,
            available: prev.available !== false,
            stockQty: Object.prototype.hasOwnProperty.call(prev, 'stockQty') ? prev.stockQty : null,
            mediaIds: Array.isArray(prev.mediaIds) ? prev.mediaIds.slice() : [],
            priceSarText: prev.priceSarText != null ? prev.priceSarText : undefined,
            priceError: prev.priceError || null,
            stockError: prev.stockError || null,
          });
        } else {
          variants.push({
            id: stableId,
            selections: selections,
            labels: labels,
            priceHalalas: basePrice,
            available: true,
            stockQty: null,
            mediaIds: [],
            priceError: null,
            stockError: null,
          });
        }
      });
    });
    return {
      optionsJson: groups,
      variantsJson: variants,
      error: null,
      preserved: variants.filter((v) => findExistingVariant(existing, v.selections, v.id)).length,
      created: variants.length - existing.filter((v) => findExistingVariant(variants, v.selections, v.id)).length,
    };
  }

  function cardHasValidationErrors(st) {
    if (!st) return true;
    if (st.priceError) return true;
    if (st.lengthCmError) return true;
    if (st.capacityError) return true;
    if (st.scheduleError) return true;
    const dayErrs = st.dayTimeErrors;
    if (dayErrs && typeof dayErrs === 'object' && Object.keys(dayErrs).some((k) => !!dayErrs[k])) return true;
    const vs = Array.isArray(st.localValues && st.localValues.variantsJson)
      ? st.localValues.variantsJson
      : [];
    return vs.some((v) => v && (v.priceError || v.stockError));
  }

  /** Always read the live card schedule — never a stale UI closure copy. */
  function readWeeklyHours(local) {
    return Array.isArray(local && local.weeklyHours)
      ? local.weeklyHours.filter(Boolean).map((h) => Object.assign({}, h))
      : [];
  }

  /**
   * Derive shared resource/capacity from weeklyHours for UI restore.
   * Mixed rows → defaults null (UI must not show a misleading single value).
   */
  function deriveScheduleDefaults(hours) {
    const rows = Array.isArray(hours) ? hours.filter(Boolean) : [];
    if (!rows.length) return { defaultResourceId: null, defaultCapacity: null, mixed: false };
    const rids = rows.map((h) => String(h.resourceId || '').trim()).filter(Boolean);
    const caps = rows
      .map((h) => h.capacity)
      .filter((c) => typeof c === 'number' && Number.isInteger(c) && c > 0);
    const ridUniform = rids.length === rows.length && rids.every((r) => r === rids[0]);
    const capUniform = caps.length === rows.length && caps.every((c) => c === caps[0]);
    return {
      defaultResourceId: ridUniform ? rids[0] : null,
      defaultCapacity: capUniform ? caps[0] : null,
      mixed: !ridUniform || !capUniform,
    };
  }

  /**
   * Apply general resource/capacity onto inheriting day rows only (resource ≠ branch).
   * Rows with resourceOverride/capacityOverride keep their explicit values.
   */
  function applyDefaultsOntoWeeklyHours(hours, resourceId, capacity) {
    const rid = String(resourceId || '').trim();
    const cap =
      typeof capacity === 'number' && Number.isInteger(capacity) && capacity > 0 ? capacity : null;
    return (Array.isArray(hours) ? hours : []).filter(Boolean).map((h) => {
      const next = Object.assign({}, h);
      if (!next.resourceOverride) {
        if (rid) next.resourceId = rid;
        else delete next.resourceId;
      }
      if (!next.capacityOverride) {
        if (cap != null) next.capacity = cap;
        else delete next.capacity;
      }
      return next;
    });
  }

  /** Upsert one day row while preserving other days' resource/capacity (live read). */
  function upsertWeeklyHourRow(local, dayId, patchOrNull) {
    const cur = readWeeklyHours(local);
    const next = cur.filter((h) => h.day !== dayId && h.weekday !== dayId);
    if (patchOrNull) next.push(patchOrNull);
    // Keep the key as [] when empty so save sends an explicit clear (≠ omit).
    local.weeklyHours = next;
    return next;
  }

  /** After server round-trip, restore UI defaults from persisted weeklyHours. */
  function hydrateScheduleUiFields(local) {
    if (!local || typeof local !== 'object') return local;
    const hours = Array.isArray(local.weeklyHours) ? local.weeklyHours : [];
    // Explicit empty [] means cleared — do not revive from leftover availabilityJson.
    if (
      Object.prototype.hasOwnProperty.call(local, 'weeklyHours') &&
      Array.isArray(local.weeklyHours) &&
      !local.weeklyHours.length
    ) {
      delete local.defaultResourceId;
      delete local.defaultCapacity;
      local._scheduleMixed = false;
      return local;
    }
    if (!hours.length && local.availabilityJson && Array.isArray(local.availabilityJson.windows)) {
      // Project windows → weeklyHours for editor restore (day ids).
      const WEEKDAY_TO_DAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      local.weeklyHours = local.availabilityJson.windows.map((w) => {
        const day = WEEKDAY_TO_DAY[w.weekday] || 'sun';
        const toT = (m) => {
          const hh = String(Math.floor(Number(m) / 60)).padStart(2, '0');
          const mm = String(Number(m) % 60).padStart(2, '0');
          return hh + ':' + mm;
        };
        return {
          day: day,
          open: toT(w.startMin),
          close: toT(w.endMin),
          resourceId: w.resourceId || undefined,
          capacity: typeof w.capacity === 'number' ? w.capacity : undefined,
        };
      });
    }
    const hoursNow = Array.isArray(local.weeklyHours) ? local.weeklyHours.filter(Boolean) : [];
    const d = deriveScheduleDefaults(hoursNow);
    if (d.defaultResourceId) local.defaultResourceId = d.defaultResourceId;
    else delete local.defaultResourceId;
    if (d.defaultCapacity != null) local.defaultCapacity = d.defaultCapacity;
    else delete local.defaultCapacity;
    local._scheduleMixed = d.mixed;
    // Mixed schedules are explicit per-day exceptions — do not unify on default edits.
    if (d.mixed && hoursNow.length) {
      local.weeklyHours = hoursNow.map((h) =>
        Object.assign({}, h, { resourceOverride: true, capacityOverride: true }),
      );
    }
    return local;
  }

  function deepCloneJson(v) {
    return JSON.parse(JSON.stringify(v == null ? null : v));
  }

  const COLOR_LABELS_AR = {
    black: 'أسود',
    ivory: 'سكري',
    brown: 'بني',
    pink: 'وردي',
    blue: 'أزرق',
    green: 'أخضر',
    multi: 'متعدد',
  };

  function fieldDefsForProfile(registry, profileId) {
    const root = (registry && registry.registry) || registry || {};
    const profile = (root.profiles || []).find((p) => p.id === profileId);
    const fieldsMap = root.fields || {};
    if (!profile) return [];
    return (profile.fields || [])
      .filter((id) => !SKIP_BULK_FIELDS[id])
      .map((id) => {
        const f = fieldsMap[id] || { id: id, type: 'string', labelAr: id };
        return Object.assign({ id: id }, f, {
          options: f.values || f.options || [],
          widget: f.widget || null,
        });
      })
      .filter((f) => {
        const t = f.type || 'string';
        return (
          t === 'string' ||
          t === 'text' ||
          t === 'int' ||
          t === 'integer' ||
          t === 'number' ||
          t === 'enum' ||
          t === 'boolean' ||
          t === 'money' ||
          t === 'halalas' ||
          t === 'array'
        );
      });
  }

  function persistMediaMeta() {
    try {
      const out = {};
      Object.keys(mediaJobs).forEach((id) => {
        const j = mediaJobs[id];
        out[id] = {
          clientMediaId: id,
          batchId: j.batchId,
          cardId: j.cardId,
          fileName: j.fileName,
          mimeType: j.mimeType,
          size: j.size,
          sessionId: j.sessionId || null,
          mediaId: j.mediaId || null,
          status: j.status,
          ownerId: j.ownerId || null,
          ownerKindPath: j.ownerKindPath || null,
          checksum: j.checksum || null,
          error: j.error || null,
          needsLocalFile: !j.file && j.status !== 'ready' && !!j.sessionId,
        };
      });
      sessionStorage.setItem(MEDIA_STORE_KEY, JSON.stringify(out));
    } catch (_) {}
  }

  function restoreMediaMeta() {
    try {
      const raw = sessionStorage.getItem(MEDIA_STORE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      Object.keys(parsed || {}).forEach((id) => {
        if (mediaJobs[id]) return;
        const j = parsed[id];
        // uploading in a dead tab is not a live upload — mark for reconcile
        let status = j.status;
        if (status === 'uploading') status = 'needs_reconcile';
        mediaJobs[id] = Object.assign({}, j, {
          file: null,
          clientMediaId: id,
          status: status,
          needsLocalFile: status !== 'ready' && !j.file,
        });
      });
    } catch (_) {}
  }

  function ensureBatchCards(batchId) {
    if (!cardsByBatch[batchId]) cardsByBatch[batchId] = Object.create(null);
    return cardsByBatch[batchId];
  }

  function cardKey(batchId, cardId) {
    return String(batchId) + '::' + String(cardId);
  }

  function jobsForCard(batchId, cardId) {
    return Object.keys(mediaJobs)
      .map((id) => mediaJobs[id])
      .filter((j) => j && j.batchId === batchId && j.cardId === cardId);
  }

  function jobsForBatch(batchId) {
    return Object.keys(mediaJobs)
      .map((id) => mediaJobs[id])
      .filter((j) => j && j.batchId === batchId);
  }

  function freezeCtx(batch) {
    return {
      batchId: batch.batchId,
      kind: batch.kind,
      profileId: batch.profileId,
      ownerKindPath: batch.kind === 'product' ? 'products' : 'services',
    };
  }

  const DAY_TO_WEEKDAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

  function timeToMin(t) {
    const s = String(t == null ? '' : t).trim();
    if (!/^\d{1,2}:\d{2}$/.test(s)) return null;
    const parts = s.split(':').map((x) => Number(x));
    if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  }

  /** Build canonical availabilityJson from bulk schedule fields (same contract as booking). */
  function buildAvailabilityJsonFromLocal(local) {
    const lv = local || {};
    const hoursExplicit = Object.prototype.hasOwnProperty.call(lv, 'weeklyHours');
    const hours = Array.isArray(lv.weeklyHours) ? lv.weeklyHours : [];
    // Explicit empty weeklyHours ([] or cleared) must NOT revive stale availabilityJson.
    if (hoursExplicit && !hours.length && !(Array.isArray(lv.dateExceptions) && lv.dateExceptions.length)) {
      return null;
    }
    // Fall back to existing availabilityJson only when schedule fields were never set.
    if (!hoursExplicit && !hours.length && !(Array.isArray(lv.dateExceptions) && lv.dateExceptions.length)) {
      if (lv.availabilityJson && typeof lv.availabilityJson === 'object' && Array.isArray(lv.availabilityJson.windows)) {
        return deepCloneJson(lv.availabilityJson);
      }
    }
    const resourceId = String(lv.defaultResourceId || 'resource-1').trim() || 'resource-1';
    const capacity =
      typeof lv.defaultCapacity === 'number' && Number.isInteger(lv.defaultCapacity) && lv.defaultCapacity > 0
        ? lv.defaultCapacity
        : 1;
    const windows = [];
    hours.forEach((h) => {
      if (!h) return;
      const weekday =
        typeof h.weekday === 'number'
          ? h.weekday
          : DAY_TO_WEEKDAY[h.day] != null
            ? DAY_TO_WEEKDAY[h.day]
            : null;
      const startMin = typeof h.startMin === 'number' ? h.startMin : timeToMin(h.open || h.start);
      const endMin = typeof h.endMin === 'number' ? h.endMin : timeToMin(h.close || h.end);
      if (weekday == null || startMin == null || endMin == null || endMin <= startMin) return;
      windows.push({
        weekday: weekday,
        startMin: startMin,
        endMin: endMin,
        capacity: typeof h.capacity === 'number' ? h.capacity : capacity,
        resourceId: h.resourceId || resourceId,
      });
    });
    const closedDates = (Array.isArray(lv.dateExceptions) ? lv.dateExceptions : [])
      .map((x) => (typeof x === 'string' ? x : x && x.date))
      .filter(Boolean);
    if (!windows.length && !closedDates.length) return null;
    return {
      v: 2,
      timezone: 'Asia/Riyadh',
      windows: windows,
      exceptions: [],
      closedDates: closedDates,
    };
  }

  function syncAvailabilityOntoLocal(st) {
    if (!st || !st.localValues) return;
    const doc = buildAvailabilityJsonFromLocal(st.localValues);
    if (!doc) {
      delete st.localValues.availabilityJson;
      return;
    }
    st.localValues.availabilityJson = doc;
    if (st.localValues.bookingEnabled == null) st.localValues.bookingEnabled = true;
  }

  function sanitizeValuesForSave(values) {
    const out = deepCloneJson(values || {});
    if (Array.isArray(out.variantsJson)) {
      out.variantsJson = out.variantsJson.map((v) => {
        if (!v || typeof v !== 'object') return v;
        const clean = {
          id: v.id,
          selections: v.selections || {},
          labels: v.labels || {},
          priceHalalas: v.priceHalalas,
          available: v.available !== false,
          stockQty: v.stockQty == null ? null : v.stockQty,
          mediaIds: Array.isArray(v.mediaIds) ? v.mediaIds : [],
        };
        return clean;
      });
    }
    // Map UI dimensions helper → registry lengthCm (clothes). Do not send unknown itemDimensions.
    if (out.itemDimensions && typeof out.itemDimensions === 'object') {
      const len = out.itemDimensions.lengthCm;
      if (typeof len === 'number' && Number.isFinite(len) && out.lengthCm == null) out.lengthCm = len;
      delete out.itemDimensions;
    }
    // Server derives availabilityJson from weeklyHours/dateExceptions on materialize.
    // Those helper keys are not registry fields — strip before PUT.
    delete out.availabilityJson;
    delete out.bookingEnabled;
    delete out.defaultResourceId;
    delete out.defaultCapacity;
    delete out._scheduleMixed;
    if (Array.isArray(out.weeklyHours)) {
      out.weeklyHours = out.weeklyHours.filter(Boolean).map((h) => {
        if (!h || typeof h !== 'object') return h;
        const clean = Object.assign({}, h);
        delete clean.resourceOverride;
        delete clean.capacityOverride;
        return clean;
      });
    }
    if (out.serviceProfile && typeof out.serviceProfile === 'object') {
      /* keep as-is for server normalizeServiceProfile */
    }
    return out;
  }

  function buildSavePayload(st) {
    const clearFields = [];
    const values = {};
    const keys = new Set([...Object.keys(st.localValues || {}), ...Object.keys(st.savedValues || {})]);
    keys.forEach((k) => {
      if (k.startsWith('_')) return;
      if (!(k in st.localValues) && k in st.savedValues) clearFields.push(k);
      else if (k in st.localValues) values[k] = st.localValues[k];
    });
    return {
      values: sanitizeValuesForSave(values),
      clearFields: clearFields,
      expectedRevision: st.revision,
      editGen: st.editGen,
    };
  }

  async function openBulkUi(root, partner) {
    root.innerHTML = '';
    restoreMediaMeta();

    let registry = null;
    let registryError = null;
    try {
      registry = await PartnersApi.registry();
    } catch (e) {
      registry = null;
      registryError = (e && (e.messageAr || e.message)) || String(e);
    }

    const pType = (partner && partner.type) || '';
    const isDeveloper = pType === 'developer';
    const status = el('p', { className: 'lead', id: 'bulkStatus', role: 'status' }, [
      isDeveloper
        ? 'حساب المطوّر: التقديم ينشر مباشرة بعد اكتمال الوسائط — بلا موافقة إدارية. تتبّعي نسبة الرفع أدناه.'
        : 'كل عملية تُثبّت هوية الدفعة عند البدء. التحويل ≠ نشر (يحتاج موافقة محتوى).',
    ]);
    const mediaProgressHost = el('div', {
      id: 'bulkMediaProgress',
      className: 'bulk-media-progress',
      style:
        'margin:8px 0;padding:10px 12px;border:1px solid #c9c2b8;background:#f7f4ef;font-size:13px;line-height:1.5',
      role: 'status',
      'aria-live': 'polite',
    });
    const mediaProgressBar = el('div', {
      style: 'height:10px;background:#e5e0d8;border-radius:4px;overflow:hidden;margin-top:6px',
    });
    const mediaProgressFill = el('div', {
      style: 'height:100%;width:0%;background:#2f6f4e;transition:width 0.2s ease',
    });
    mediaProgressBar.appendChild(mediaProgressFill);
    const mediaProgressText = el('div', { text: 'لا وسائط معيّنة بعد لهذه الدفعة.' });
    mediaProgressHost.appendChild(mediaProgressText);
    mediaProgressHost.appendChild(mediaProgressBar);
    const listHost = el('div', { id: 'bulkMyList' });
    const cardsHost = el('div', { id: 'bulkCards' });

    const canProduct = isDeveloper || pType === 'brand';
    const canService = isDeveloper || pType === 'salon' || pType === 'clinic';
    const kindOpts = [];
    if (canProduct) kindOpts.push(el('option', { value: 'product', text: 'منتجات' }));
    if (canService) kindOpts.push(el('option', { value: 'service', text: 'خدمات' }));
    if (!kindOpts.length) kindOpts.push(el('option', { value: '', text: 'لا صلاحية إضافة' }));
    const kindSelect = el('select', { id: 'bulkKind' }, kindOpts);
    const profileSelect = el('select', { id: 'bulkProfile' });
    const countInput = el('input', {
      id: 'bulkCount',
      type: 'number',
      min: '1',
      max: '50',
      step: '1',
      value: String(DEFAULT_LIMIT),
    });

    const refillProfiles = () => {
      profileSelect.innerHTML = '';
      if (!registry) {
        profileSelect.appendChild(el('option', { value: '', text: 'تعذر جلب القوالب' }));
        profileSelect.disabled = true;
        return;
      }
      profileSelect.disabled = false;
      const opts = profilesFromRegistry(registry, partner, kindSelect.value);
      if (!opts.length) {
        profileSelect.appendChild(el('option', { value: '', text: 'لا قوالب مسموحة' }));
        return;
      }
      opts.forEach((p) => profileSelect.appendChild(el('option', { value: p.id, text: p.label })));
    };
    refillProfiles();
    kindSelect.addEventListener('change', refillProfiles);

    /** Currently open batch view (display only — never the sole destination after await). */
    let openBatch = null;

    function isOpen(batchId) {
      return !!(openBatch && openBatch.batchId === batchId);
    }

    function setStatusFor(batchId, msg) {
      if (isOpen(batchId)) status.textContent = msg;
    }

    /** Batch media progress proof: total / ready / remaining / % (bytes when available). */
    function summarizeBatchMedia(batchId) {
      const jobs = jobsForBatch(batchId);
      const total = jobs.length;
      const ready = jobs.filter((j) => j.status === 'ready').length;
      const failed = jobs.filter((j) => j.status === 'failed' || j.status === 'failed_retryable').length;
      const uploading = jobs.filter((j) => j.status === 'uploading').length;
      const verifying = jobs.filter((j) => j.status === 'verifying').length;
      const needsFile = jobs.filter((j) => j.needsLocalFile || j.status === 'needs_file').length;
      const remaining = Math.max(0, total - ready - failed);
      let weighted = 0;
      let weightSum = 0;
      jobs.forEach((j) => {
        const w = typeof j.size === 'number' && j.size > 0 ? j.size : 1;
        weightSum += w;
        if (j.status === 'ready') weighted += w;
        else if (j.status === 'verifying') weighted += w * 0.95;
        else if (j.status === 'uploading' && typeof j.uploadPercent === 'number') {
          weighted += w * Math.max(0, Math.min(1, j.uploadPercent));
        }
      });
      const percent = total === 0 ? 0 : Math.round((weightSum ? weighted / weightSum : ready / total) * 100);
      return { total, ready, failed, uploading, verifying, needsFile, remaining, percent };
    }

    function refreshMediaProgress(batchId) {
      if (!isOpen(batchId)) return;
      const s = summarizeBatchMedia(batchId);
      if (!s.total) {
        mediaProgressText.textContent = 'لا وسائط معيّنة بعد لهذه الدفعة.';
        mediaProgressFill.style.width = '0%';
        return;
      }
      mediaProgressText.textContent =
        'تقدم الرفع: ' +
        s.percent +
        '% · مكتمل ' +
        s.ready +
        ' من ' +
        s.total +
        ' · متبقّي ' +
        s.remaining +
        (s.uploading ? ' · يُرفع الآن ' + s.uploading : '') +
        (s.verifying ? ' · تحقق ' + s.verifying : '') +
        (s.failed ? ' · فشل ' + s.failed : '') +
        (s.needsFile ? ' · يلزم ملف ' + s.needsFile : '');
      mediaProgressFill.style.width = s.percent + '%';
      mediaProgressFill.style.background = s.failed && !s.remaining ? '#b00020' : s.percent >= 100 ? '#2f6f4e' : '#3d6ea5';
    }

    function syncStateFromBatch(b, opts) {
      const map = ensureBatchCards(b.batchId);
      (b.cards || []).forEach((c) => {
        const prev = map[c.cardId];
        const saved = Object.assign({}, c.values || {});
        if (prev && prev.dirty && !(opts && opts.forceClean)) {
          map[c.cardId] = Object.assign({}, prev, {
            revision: c.revision,
            status: c.status,
            targetOwnerId: c.targetOwnerId,
            savedValues: saved,
            contentStatus: c.contentStatus,
            submitReviewStatus: c.submitReviewStatus,
            openUrl: c.openUrl,
            commitLocked: commitLocks[b.batchId] === true,
          });
        } else {
          map[c.cardId] = {
            localValues: Object.assign({}, saved),
            savedValues: saved,
            dirtyFields: Object.create(null),
            priceSarText: saved.priceHalalas != null ? halalasToSar(saved.priceHalalas) : '',
            priceError: null,
            revision: c.revision,
            status: c.status,
            targetOwnerId: c.targetOwnerId,
            contentStatus: c.contentStatus,
            submitReviewStatus: c.submitReviewStatus,
            dirty: false,
            editGen: (prev && prev.editGen) || 0,
            saveGen: (prev && prev.saveGen) || 0,
            error: null,
            openUrl: c.openUrl,
            commitLocked: commitLocks[b.batchId] === true,
          };
        }
      });
      if (!(opts && opts.keepOpenUntouched)) {
        openBatch = b;
      } else if (isOpen(b.batchId)) {
        openBatch = b;
      }
    }

    function openBatchView(b) {
      syncStateFromBatch(b);
      setBulkUrl(b.batchId);
      renderCards();
      refreshMediaProgress(b.batchId);
    }

    function bumpEdit(batchId, cardId, fieldId) {
      const st = ensureBatchCards(batchId)[cardId];
      if (!st || st.status === 'materialized' || st.commitLocked) return;
      st.editGen = (st.editGen || 0) + 1;
      st.dirty = true;
      if (fieldId) st.dirtyFields[fieldId] = true;
      st.error = null;
    }

    /**
     * Save one card for a frozen ctx. Never uses openBatch for API destination.
     * snapshot optional: { values, clearFields, expectedRevision, editGen }
     */
    async function saveCard(ctx, cardId, opts) {
      const st = ensureBatchCards(ctx.batchId)[cardId];
      if (!st) throw new Error('بطاقة غير موجودة في الدفعة ' + ctx.batchId);
      if (st.status === 'materialized') {
        const err = 'البطاقة محوّلة — استخدمي رابط فتح العنصر. لم يُرسل حفظ.';
        st.error = err;
        throw Object.assign(new Error(err), { code: 'BULK_CARD_MATERIALIZED_UI' });
      }
      if (st.priceError) {
        throw Object.assign(new Error(st.priceError), { code: 'BULK_PRICE_INVALID' });
      }
      if (cardHasValidationErrors(st)) {
        throw Object.assign(new Error('توجد قيم رقمية غير صالحة في البطاقة أو تركيباتها'), {
          code: 'BULK_FIELD_INVALID',
        });
      }
      const snap = (opts && opts.snapshot) || buildSavePayload(st);
      const sentGen = snap.editGen;
      st.saveGen = sentGen;
      const put = await PartnersApi.putBulkCard(ctx.batchId, cardId, {
        expectedRevision: snap.expectedRevision,
        values: snap.values,
        clearFields: snap.clearFields,
        overwriteWritten: true,
      });
      // Apply against the same batch card map — not whatever is open now.
      const live = ensureBatchCards(ctx.batchId)[cardId];
      if (!live) return put;
      if (live.editGen === sentGen) {
        live.revision = put.revision;
        live.savedValues = Object.assign({}, put.values || {});
        live.localValues = hydrateScheduleUiFields(Object.assign({}, put.values || {}));
        live.dirtyFields = Object.create(null);
        live.lengthCmError = null;
        live.lengthCmText = undefined;
        live.scheduleError = null;
        if (put.values && Object.prototype.hasOwnProperty.call(put.values, 'priceHalalas')) {
          live.priceSarText = put.values.priceHalalas != null ? halalasToSar(put.values.priceHalalas) : '';
          live.priceError = null;
        }
        live.dirty = false;
        live.error = null;
        if (!(opts && opts.silent)) {
          setStatusFor(ctx.batchId, 'حُفظت ' + cardId + ' · rev ' + put.revision);
        }
      } else {
        live.revision = put.revision;
        live.savedValues = Object.assign({}, put.values || {});
        live.dirty = true;
        if (!(opts && opts.silent)) {
          setStatusFor(ctx.batchId, 'حُفظت نسخة أقدم من ' + cardId + '؛ بقي تعديل أحدث — احفظي مجددًا.');
        }
      }
      if (isOpen(ctx.batchId) && !(opts && opts.skipRender)) renderCards();
      return put;
    }

    async function saveDirtyCards(ctx, opts) {
      const map = ensureBatchCards(ctx.batchId);
      const failed = [];
      const snapshots = (opts && opts.snapshots) || null;
      for (const cardId of Object.keys(map)) {
        const st = map[cardId];
        if (st.status === 'materialized') continue;
        const snap = snapshots ? snapshots[cardId] : null;
        if (!snap && !st.dirty) continue;
        try {
          await saveCard(ctx, cardId, {
            silent: true,
            skipRender: true,
            snapshot: snap || buildSavePayload(st),
          });
        } catch (e) {
          failed.push({ cardId: cardId, error: (e && e.message) || String(e) });
        }
      }
      return { ok: failed.length === 0, failed: failed };
    }

    function confirmLeaveIfNeeded() {
      if (!openBatch) return true;
      if (commitLocks[openBatch.batchId]) {
        window.alert('عملية حفظ/تحويل جارية على هذه الدفعة. انتظري اكتمالها قبل الانتقال.');
        return false;
      }
      const map = ensureBatchCards(openBatch.batchId);
      const dirty = Object.keys(map).some((id) => map[id].dirty);
      const uploading = jobsForBatch(openBatch.batchId).some(
        (j) => j.status === 'uploading' || j.status === 'verifying',
      );
      if (!dirty && !uploading) return true;
      return window.confirm(
        'تعديلات غير محفوظة أو رفع جارٍ. الانتقال لا يغيّر وجهة العمليات التي بدأت، لكن التعديلات غير المحفوظة تبقى في دفعتها. متابَعة؟',
      );
    }

    function renderCards() {
      cardsHost.innerHTML = '';
      if (!openBatch) return;
      const batch = openBatch;
      const map = ensureBatchCards(batch.batchId);
      const lockedCommit = commitLocks[batch.batchId] === true;
      if (batch.ready === false) {
        cardsHost.appendChild(el('p', { className: 'lead', text: 'الدفعة قيد الاستكمال…' }));
        return;
      }
      let fieldDefs = fieldDefsForProfile(registry, batch.profileId);
      const ensure = ['nameAr', 'priceHalalas', 'descriptionAr'];
      if (batch.kind === 'service') ensure.push('durationMin');
      if (batch.kind === 'product') ensure.push('purchaseMode', 'externalUrl');
      ensure.forEach((id) => {
        if (!fieldDefs.some((f) => f.id === id)) {
          fieldDefs = fieldDefs.concat([{ id: id, type: id === 'priceHalalas' ? 'halalas' : 'string', labelAr: id }]);
        }
      });

      (batch.cards || []).forEach((card) => {
        const state = map[card.cardId];
        if (!state) return;
        const locked = state.status === 'materialized' || lockedCommit;
        const ck = el('input', { type: 'checkbox', className: 'bulk-card-ck', 'data-card': card.cardId });
        ck.checked = true;
        const dirtyBadge = el('span', {
          className: 'lead',
          text: state.status === 'materialized' ? 'محوّلة' : state.dirty ? 'غير محفوظ' : 'محفوظ',
        });
        const err = el('p', {
          className: 'lead',
          text: state.error || state.priceError || '',
          style: state.error || state.priceError ? 'color:#b00020' : '',
        });
        const fieldsHost = el('div', { className: 'bulk-card-fields' });
        const batchIdFrozen = batch.batchId;

        fieldDefs.forEach((def) => {
          const id = def.id;
          if (id === 'durationMin' && batch.kind !== 'service') return;
          if (id === 'priceHalalas' || def.type === 'halalas' || def.type === 'money') {
            const isMainPrice = id === 'priceHalalas';
            const moneySar = isMainPrice
              ? state.priceSarText != null
                ? state.priceSarText
                : ''
              : state.localValues[id] != null
                ? halalasToSar(state.localValues[id])
                : '';
            const priceSar = el('input', {
              type: 'text',
              inputmode: 'decimal',
              placeholder: 'ريال',
              value: moneySar,
              disabled: locked,
            });
            priceSar.addEventListener('input', () => {
              if (locked) return;
              const t = priceSar.value;
              if (isMainPrice) state.priceSarText = t;
              const trimmed = t.trim();
              if (!trimmed) {
                if (isMainPrice) state.priceError = null;
                delete state.localValues[id];
                bumpEdit(batchIdFrozen, card.cardId, id);
              } else {
                try {
                  const h = sarToHalalas(trimmed);
                  if (isMainPrice) state.priceError = null;
                  state.localValues[id] = h;
                  bumpEdit(batchIdFrozen, card.cardId, id);
                } catch (e) {
                  if (isMainPrice) state.priceError = e.message || 'السعر غير صالح';
                  bumpEdit(batchIdFrozen, card.cardId, id);
                }
              }
              dirtyBadge.textContent = state.dirty ? 'غير محفوظ' : 'محفوظ';
              err.textContent = state.priceError || state.error || '';
            });
            fieldsHost.appendChild(el('label', null, [(def.labelAr || id) + ' (ريال) ', priceSar]));
            return;
          }
          if (def.type === 'boolean') {
            const input = el('input', {
              type: 'checkbox',
              checked: !!state.localValues[id],
              disabled: locked,
            });
            input.addEventListener('change', () => {
              if (locked) return;
              state.localValues[id] = !!input.checked;
              bumpEdit(batchIdFrozen, card.cardId, id);
              dirtyBadge.textContent = 'غير محفوظ';
            });
            fieldsHost.appendChild(el('label', null, [input, ' ' + (def.labelAr || id)]));
            return;
          }
          if (def.type === 'array' && Array.isArray(def.options) && def.options.length) {
            const selected = Array.isArray(state.localValues[id]) ? state.localValues[id].slice() : [];
            const row = el('div', { className: 'bulk-array-field', 'data-field': id });
            row.appendChild(el('span', { text: (def.labelAr || id) + ' ' }));
            def.options.forEach((opt) => {
              const v = typeof opt === 'string' ? opt : opt.value || opt.id;
              const lab =
                id === 'colors'
                  ? COLOR_LABELS_AR[v] || (typeof opt === 'string' ? opt : opt.labelAr || opt.label || v)
                  : typeof opt === 'string'
                    ? opt
                    : opt.labelAr || opt.label || v;
              const on = selected.indexOf(v) >= 0;
              if (id === 'colors' && window.MiraCatalogOptions && MiraCatalogOptions.colorSwatchStyle) {
                const style = MiraCatalogOptions.colorSwatchStyle(v);
                const sw = el('button', {
                  type: 'button',
                  className: 'bulk-color-swatch' + (on ? ' is-on' : ''),
                  title: lab,
                  text: lab,
                  disabled: locked,
                  style:
                    'display:inline-flex;align-items:center;gap:6px;margin:2px;border-radius:999px;padding:4px 10px;border:2px solid ' +
                    (style.borderColor || '#999') +
                    ';background:#fff',
                });
                const dot = el('span', {
                  style:
                    'width:14px;height:14px;border-radius:50%;display:inline-block;border:1px solid #ccc;background:' +
                    (style.background || '#ccc'),
                });
                sw.insertBefore(dot, sw.firstChild);
                sw.addEventListener('click', () => {
                  if (locked) return;
                  const cur = Array.isArray(state.localValues[id]) ? state.localValues[id].slice() : [];
                  const ix = cur.indexOf(v);
                  if (ix >= 0) cur.splice(ix, 1);
                  else cur.push(v);
                  if (!cur.length) delete state.localValues[id];
                  else state.localValues[id] = cur;
                  bumpEdit(batchIdFrozen, card.cardId, id);
                  dirtyBadge.textContent = 'غير محفوظ';
                  // Toggle in place — full re-render mid-multi-select drops later clicks.
                  if (cur.indexOf(v) >= 0) sw.classList.add('is-on');
                  else sw.classList.remove('is-on');
                });
                row.appendChild(sw);
              } else {
                const chip = el('label', {
                  style: 'display:inline-flex;gap:4px;margin:2px;align-items:center',
                }, [
                  el('input', {
                    type: 'checkbox',
                    checked: on,
                    disabled: locked,
                    onChange: () => {
                      if (locked) return;
                      const cur = Array.isArray(state.localValues[id]) ? state.localValues[id].slice() : [];
                      const ix = cur.indexOf(v);
                      if (ix >= 0) cur.splice(ix, 1);
                      else cur.push(v);
                      if (!cur.length) delete state.localValues[id];
                      else state.localValues[id] = cur;
                      bumpEdit(batchIdFrozen, card.cardId, id);
                      dirtyBadge.textContent = 'غير محفوظ';
                    },
                  }),
                  lab,
                ]);
                row.appendChild(chip);
              }
            });
            fieldsHost.appendChild(row);
            return;
          }
          if (def.type === 'enum' && Array.isArray(def.options) && def.options.length) {
            const sel = el('select', { disabled: locked });
            sel.appendChild(el('option', { value: '', text: '—' }));
            def.options.forEach((opt) => {
              const v = typeof opt === 'string' ? opt : opt.value || opt.id;
              const lab = typeof opt === 'string' ? opt : opt.labelAr || opt.label || v;
              const o = el('option', { value: v, text: lab });
              if (String(state.localValues[id] || '') === String(v)) o.selected = true;
              sel.appendChild(o);
            });
            sel.addEventListener('change', () => {
              if (locked) return;
              if (!sel.value) delete state.localValues[id];
              else state.localValues[id] = sel.value;
              bumpEdit(batchIdFrozen, card.cardId, id);
              dirtyBadge.textContent = 'غير محفوظ';
            });
            fieldsHost.appendChild(el('label', null, [(def.labelAr || id) + ' ', sel]));
            return;
          }
          const isNum = def.type === 'int' || def.type === 'integer' || def.type === 'number';
          const isDate =
            id === 'offerStart' || id === 'offerEnd' || (def.widget === 'date' && def.type === 'string');
          const input = el('input', {
            type: isDate ? 'date' : isNum ? 'number' : 'text',
            value: state.localValues[id] != null ? String(state.localValues[id]) : '',
            disabled: locked,
            min: def.min != null ? String(def.min) : undefined,
            max: def.max != null ? String(def.max) : undefined,
            step: def.type === 'number' ? 'any' : isNum ? '1' : undefined,
          });
          input.addEventListener('input', () => {
            if (locked) return;
            const v = input.value;
            if (v === '') delete state.localValues[id];
            else if (isNum) state.localValues[id] = Number(v);
            else state.localValues[id] = v;
            bumpEdit(batchIdFrozen, card.cardId, id);
            dirtyBadge.textContent = 'غير محفوظ';
          });
          fieldsHost.appendChild(el('label', null, [(def.labelAr || id) + ' ', input]));
        });

        // Product: generate options/variants from selected colors×sizes (reuse MiraCatalogOptions)
        if (batch.kind === 'product' && !locked) {
          const commerceHost = el('div', { className: 'bulk-commerce', 'data-card': card.cardId });
          const vCount = Array.isArray(state.localValues.variantsJson)
            ? state.localValues.variantsJson.length
            : 0;
          commerceHost.appendChild(
            el('p', {
              className: 'lead',
              text:
                'تركيبات محفوظة محليًا: ' +
                vCount +
                (vCount ? ' — ستُرسل مع الحفظ' : ' — ولّدي من الألوان/المقاسات'),
            }),
          );
          commerceHost.appendChild(
            el('button', {
              type: 'button',
              className: 'btn btn-ghost',
              text: 'توليد التركيبات من الألوان×المقاسات',
              onClick: () => {
                const built = buildVariantsFromColorsSizes(state);
                if (built.error) {
                  err.textContent = built.error;
                  return;
                }
                state.localValues.optionsJson = built.optionsJson;
                state.localValues.variantsJson = built.variantsJson;
                bumpEdit(batchIdFrozen, card.cardId, 'variantsJson');
                dirtyBadge.textContent = 'غير محفوظ';
                setStatusFor(
                  batchIdFrozen,
                  card.cardId +
                    ': ' +
                    built.variantsJson.length +
                    ' تركيبة (محفوظ ' +
                    (built.preserved || 0) +
                    ') — احفظي البطاقة',
                );
                renderCards();
              },
            }),
          );
          if (Array.isArray(state.localValues.variantsJson) && state.localValues.variantsJson.length) {
            const list = el('div', { className: 'bulk-variant-list' });
            if (state.variantPage == null) state.variantPage = 0;
            const all = state.localValues.variantsJson;
            const page = Math.max(0, state.variantPage | 0);
            const start = page * VARIANT_PAGE_SIZE;
            const end = Math.min(all.length, start + VARIANT_PAGE_SIZE);
            commerceHost.appendChild(
              el('p', {
                className: 'lead',
                text:
                  'عرض ' +
                  (start + 1) +
                  '–' +
                  end +
                  ' من ' +
                  all.length +
                  (all.length > VARIANT_PAGE_SIZE ? ' (تصفح دون فقدان التعديلات)' : ''),
              }),
            );
            all.slice(start, end).forEach((v, idx) => {
              const absIdx = start + idx;
              const priceIn = el('input', {
                type: 'text',
                inputmode: 'decimal',
                placeholder: 'سعر التركيبة (ريال)',
                value:
                  v.priceSarText != null
                    ? v.priceSarText
                    : v.priceHalalas != null
                      ? halalasToSar(v.priceHalalas)
                      : '',
                disabled: locked,
                'data-variant': v.id,
              });
              priceIn.addEventListener('input', () => {
                const t = priceIn.value;
                v.priceSarText = t;
                const trimmed = t.trim();
                if (!trimmed) {
                  v.priceHalalas = null;
                  v.priceError = null;
                } else {
                  try {
                    v.priceHalalas = sarToHalalas(trimmed);
                    v.priceError = null;
                  } catch (e) {
                    v.priceError = e.message || 'سعر تركيبة غير صالح';
                    // keep typed text; do NOT write old price as accepted
                  }
                }
                bumpEdit(batchIdFrozen, card.cardId, 'variantsJson');
                dirtyBadge.textContent = 'غير محفوظ';
                err.textContent = v.priceError || state.priceError || state.error || '';
              });
              const qtyIn = el('input', {
                type: 'text',
                inputmode: 'numeric',
                placeholder: 'كمية (فارغ=غير محدد)',
                value: v.stockQtyText != null ? v.stockQtyText : v.stockQty != null ? String(v.stockQty) : '',
                disabled: locked,
              });
              qtyIn.addEventListener('input', () => {
                const t = qtyIn.value;
                v.stockQtyText = t;
                const trimmed = t.trim();
                if (!trimmed) {
                  v.stockQty = null;
                  v.stockError = null;
                } else if (!/^\d+$/.test(trimmed)) {
                  v.stockError = 'الكمية يجب أن تكون عددًا صحيحًا غير سالب أو فارغة';
                } else {
                  v.stockQty = Number(trimmed);
                  v.stockError = null;
                }
                bumpEdit(batchIdFrozen, card.cardId, 'variantsJson');
                dirtyBadge.textContent = 'غير محفوظ';
                err.textContent = v.stockError || v.priceError || state.priceError || state.error || '';
              });
              const avail = el('input', {
                type: 'checkbox',
                checked: v.available !== false,
                disabled: locked,
              });
              avail.addEventListener('change', () => {
                v.available = !!avail.checked;
                bumpEdit(batchIdFrozen, card.cardId, 'variantsJson');
                dirtyBadge.textContent = 'غير محفوظ';
              });
              list.appendChild(
                el('div', { className: 'bulk-variant-row', 'data-variant-index': String(absIdx) }, [
                  el('strong', { text: (v.id || 'v' + absIdx) + ' #' + (absIdx + 1) }),
                  ' ',
                  priceIn,
                  qtyIn,
                  el('label', null, [avail, ' متاح']),
                  v.priceError || v.stockError
                    ? el('span', {
                        style: 'color:#b00020',
                        text: ' ' + (v.priceError || v.stockError),
                      })
                    : null,
                ]),
              );
            });
            if (all.length > VARIANT_PAGE_SIZE) {
              const nav = el('div', { className: 'journey-actions' });
              nav.appendChild(
                el('button', {
                  type: 'button',
                  className: 'btn btn-ghost',
                  text: 'السابق',
                  disabled: page <= 0 || locked,
                  onClick: () => {
                    state.variantPage = Math.max(0, page - 1);
                    renderCards();
                  },
                }),
              );
              nav.appendChild(
                el('button', {
                  type: 'button',
                  className: 'btn btn-ghost',
                  text: 'التالي',
                  disabled: end >= all.length || locked,
                  onClick: () => {
                    state.variantPage = page + 1;
                    renderCards();
                  },
                }),
              );
              list.appendChild(nav);
            }
            commerceHost.appendChild(list);
          }
          fieldsHost.appendChild(commerceHost);
        }

        // Product: single lengthCm editor when profile lists it (skipped from generic loop).
        const rootReg = (registry && registry.registry) || registry || {};
        const profileFields = (
          ((rootReg.profiles || []).find((p) => p.id === batch.profileId) || {}).fields || []
        );
        const lengthSupported = batch.kind === 'product' && profileFields.indexOf('lengthCm') >= 0;
        if (lengthSupported) {
          const dim = el('div', { className: 'bulk-dimensions', 'data-length-editor': '1' });
          dim.appendChild(el('p', { className: 'lead', text: 'طول المنتج سم (اختياري)' }));
          const lenDef = (rootReg.fields && rootReg.fields.lengthCm) || {};
          const shown =
            state.lengthCmText != null
              ? state.lengthCmText
              : state.localValues.lengthCm != null
                ? String(state.localValues.lengthCm)
                : '';
          const lenInp = el('input', {
            type: 'text',
            inputMode: 'decimal',
            placeholder: 'طول',
            value: shown,
            disabled: locked,
            style: 'width:72px',
            'data-field': 'lengthCm',
          });
          const lenErr = el('span', {
            className: 'bulk-field-error',
            text: state.lengthCmError || '',
            style: 'color:#b00020;margin-inline-start:8px;font-size:12px',
          });
          if (state.lengthCmError) lenInp.style.borderColor = '#b00020';
          const applyLength = () => {
            const t = lenInp.value.trim();
            state.lengthCmText = lenInp.value;
            if (!t) {
              delete state.localValues.lengthCm;
              state.lengthCmError = null;
              lenInp.style.borderColor = '';
              lenErr.textContent = '';
            } else if (!/^\d+(\.\d{1,2})?$/.test(t)) {
              state.lengthCmError = 'الطول غير صالح — أدخلي رقمًا بحد أقصى منزلتين عشريتين';
              lenInp.style.borderColor = '#b00020';
              lenErr.textContent = state.lengthCmError;
              // Do NOT keep previous good lengthCm as if current input succeeded.
              delete state.localValues.lengthCm;
            } else {
              const n = Number(t);
              if (lenDef.min != null && n < Number(lenDef.min)) {
                state.lengthCmError = 'الطول أقل من الحد الأدنى';
                lenInp.style.borderColor = '#b00020';
                lenErr.textContent = state.lengthCmError;
                delete state.localValues.lengthCm;
              } else if (lenDef.max != null && n > Number(lenDef.max)) {
                state.lengthCmError = 'الطول أكبر من الحد الأقصى';
                lenInp.style.borderColor = '#b00020';
                lenErr.textContent = state.lengthCmError;
                delete state.localValues.lengthCm;
              } else {
                state.localValues.lengthCm = n;
                state.lengthCmError = null;
                lenInp.style.borderColor = '';
                lenErr.textContent = '';
              }
            }
            bumpEdit(batchIdFrozen, card.cardId, 'lengthCm');
            dirtyBadge.textContent = 'غير محفوظ';
          };
          lenInp.addEventListener('input', applyLength);
          lenInp.addEventListener('change', applyLength);
          dim.appendChild(el('label', { style: 'margin-inline-end:8px' }, ['طول ', lenInp, lenErr]));
          fieldsHost.appendChild(dim);
        }

        // Service: weekly hours + exceptions + resource/capacity → availabilityJson
        if (batch.kind === 'service') {
          hydrateScheduleUiFields(state.localValues);
          const sched = el('div', { className: 'bulk-schedule' });
          sched.appendChild(
            el('p', {
              className: 'lead',
              text: 'إتاحة أسبوعية (اختياري) — المورد ≠ الفرع؛ السعة العامة تُطبَّق على الأيام الظاهرة',
            }),
          );
          const mixedNote = state.localValues._scheduleMixed
            ? el('p', {
                className: 'lead',
                text: 'الأيام الحالية لها موارد/سعات مختلفة — عدّلي القيم العامة لتوحيد الوراثة، أو اتركيها كما هي',
                style: 'color:#8a5a00',
              })
            : null;
          if (mixedNote) sched.appendChild(mixedNote);
          const resIn = el('input', {
            type: 'text',
            placeholder: 'معرّف المورد (ليس الفرع)',
            value: state.localValues.defaultResourceId || '',
            disabled: locked,
          });
          const capIn = el('input', {
            type: 'number',
            min: '1',
            placeholder: 'سعة',
            value: state.localValues.defaultCapacity != null ? String(state.localValues.defaultCapacity) : '',
            disabled: locked,
            style: 'width:64px',
          });
          if (!state.dayTimeErrors || typeof state.dayTimeErrors !== 'object') state.dayTimeErrors = {};
          const capErr = el('span', {
            className: 'bulk-field-error',
            text: state.capacityError || '',
            style: 'color:#b00020;display:block;font-size:12px',
          });
          const schedErr = el('span', {
            className: 'bulk-field-error',
            text: state.scheduleError || '',
            style: 'color:#b00020;display:block;font-size:12px',
          });
          const refreshDayMetas = () => {
            const live = readWeeklyHours(state.localValues);
            WEEK_DAYS.forEach((d) => {
              const metaEl = sched.querySelector('[data-day-meta="' + d.id + '"]');
              if (!metaEl) return;
              const row = live.find((h) => h && (h.day === d.id || h.weekday === d.id));
              if (!row) {
                metaEl.textContent = '';
                return;
              }
              metaEl.textContent =
                ' · ' +
                (row.resourceId || state.localValues.defaultResourceId || '—') +
                ' / سعة ' +
                (row.capacity != null
                  ? row.capacity
                  : state.localValues.defaultCapacity != null
                    ? state.localValues.defaultCapacity
                    : '—');
            });
          };
          const syncMeta = () => {
            const r = resIn.value.trim();
            const cRaw = capIn.value.trim();
            if (cRaw && (!/^\d+$/.test(cRaw) || Number(cRaw) < 1)) {
              state.capacityError = 'السعة يجب أن تكون عددًا صحيحًا ≥ 1';
              capErr.textContent = state.capacityError;
              bumpEdit(batchIdFrozen, card.cardId, 'weeklyHours');
              dirtyBadge.textContent = 'غير محفوظ';
              return;
            }
            state.capacityError = null;
            capErr.textContent = '';
            if (r) state.localValues.defaultResourceId = r;
            else delete state.localValues.defaultResourceId;
            if (cRaw) state.localValues.defaultCapacity = Number(cRaw);
            else delete state.localValues.defaultCapacity;
            // Propagate onto inheriting rows only — never clobber per-day overrides.
            const live = readWeeklyHours(state.localValues);
            if (live.length) {
              state.localValues.weeklyHours = applyDefaultsOntoWeeklyHours(
                live,
                state.localValues.defaultResourceId,
                state.localValues.defaultCapacity,
              );
              state.localValues._scheduleMixed = deriveScheduleDefaults(
                state.localValues.weeklyHours,
              ).mixed;
            }
            syncAvailabilityOntoLocal(state);
            bumpEdit(batchIdFrozen, card.cardId, 'weeklyHours');
            dirtyBadge.textContent = 'غير محفوظ';
            refreshDayMetas();
          };
          resIn.addEventListener('change', syncMeta);
          capIn.addEventListener('change', syncMeta);
          sched.appendChild(
            el('div', { style: 'display:flex;gap:8px;align-items:center;margin:4px 0;flex-wrap:wrap' }, [
              el('label', null, ['مورد ', resIn]),
              el('label', null, ['سعة ', capIn]),
            ]),
          );
          sched.appendChild(capErr);
          sched.appendChild(schedErr);
          WEEK_DAYS.forEach((d) => {
            const hoursSnap = readWeeklyHours(state.localValues);
            const existing = hoursSnap.find((h) => h && (h.day === d.id || h.weekday === d.id));
            const dayErr = el('span', {
              className: 'bulk-field-error',
              'data-day-err': d.id,
              text: (state.dayTimeErrors && state.dayTimeErrors[d.id]) || '',
              style: 'color:#b00020;font-size:11px',
            });
            const on = el('input', {
              type: 'checkbox',
              checked: !!existing,
              disabled: locked,
            });
            const open = el('input', {
              type: 'time',
              value: (existing && (existing.open || existing.start)) || '10:00',
              disabled: locked || !existing,
            });
            const close = el('input', {
              type: 'time',
              value: (existing && (existing.close || existing.end)) || '18:00',
              disabled: locked || !existing,
            });
            const rowMeta = el('span', {
              style: 'font-size:11px;opacity:0.75',
              'data-day-meta': d.id,
              text: existing
                ? ' · ' +
                  (existing.resourceId || state.localValues.defaultResourceId || '—') +
                  ' / سعة ' +
                  (existing.capacity != null
                    ? existing.capacity
                    : state.localValues.defaultCapacity != null
                      ? state.localValues.defaultCapacity
                      : '—')
                : '',
            });
            const syncHours = () => {
              // Always read latest card schedule — stale closure copies wiped sibling day meta.
              const prev = readWeeklyHours(state.localValues).find(
                (h) => h && (h.day === d.id || h.weekday === d.id),
              );
              if (on.checked) {
                const startMin = timeToMin(open.value);
                const endMin = timeToMin(close.value);
                if (startMin == null || endMin == null || endMin <= startMin) {
                  if (!state.dayTimeErrors) state.dayTimeErrors = {};
                  state.dayTimeErrors[d.id] = 'وقت غير صالح ليوم ' + d.label;
                  dayErr.textContent = state.dayTimeErrors[d.id];
                  // Keep prior checked state for this day; do not mutate other days.
                  if (!prev) on.checked = false;
                  return;
                }
                if (state.dayTimeErrors) {
                  delete state.dayTimeErrors[d.id];
                  dayErr.textContent = '';
                }
                const row = {
                  day: d.id,
                  open: open.value,
                  close: close.value,
                };
                // Time-only edits must preserve this day's resource/capacity/overrides.
                if (prev && prev.resourceId) row.resourceId = prev.resourceId;
                else {
                  const rid = (resIn.value || state.localValues.defaultResourceId || '').trim();
                  if (rid) row.resourceId = rid;
                }
                if (prev && prev.capacity != null) row.capacity = prev.capacity;
                else {
                  const cap = Number(capIn.value || state.localValues.defaultCapacity);
                  if (Number.isInteger(cap) && cap > 0) row.capacity = cap;
                }
                if (prev && prev.resourceOverride) row.resourceOverride = true;
                if (prev && prev.capacityOverride) row.capacityOverride = true;
                upsertWeeklyHourRow(state.localValues, d.id, row);
              } else {
                if (state.dayTimeErrors) {
                  delete state.dayTimeErrors[d.id];
                  dayErr.textContent = '';
                }
                upsertWeeklyHourRow(state.localValues, d.id, null);
              }
              const hours = readWeeklyHours(state.localValues);
              const dflt = deriveScheduleDefaults(hours);
              // Do not overwrite explicit general inputs from mixed rows on day toggle.
              if (!state.localValues.defaultResourceId && dflt.defaultResourceId) {
                state.localValues.defaultResourceId = dflt.defaultResourceId;
              }
              if (state.localValues.defaultCapacity == null && dflt.defaultCapacity != null) {
                state.localValues.defaultCapacity = dflt.defaultCapacity;
              }
              state.localValues._scheduleMixed = dflt.mixed;
              syncAvailabilityOntoLocal(state);
              bumpEdit(batchIdFrozen, card.cardId, 'weeklyHours');
              dirtyBadge.textContent = 'غير محفوظ';
              open.disabled = locked || !on.checked;
              close.disabled = locked || !on.checked;
              refreshDayMetas();
            };
            on.addEventListener('change', syncHours);
            open.addEventListener('change', syncHours);
            close.addEventListener('change', syncHours);
            sched.appendChild(
              el('div', { style: 'display:flex;gap:8px;align-items:center;margin:4px 0;flex-wrap:wrap' }, [
                el('label', null, [on, ' ' + d.label]),
                open,
                el('span', { text: '→' }),
                close,
                rowMeta,
                dayErr,
              ]),
            );
          });
          // Date exceptions: date inputs (not comma-only as sole UX)
          const excHost = el('div', { style: 'margin:8px 0' });
          excHost.appendChild(el('p', { className: 'lead', text: 'أيام مغلقة (اختياري)' }));
          let closed = Array.isArray(state.localValues.dateExceptions)
            ? state.localValues.dateExceptions
                .map((x) => (typeof x === 'string' ? x : x && x.date))
                .filter(Boolean)
            : [];
          const excList = el('div');
          const redrawExc = () => {
            excList.innerHTML = '';
            closed.forEach((date, idx) => {
              const di = el('input', { type: 'date', value: date, disabled: locked });
              di.addEventListener('change', () => {
                closed[idx] = di.value;
                if (!di.value) closed = closed.filter((_, i) => i !== idx);
                if (!closed.length) delete state.localValues.dateExceptions;
                else state.localValues.dateExceptions = closed.map((d0) => ({ date: d0, closed: true }));
                syncAvailabilityOntoLocal(state);
                bumpEdit(batchIdFrozen, card.cardId, 'dateExceptions');
                dirtyBadge.textContent = 'غير محفوظ';
                redrawExc();
              });
              const rm = el('button', {
                type: 'button',
                className: 'btn btn-ghost',
                text: 'حذف',
                disabled: locked,
                onClick: () => {
                  closed = closed.filter((_, i) => i !== idx);
                  if (!closed.length) delete state.localValues.dateExceptions;
                  else state.localValues.dateExceptions = closed.map((d0) => ({ date: d0, closed: true }));
                  syncAvailabilityOntoLocal(state);
                  bumpEdit(batchIdFrozen, card.cardId, 'dateExceptions');
                  dirtyBadge.textContent = 'غير محفوظ';
                  redrawExc();
                },
              });
              excList.appendChild(el('div', { style: 'display:flex;gap:8px;align-items:center' }, [di, rm]));
            });
          };
          redrawExc();
          const addExc = el('button', {
            type: 'button',
            className: 'btn btn-ghost',
            text: 'إضافة يوم مغلق',
            disabled: locked,
            onClick: () => {
              closed.push('');
              redrawExc();
            },
          });
          excHost.appendChild(excList);
          excHost.appendChild(addExc);
          sched.appendChild(excHost);

          // Service profile from batch profileId (not hardcoded salon_hair_cut)
          const profileTpl =
            String(batch.profileId || '')
              .replace(/^service\./, '')
              .trim() || 'salon_hair_cut';
          const prof = state.localValues.serviceProfile && typeof state.localValues.serviceProfile === 'object'
            ? state.localValues.serviceProfile
            : { templateId: profileTpl, templateVersion: 1, priceMode: 'fixed', answers: {} };
          if (!prof.templateId) prof.templateId = profileTpl;
          const placeSel = el('select', { disabled: locked });
          [['', '— مكان التقديم (اختياري) —'], ['branch', 'في الفرع'], ['home', 'منزل العميل'], ['remote', 'عن بُعد']].forEach((opt) => {
            const o = el('option', { value: opt[0], text: opt[1] });
            if (String((prof.answers && prof.answers.place_mode) || '') === opt[0]) o.selected = true;
            placeSel.appendChild(o);
          });
          const covHost = el('div', {
            style: 'margin-top:8px',
            className: 'bulk-coverage',
          });
          const covLabel = el('p', {
            className: 'lead',
            text: 'مدن التغطية المنزلية (معرّفات ثابتة)',
          });
          const selectedCov = new Set(
            Array.isArray(state.localValues.coverageZones)
              ? state.localValues.coverageZones.map(String)
              : [],
          );
          const SA_CITIES = [
            ['sa-riyadh', 'الرياض'],
            ['sa-jeddah', 'جدة'],
            ['sa-makkah', 'مكة المكرمة'],
            ['sa-madinah', 'المدينة المنورة'],
            ['sa-dammam', 'الدمام'],
            ['sa-khobar', 'الخبر'],
            ['sa-dhahran', 'الظهران'],
            ['sa-taif', 'الطائف'],
            ['sa-tabuk', 'تبوك'],
            ['sa-abha', 'أبها'],
            ['sa-khamis', 'خميس مشيط'],
            ['sa-najran', 'نجران'],
            ['sa-jazan', 'جازان'],
            ['sa-hail', 'حائل'],
            ['sa-buraidah', 'بريدة'],
            ['sa-unaizah', 'عنيزة'],
            ['sa-jubail', 'الجبيل'],
            ['sa-yanbu', 'ينبع'],
            ['sa-qatif', 'القطيف'],
            ['sa-sakaka', 'سكاكا'],
            ['sa-arf', 'عرعر'],
            ['sa-albahah', 'الباحة'],
            ['sa-hafar', 'حفر الباطن'],
            ['sa-kharj', 'الخرج'],
            ['sa-qassim', 'القصيم'],
          ];
          const syncCoverageVisibility = () => {
            const home = placeSel.value === 'home';
            covHost.style.display = home ? '' : 'none';
            if (!home) {
              delete state.localValues.coverageZones;
            }
          };
          const redrawCov = () => {
            covHost.innerHTML = '';
            covHost.appendChild(covLabel);
            SA_CITIES.forEach((pair) => {
              const id = pair[0];
              const name = pair[1];
              const cb = el('input', {
                type: 'checkbox',
                checked: selectedCov.has(id),
                disabled: locked || placeSel.value !== 'home',
              });
              cb.addEventListener('change', () => {
                if (cb.checked) selectedCov.add(id);
                else selectedCov.delete(id);
                const zones = Array.from(selectedCov);
                // Explicit [] clears server coverage on rematerialize.
                state.localValues.coverageZones = zones;
                bumpEdit(batchIdFrozen, card.cardId, 'coverageZones');
                dirtyBadge.textContent = 'غير محفوظ';
              });
              covHost.appendChild(
                el('label', { style: 'display:inline-flex;gap:4px;margin:2px 8px 2px 0;font-size:12px' }, [
                  cb,
                  ' ' + name,
                ]),
              );
            });
          };
          placeSel.addEventListener('change', () => {
            const next = Object.assign(
              { templateId: profileTpl, templateVersion: 1, priceMode: 'fixed', answers: {} },
              prof,
            );
            next.templateId = profileTpl;
            next.answers = Object.assign({}, next.answers || {});
            if (!placeSel.value) delete next.answers.place_mode;
            else next.answers.place_mode = placeSel.value;
            if (!placeSel.value && !Object.keys(next.answers).length) delete state.localValues.serviceProfile;
            else {
              if (!next.answers.session_kind) next.answers.session_kind = 'single';
              state.localValues.serviceProfile = next;
            }
            if (placeSel.value !== 'home') {
              selectedCov.clear();
              state.localValues.coverageZones = [];
              bumpEdit(batchIdFrozen, card.cardId, 'coverageZones');
            }
            bumpEdit(batchIdFrozen, card.cardId, 'serviceProfile');
            dirtyBadge.textContent = 'غير محفوظ';
            syncCoverageVisibility();
            redrawCov();
          });
          sched.appendChild(el('div', { style: 'margin-top:8px' }, [el('label', null, ['ملف الخدمة ', placeSel])]));
          redrawCov();
          syncCoverageVisibility();
          sched.appendChild(covHost);
          fieldsHost.appendChild(sched);
        }

        const saveBtn = el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: state.status === 'materialized' ? 'محوّلة' : 'حفظ البطاقة',
          disabled: locked,
          onClick: async () => {
            const ctx = freezeCtx(batch);
            try {
              await saveCard(ctx, card.cardId, {});
            } catch (e) {
              err.textContent = (e && e.message) || 'فشل الحفظ';
            }
          },
        });

        const mediaList = el('div', { className: 'bulk-media-list' });
        const refreshMedia = () => {
          mediaList.innerHTML = '';
          jobsForCard(batch.batchId, card.cardId).forEach((j) => {
            const pct =
              j.status === 'ready'
                ? '100%'
                : typeof j.uploadPercent === 'number'
                  ? Math.round(j.uploadPercent * 100) + '%'
                  : null;
            mediaList.appendChild(
              el('div', null, [
                el('span', {
                  text:
                    j.fileName +
                    ' · ' +
                    j.status +
                    (pct ? ' · ' + pct : '') +
                    (j.sessionId ? ' · sess…' + String(j.sessionId).slice(-6) : '') +
                    (j.mediaId ? ' · media ' + j.mediaId : '') +
                    (j.needsLocalFile ? ' · يلزم ملف' : ''),
                }),
                el('button', {
                  type: 'button',
                  className: 'btn btn-ghost',
                  text: 'إلغاء التعيين',
                  onClick: () => {
                    if (j.status === 'uploading' || j.status === 'verifying') {
                      setStatusFor(batch.batchId, 'لا يُلغى رفع جارٍ من الواجهة دون معرفة حالة الخادم.');
                      return;
                    }
                    delete mediaJobs[j.clientMediaId];
                    persistMediaMeta();
                    refreshMedia();
                  },
                }),
              ]),
            );
          });
        };
        refreshMedia();

        const assignBtn = el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: 'تعيين الملفات المحددة لهذه البطاقة',
          onClick: () => {
            const files = fileInput.files;
            if (!files || !files.length) {
              setStatusFor(batch.batchId, 'اختاري ملفات ثم عيّنيها يدويًا.');
              return;
            }
            const ctx = freezeCtx(batch);
            const cardIdFrozen = card.cardId;
            Array.from(files).forEach((file) => {
              const clientMediaId = newClientMediaId();
              mediaJobs[clientMediaId] = {
                clientMediaId: clientMediaId,
                batchId: ctx.batchId,
                cardId: cardIdFrozen,
                file: file,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                status: 'assigned',
                sessionId: null,
                mediaId: null,
                ownerId: state.targetOwnerId || null,
                ownerKindPath: ctx.ownerKindPath,
                error: null,
                needsLocalFile: false,
              };
            });
            persistMediaMeta();
            refreshMedia();
            refreshMediaProgress(ctx.batchId);
            const s = summarizeBatchMedia(ctx.batchId);
            setStatusFor(
              ctx.batchId,
              'عُيّنت ' +
                files.length +
                ' ملفًا لـ ' +
                ctx.batchId.slice(0, 8) +
                '/' +
                cardIdFrozen +
                ' · الإجمالي الآن ' +
                s.total +
                ' · متبقّي ' +
                s.remaining,
            );
          },
        });

        const refileInput = el('input', { type: 'file', accept: 'image/*,video/*', style: 'display:none' });
        const refileSelect = el('select');
        const refreshRefileOptions = () => {
          refileSelect.innerHTML = '';
          refileSelect.appendChild(el('option', { value: '', text: 'اختاري مهمة تحتاج ملفًا' }));
          jobsForCard(batch.batchId, card.cardId)
            .filter((j) => j.needsLocalFile || j.status === 'needs_reconcile' || j.status === 'needs_file')
            .forEach((j) => {
              refileSelect.appendChild(
                el('option', {
                  value: j.clientMediaId,
                  text: j.fileName + ' · ' + j.status,
                }),
              );
            });
        };
        refreshRefileOptions();
        refileInput.addEventListener('change', async () => {
          const file = refileInput.files && refileInput.files[0];
          const mid = refileSelect.value;
          if (!file || !mid) return;
          const need = mediaJobs[mid];
          if (!need || need.batchId !== batch.batchId || need.cardId !== card.cardId) {
            setStatusFor(batch.batchId, 'المهمة لا تطابق هذه البطاقة.');
            return;
          }
          if (need.size && file.size !== need.size) {
            setStatusFor(batch.batchId, 'الحجم لا يطابق الجلسة.');
            return;
          }
          if (need.checksum && typeof PartnersApi.sha256FileIncremental === 'function') {
            try {
              const actual = await PartnersApi.sha256FileIncremental(file, {});
              if (actual !== need.checksum) {
                setStatusFor(batch.batchId, 'البصمة لا تطابق جلسة الرفع.');
                return;
              }
            } catch (_) {}
          }
          need.file = file;
          need.needsLocalFile = false;
          need.fileName = file.name;
          need.mimeType = file.type || need.mimeType;
          if (need.status === 'needs_file' || need.status === 'needs_reconcile') need.status = 'assigned';
          persistMediaMeta();
          refreshMedia();
          refreshRefileOptions();
          setStatusFor(batch.batchId, 'أُعيد ربط الملف للمهمة ' + mid.slice(0, 8));
        });
        const refileBtn = el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: 'إعادة اختيار ملف للمهمة المحددة',
          onClick: () => {
            if (!refileSelect.value) {
              setStatusFor(batch.batchId, 'حددي مهمة تحتاج ملفًا.');
              return;
            }
            refileInput.click();
          },
        });

        const phase =
          state.status === 'materialized'
            ? 'عنصر مُنشأ' +
              (state.contentStatus ? ' · محتوى:' + state.contentStatus : '') +
              (state.submitReviewStatus ? ' · مراجعة:' + state.submitReviewStatus : '')
            : 'مسودة';

        cardsHost.appendChild(
          el('div', { className: 'bulk-card', 'data-batch': batch.batchId, 'data-card': card.cardId }, [
            el('div', { className: 'bulk-card-head' }, [
              ck,
              el('strong', { text: card.cardId }),
              el('span', { text: ' · ' + phase + ' · ' }),
              dirtyBadge,
              state.targetOwnerId ? el('a', { href: state.openUrl || card.openUrl, text: ' فتح العنصر' }) : null,
            ]),
            fieldsHost,
            state.status === 'materialized' ? null : saveBtn,
            assignBtn,
            refileSelect,
            refileBtn,
            refileInput,
            mediaList,
            err,
          ]),
        );
      });
      refreshMediaProgress(batch.batchId);
    }

    async function loadMyBatches() {
      listHost.innerHTML = '';
      try {
        const list = await PartnersApi.listBulkBatches();
        listHost.appendChild(el('h3', { text: 'دفعاتي' }));
        (list.items || []).forEach((it) => {
          listHost.appendChild(
            el('div', { className: 'journey-actions' }, [
              el('button', {
                type: 'button',
                className: 'btn btn-ghost',
                text:
                  it.batchId.slice(0, 8) +
                  '… · ' +
                  it.kind +
                  ' · ' +
                  it.cardCount +
                  ' · محوّل ' +
                  (it.materializedCount || 0),
                onClick: async () => {
                  if (!confirmLeaveIfNeeded()) return;
                  try {
                    const b = await PartnersApi.getBulkBatch(it.batchId);
                    openBatchView(b);
                    setStatusFor(b.batchId, 'فُتحت ' + b.batchId + ' · وسائط: ' + jobsForBatch(b.batchId).length);
                  } catch (e) {
                    status.textContent = (e && (e.messageAr || e.message)) || String(e);
                  }
                },
              }),
            ]),
          );
        });
      } catch (e) {
        listHost.appendChild(el('p', { text: (e && e.message) || String(e) }));
      }
    }

    const createBtn = el('button', {
      type: 'button',
      className: 'btn btn-primary',
      text: 'إنشاء البطاقات',
      onClick: async () => {
        if (!confirmLeaveIfNeeded()) return;
        try {
          if (!registry || profileSelect.disabled || !profileSelect.value) {
            status.textContent = registryError || 'اختاري قالبًا من الخادم.';
            return;
          }
          const count = Number(countInput.value);
          if (!Number.isInteger(count) || count < 1) {
            status.textContent = 'عدد صحيح فقط.';
            return;
          }
          let batchId = sessionStorage.getItem(BATCH_KEY);
          if (!batchId) {
            batchId = newBatchId();
            sessionStorage.setItem(BATCH_KEY, batchId);
          }
          const b = await PartnersApi.createBulkBatch({
            kind: kindSelect.value,
            profileId: profileSelect.value,
            count: count,
            batchId: batchId,
          });
          sessionStorage.removeItem(BATCH_KEY);
          openBatchView(b);
          setStatusFor(b.batchId, 'دفعة جاهزة ' + b.batchId);
          await loadMyBatches();
        } catch (e) {
          status.textContent = (e && (e.messageAr || e.message)) || String(e);
        }
      },
    });

    const sharedName = el('input', { type: 'text', placeholder: 'اسم مشترك' });
    const sharedPrice = el('input', { type: 'text', placeholder: 'سعر مشترك (ريال)' });
    const overwriteCk = el('input', { type: 'checkbox' });
    const fileInput = el('input', { type: 'file', multiple: 'multiple', accept: 'image/*,video/*' });
    let lastPreview = null;

    const selectedIds = () =>
      Array.from(cardsHost.querySelectorAll('.bulk-card-ck:checked')).map((n) => n.getAttribute('data-card'));

    const previewBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: 'معاينة التعبئة',
      onClick: async () => {
        if (!openBatch) return;
        const ctx = freezeCtx(openBatch);
        const values = {};
        if (sharedName.value.trim()) values.nameAr = sharedName.value.trim();
        if (sharedPrice.value.trim()) {
          try {
            values.priceHalalas = sarToHalalas(sharedPrice.value);
          } catch (e) {
            setStatusFor(ctx.batchId, e.message);
            return;
          }
        }
        const cardIds = selectedIds();
        const expectedRevisions = {};
        const map = ensureBatchCards(ctx.batchId);
        cardIds.forEach((id) => {
          if (map[id]) expectedRevisions[id] = map[id].revision;
        });
        try {
          const preview = await PartnersApi.applyBulkShared(ctx.batchId, {
            previewOnly: true,
            cardIds: cardIds,
            values: values,
            overwriteWritten: overwriteCk.checked,
            expectedRevisions: expectedRevisions,
          });
          lastPreview = {
            batchId: ctx.batchId,
            expectedRevisions: expectedRevisions,
            values: values,
            cardIds: cardIds,
          };
          const lines = (preview.perCard || [])
            .map((p) => p.cardId + '@' + p.revision + ':[' + (p.willSet || []).join(',') + ']')
            .join(' · ');
          setStatusFor(ctx.batchId, 'معاينة ' + ctx.batchId.slice(0, 8) + ': ' + (lines || 'لا تغيير'));
        } catch (e) {
          setStatusFor(ctx.batchId, (e && (e.messageAr || e.message)) || String(e));
        }
      },
    });

    const applySharedBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: 'تعبئة مشتركة',
      onClick: async () => {
        if (!openBatch) return;
        const ctx = freezeCtx(openBatch);
        if (commitLocks[ctx.batchId]) {
          setStatusFor(ctx.batchId, 'تعبئة مرفوضة — تحويل/حفظ حرج جارٍ على هذه الدفعة.');
          return;
        }
        const values = {};
        if (sharedName.value.trim()) values.nameAr = sharedName.value.trim();
        if (sharedPrice.value.trim()) {
          try {
            values.priceHalalas = sarToHalalas(sharedPrice.value);
          } catch (e) {
            setStatusFor(ctx.batchId, e.message);
            return;
          }
        }
        const cardIds = selectedIds();
        const map = ensureBatchCards(ctx.batchId);
        const expectedRevisions = {};
        const blockedLocal = [];
        cardIds.forEach((id) => {
          const st = map[id];
          if (!st) return;
          expectedRevisions[id] = st.revision;
          if (st.dirty && !overwriteCk.checked) blockedLocal.push(id);
          if (cardHasValidationErrors(st)) blockedLocal.push(id + ':invalid');
        });
        if (blockedLocal.length && !overwriteCk.checked) {
          setStatusFor(ctx.batchId, 'بطاقات dirty/غير صالحة: ' + blockedLocal.join(',') + ' — احفظي أو فعّلي الاستبدال.');
          return;
        }
        if (blockedLocal.some((x) => String(x).indexOf(':invalid') >= 0)) {
          setStatusFor(ctx.batchId, 'تعبئة مرفوضة — أصلحي القيم غير الصالحة أولًا.');
          return;
        }
        if (lastPreview && lastPreview.batchId === ctx.batchId) {
          const drift = cardIds.filter((id) => lastPreview.expectedRevisions[id] !== expectedRevisions[id]);
          if (drift.length) {
            setStatusFor(ctx.batchId, 'تغيرت إصدارات بعد المعاينة (' + drift.join(',') + ').');
            return;
          }
        }
        try {
          const out = await PartnersApi.applyBulkShared(ctx.batchId, {
            cardIds: cardIds,
            values: values,
            overwriteWritten: overwriteCk.checked,
            expectedRevisions: expectedRevisions,
          });
          // Apply ONLY to ctx.batchId card map
          const dest = ensureBatchCards(ctx.batchId);
          (out.results || []).forEach((r) => {
            const st = dest[r.cardId];
            if (!st) return;
            if (r.ok) {
              st.revision = r.revision;
              st.savedValues = Object.assign({}, r.values || {});
              // Merge server values into local only for fields that were not dirtied after request,
              // or when overwrite / not dirty.
              const serverVals = r.values || {};
              Object.keys(serverVals).forEach((k) => {
                if (st.dirtyFields[k] && st.editGen !== st.saveGen) return;
                st.localValues[k] = serverVals[k];
                if (k === 'priceHalalas') {
                  st.priceSarText = serverVals[k] != null ? halalasToSar(serverVals[k]) : '';
                  st.priceError = null;
                  delete st.dirtyFields.priceHalalas;
                } else {
                  delete st.dirtyFields[k];
                }
              });
              st.dirty = Object.keys(st.dirtyFields).length > 0;
              st.error = null;
            } else {
              const errBody = r.error || {};
              st.error = errBody.messageAr || errBody.message || errBody.code || 'فشل';
            }
          });
          if (isOpen(ctx.batchId)) renderCards();
          if (out.allOk) setStatusFor(ctx.batchId, 'تعبئة ' + ctx.batchId.slice(0, 8) + ': نجحت كلها (' + out.succeeded + ')');
          else if (out.partial)
            setStatusFor(ctx.batchId, 'نجاح جزئي على ' + ctx.batchId.slice(0, 8) + ': ' + out.succeeded + '/' + out.failed);
          else setStatusFor(ctx.batchId, 'تعبئة فشلت على ' + ctx.batchId.slice(0, 8));
        } catch (e) {
          setStatusFor(ctx.batchId, (e && (e.messageAr || e.message)) || String(e));
        }
      },
    });

    /**
     * Map server upload-session status → UI job status per API contract.
     * ready | uploaded | verifying | uploading(+storageCompleted) must NOT become needs_file.
     */
    async function reconcileJobSession(job) {
      if (!job.sessionId || typeof PartnersApi.getUploadSession !== 'function') return job;
      try {
        const sess = await PartnersApi.getUploadSession(job.sessionId);
        if (!sess) return job;
        if (sess.ownerKind === 'product') job.ownerKindPath = 'products';
        else if (sess.ownerKind === 'service') job.ownerKindPath = 'services';
        if (sess.ownerId) job.ownerId = sess.ownerId;
        if (sess.declaredChecksum) job.checksum = sess.declaredChecksum;
        if (sess.declaredByteSize != null) job.size = sess.declaredByteSize;

        const mediaId = sess.catalogMediaId || sess.mediaId || null;
        if (sess.status === 'ready' && mediaId) {
          job.status = 'ready';
          job.mediaId = mediaId;
          job.file = null;
          job.needsLocalFile = false;
          job.error = null;
          persistMediaMeta();
          return job;
        }
        if (
          sess.status === 'uploaded' ||
          sess.status === 'verifying' ||
          sess.status === 'finalizing' ||
          sess.status === 'completing' ||
          (sess.status === 'uploading' && sess.storageCompleted)
        ) {
          job.status = 'verifying';
          job.needsLocalFile = false;
          job.error = null;
          persistMediaMeta();
          return job;
        }
        if (sess.status === 'aborted') {
          job.status = 'aborted';
          job.error = sess.failureMessageAr || sess.failureCode || 'أُلغي الرفع';
          job.needsLocalFile = false;
          persistMediaMeta();
          return job;
        }
        if (sess.status === 'failed' && sess.failureClass === 'permanent') {
          job.status = 'failed_permanent';
          job.error = sess.failureMessageAr || sess.failureCode || 'فشل دائم';
          job.needsLocalFile = false;
          persistMediaMeta();
          return job;
        }
        if (sess.status === 'failed' && sess.failureClass === 'retryable') {
          job.status = 'failed_retryable';
          job.error = sess.failureMessageAr || sess.failureCode || 'فشل قابل لإعادة الإنهاء';
          job.needsLocalFile = false;
          persistMediaMeta();
          return job;
        }
        // uploading without storageCompleted, or initiated — may still need local bytes
        const partsDone = Array.isArray(sess.parts) ? sess.parts.length : sess.completedParts || 0;
        const partsTotal = sess.totalParts || 0;
        if (partsDone > 0 && partsDone < partsTotal && !job.file) {
          job.status = 'needs_file';
          job.needsLocalFile = true;
          job.error = null;
          persistMediaMeta();
          return job;
        }
        if (!job.file && sess.status === 'uploading' && !sess.storageCompleted) {
          job.status = 'needs_file';
          job.needsLocalFile = true;
          job.error = null;
          persistMediaMeta();
          return job;
        }
        persistMediaMeta();
      } catch (e) {
        const code = e && e.code;
        if (code === 'NOT_FOUND' || (e && e.status === 404)) {
          job.status = 'failed';
          job.error = 'الجلسة غير موجودة أو غير مصرح بها';
          job.needsLocalFile = false;
          persistMediaMeta();
          throw e;
        }
        throw e;
      }
      return job;
    }

    async function retryFinalizeSession(sessionId) {
      if (typeof PartnersApi.retryFinalizeUploadSession === 'function') {
        return PartnersApi.retryFinalizeUploadSession(sessionId);
      }
      if (typeof PartnersApi.request === 'function') {
        return PartnersApi.request(
          'POST',
          '/partners-portal/upload-sessions/' + encodeURIComponent(sessionId) + '/retry-finalize',
          {},
        );
      }
      return null;
    }

    async function pollVerifyUntilReady(job, opts) {
      const maxMs = (opts && opts.maxMs) || 15000;
      const started = Date.now();
      let retryCalls = 0;
      while (Date.now() - started < maxMs) {
        await reconcileJobSession(job);
        if (job.status === 'ready') return job;
        if (job.status === 'aborted' || job.status === 'failed_permanent' || job.status === 'failed') return job;
        if (job.status === 'failed_retryable' || job.status === 'verifying') {
          if (job.status === 'failed_retryable' && job.sessionId && retryCalls < 5) {
            retryCalls += 1;
            job.status = 'verifying';
            persistMediaMeta();
            try {
              const state = await retryFinalizeSession(job.sessionId);
              if (state && state.status === 'ready') {
                job.status = 'ready';
                job.mediaId = state.catalogMediaId || state.mediaId || job.mediaId;
                job.needsLocalFile = false;
                job.error = null;
                persistMediaMeta();
                return job;
              }
            } catch (e) {
              job.error = (e && (e.messageAr || e.message)) || String(e);
              persistMediaMeta();
            }
          }
          await sleep(500);
          continue;
        }
        return job;
      }
      return job;
    }

    function acquireBatchCommitLock(batchId) {
      if (commitLocks[batchId]) return false;
      commitLocks[batchId] = true;
      const map = ensureBatchCards(batchId);
      Object.keys(map).forEach((id) => {
        map[id].commitLocked = true;
      });
      return true;
    }

    function releaseBatchCommitLock(batchId) {
      delete commitLocks[batchId];
      const map = ensureBatchCards(batchId);
      Object.keys(map).forEach((id) => {
        map[id].commitLocked = false;
      });
    }

    /** Wait until batch commit lock can be taken, or owner already exists for card. */
    async function acquireBatchCommitLockWhenFree(batchId, cardId, maxMs) {
      const deadline = Date.now() + (maxMs || 90000);
      while (Date.now() < deadline) {
        const live = ensureBatchCards(batchId)[cardId];
        if (live && live.targetOwnerId) return { ownerId: live.targetOwnerId, acquired: false };
        if (acquireBatchCommitLock(batchId)) return { ownerId: null, acquired: true };
        await sleep(40);
      }
      throw new Error('انتهت مهلة انتظار قفل التحويل للدفعة');
    }

    function applyOwnerToCard(ctx, ownerId, committedValues, committedRev) {
      const live = ensureBatchCards(ctx.batchId)[ctx.cardId];
      if (!live) return;
      live.targetOwnerId = ownerId;
      live.status = 'materialized';
      if (committedRev != null) live.revision = committedRev;
      if (committedValues) {
        live.savedValues = Object.assign({}, committedValues);
        if (live.dirty && live.editGen !== live.saveGen) {
          live.error = 'اكتمل التحويل بالقيم المعتمدة؛ بقي تعديل أحدث غير محفوظ — صحّحيه على العنصر.';
        } else {
          live.localValues = Object.assign({}, committedValues);
          live.dirty = false;
          live.dirtyFields = Object.create(null);
          if (committedValues.priceHalalas != null) {
            live.priceSarText = halalasToSar(committedValues.priceHalalas);
          }
          live.error = null;
        }
      }
    }

    /**
     * Ensure card has targetOwnerId for upload. Concurrent jobs for the same card
     * join one materialize promise; other cards WAIT for the batch lock (not fail).
     */
    async function ensureOwnerForUpload(ctx, st, job) {
      let ownerId = (job && job.ownerId) || ctx.ownerId || st.targetOwnerId;
      if (ownerId) return ownerId;
      const lockKey = cardKey(ctx.batchId, ctx.cardId);

      if (cardOwnerPromises[lockKey]) {
        if (job) {
          job.status = 'waiting';
          job.error = null;
          persistMediaMeta();
        }
        setStatusFor(ctx.batchId, 'انتظار إنشاء عنصر ' + ctx.cardId + '…');
        return cardOwnerPromises[lockKey];
      }

      if (cardHasValidationErrors(st)) {
        throw new Error('قيم غير صالحة — أوقِف التحويل التلقائي قبل الرفع');
      }
      if (st.dirty) {
        throw new Error('لا تحويل تلقائي قبل الرفع مع تعديلات غير معتمدة');
      }

      const committedValues = deepCloneJson(st.savedValues || {});
      const committedRev = st.revision;

      cardOwnerPromises[lockKey] = (async () => {
        try {
          const live0 = ensureBatchCards(ctx.batchId)[ctx.cardId];
          if (live0 && live0.targetOwnerId) return live0.targetOwnerId;

          if (job) {
            job.status = 'waiting';
            job.error = null;
            persistMediaMeta();
          }
          const got = await acquireBatchCommitLockWhenFree(ctx.batchId, ctx.cardId, 90000);
          if (got.ownerId) return got.ownerId;

          cardMatLocks[lockKey] = true;
          if (job) {
            job.status = 'creating';
            persistMediaMeta();
          }
          setStatusFor(ctx.batchId, 'إنشاء عنصر ' + ctx.cardId + '…');
          if (isOpen(ctx.batchId)) renderCards();
          try {
            const mat = await PartnersApi.materializeBulkBatch(
              ctx.batchId,
              { cardIds: [ctx.cardId], submitReview: false },
              'bulk-media-' + ctx.batchId + '-' + ctx.cardId,
            );
            const row = (mat.results || []).find((r) => r.cardId === ctx.cardId);
            if (row && row.ok && row.targetOwnerId) {
              applyOwnerToCard(ctx, row.targetOwnerId, committedValues, committedRev);
              return row.targetOwnerId;
            }
            // Lost response / partial: re-fetch before recreate
            try {
              const fresh = await PartnersApi.getBulkBatch(ctx.batchId);
              const card = (fresh.cards || []).find((c) => c.cardId === ctx.cardId);
              if (card && card.targetOwnerId) {
                applyOwnerToCard(
                  ctx,
                  card.targetOwnerId,
                  Object.assign({}, card.values || committedValues),
                  card.revision != null ? card.revision : committedRev,
                );
                return card.targetOwnerId;
              }
            } catch (_) {}
            throw new Error(
              (row && row.error && (row.error.messageAr || row.error.code)) || 'تعذر إنشاء العنصر قبل الرفع',
            );
          } finally {
            delete cardMatLocks[lockKey];
            releaseBatchCommitLock(ctx.batchId);
            if (isOpen(ctx.batchId)) renderCards();
          }
        } finally {
          // Keep resolved promise briefly so late joiners get the same result via targetOwnerId
          const done = cardOwnerPromises[lockKey];
          setTimeout(() => {
            if (cardOwnerPromises[lockKey] === done) delete cardOwnerPromises[lockKey];
          }, 0);
        }
      })();

      return cardOwnerPromises[lockKey];
    }

    /** Single-flight save for a card so multi-file upload does not race same revision. */
    async function ensureSavedBeforeUpload(ctx, st, job) {
      if (!(st.dirty && st.status !== 'materialized')) return;
      const key = cardKey(ctx.batchId, ctx.cardId);
      if (cardSavePromises[key]) {
        if (job) {
          job.status = 'waiting';
          persistMediaMeta();
        }
        await cardSavePromises[key];
        const after = ensureBatchCards(ctx.batchId)[ctx.cardId];
        if (after.dirty || cardHasValidationErrors(after)) {
          throw new Error('تعذر اعتماد الحفظ قبل الرفع — يوجد تعديل أحدث أو قيمة غير صالحة');
        }
        return;
      }
      if (cardHasValidationErrors(st)) {
        throw new Error('قيم غير صالحة — أوقِف الحفظ قبل الرفع');
      }
      const snap = buildSavePayload(st);
      snap.values = deepCloneJson(snap.values);
      snap.clearFields = (snap.clearFields || []).slice();
      if (job) {
        job.status = 'saving';
        persistMediaMeta();
      }
      cardSavePromises[key] = (async () => {
        await saveCard(
          { batchId: ctx.batchId, kind: ctx.ownerKindPath === 'products' ? 'product' : 'service', profileId: '' },
          ctx.cardId,
          { silent: true, skipRender: true, snapshot: snap },
        );
        const after = ensureBatchCards(ctx.batchId)[ctx.cardId];
        if (after.editGen !== snap.editGen || after.dirty || cardHasValidationErrors(after)) {
          throw new Error('تعذر اعتماد الحفظ قبل الرفع — يوجد تعديل أحدث أو قيمة غير صالحة');
        }
      })().finally(() => {
        delete cardSavePromises[key];
      });
      await cardSavePromises[key];
    }

    async function runOneUpload(job) {
      const ctx = {
        batchId: job.batchId,
        cardId: job.cardId,
        ownerKindPath: job.ownerKindPath,
        ownerId: job.ownerId,
      };
      if (!ctx.ownerKindPath) {
        job.status = 'failed';
        job.error = 'نوع المالك مفقود — لا افتراض products';
        persistMediaMeta();
        return;
      }
      const st = ensureBatchCards(ctx.batchId)[ctx.cardId];
      if (!st) {
        job.status = 'failed';
        job.error = 'بطاقة الوجهة غير محمّلة';
        persistMediaMeta();
        return;
      }
      if (job.status === 'ready' && job.mediaId) return;

      if (job.sessionId) {
        await reconcileJobSession(job);
        if (job.status === 'ready') return;
        if (job.status === 'aborted' || job.status === 'failed_permanent') {
          persistMediaMeta();
          if (isOpen(ctx.batchId)) renderCards();
          return;
        }
        if (job.status === 'verifying' || job.status === 'failed_retryable') {
          await pollVerifyUntilReady(job, { maxMs: 12000 });
          if (job.status === 'ready') return;
          if (job.status === 'verifying' || job.status === 'failed_retryable') {
            setStatusFor(
              ctx.batchId,
              'جلسة …' +
                String(job.sessionId).slice(-6) +
                ' في التحقق/إعادة إنهاء — اضغطي الاستكمال لاحقًا دون إعادة اختيار ملف.',
            );
            persistMediaMeta();
            if (isOpen(ctx.batchId)) renderCards();
            return;
          }
          if (job.status === 'aborted' || job.status === 'failed_permanent' || job.status === 'failed') return;
        }
      }

      if (!job.file) {
        if (
          job.status === 'verifying' ||
          job.status === 'failed_retryable' ||
          job.status === 'aborted' ||
          job.status === 'failed_permanent'
        ) {
          return;
        }
        job.status = 'needs_file';
        job.needsLocalFile = true;
        persistMediaMeta();
        setStatusFor(ctx.batchId, 'يلزم إعادة اختيار الملف للمهمة ' + job.clientMediaId.slice(0, 8));
        return;
      }

      if (String(job.mimeType || '').indexOf('video/') === 0) {
        try {
          const dur = await new Promise((resolve) => {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.onloadedmetadata = () => {
              resolve(v.duration || 0);
              URL.revokeObjectURL(v.src);
            };
            v.onerror = () => resolve(0);
            v.src = URL.createObjectURL(job.file);
          });
          if (dur > VIDEO_MAX_SECONDS) {
            job.status = 'failed';
            job.error = 'الفيديو يتجاوز 5 دقائق';
            persistMediaMeta();
            return;
          }
        } catch (_) {}
      }

      job.status = 'uploading';
      persistMediaMeta();
      try {
        await ensureSavedBeforeUpload(ctx, ensureBatchCards(ctx.batchId)[ctx.cardId], job);
        job.status = 'uploading';
        persistMediaMeta();
        const ownerId = await ensureOwnerForUpload(ctx, ensureBatchCards(ctx.batchId)[ctx.cardId], job);
        job.ownerId = ownerId;
        ctx.ownerId = ownerId;
        job.status = 'uploading';
        persistMediaMeta();

        const session = await PartnersApi.uploadViaSession(ctx.ownerKindPath, ownerId, job.file, {
          clientMediaId: job.clientMediaId,
          sessionId: job.sessionId || undefined,
          onSession: (s) => {
            job.sessionId = s && s.sessionId;
            if (s && s.declaredChecksum) job.checksum = s.declaredChecksum;
            persistMediaMeta();
          },
          onProgress: (p) => {
            if (typeof p === 'number' && Number.isFinite(p)) {
              job.uploadPercent = Math.max(0, Math.min(1, p));
              job.status = 'uploading';
              refreshMediaProgress(ctx.batchId);
              setStatusFor(
                ctx.batchId,
                'رفع ' +
                  (job.fileName || ctx.cardId) +
                  ': ' +
                  Math.round(job.uploadPercent * 100) +
                  '% · ' +
                  summarizeBatchMedia(ctx.batchId).ready +
                  '/' +
                  summarizeBatchMedia(ctx.batchId).total +
                  ' مكتمل',
              );
            }
          },
          onProcessing: () => {
            job.status = 'verifying';
            job.uploadPercent = 1;
            job.needsLocalFile = false;
            persistMediaMeta();
            refreshMediaProgress(ctx.batchId);
          },
        });
        job.status = 'ready';
        job.uploadPercent = 1;
        job.mediaId = session && (session.catalogMediaId || session.mediaId || session.id);
        job.file = null;
        job.needsLocalFile = false;
        job.error = null;
        persistMediaMeta();
        refreshMediaProgress(ctx.batchId);
        if (isOpen(ctx.batchId)) renderCards();
      } catch (e) {
        const code = e && e.code;
        const msg = (e && (e.messageAr || e.message)) || String(e);
        if (
          code === 'verify_pending' ||
          code === 'UPLOAD_FINALIZING' ||
          code === 'FINALIZING' ||
          code === 'uploaded' ||
          code === 'verifying'
        ) {
          job.status = 'verifying';
          job.needsLocalFile = false;
          job.error = null;
          setStatusFor(ctx.batchId, 'التحقق مستمر لـ ' + ctx.cardId + ' — بلا إعادة رفع.');
        } else {
          job.status = 'failed';
          job.error = msg;
          setStatusFor(ctx.batchId, 'رفع ' + ctx.cardId + ': ' + msg);
        }
        persistMediaMeta();
        refreshMediaProgress(ctx.batchId);
        if (isOpen(ctx.batchId)) renderCards();
      }
    }

    async function uploadAssignedMedia() {
      if (!openBatch) return;
      const ctx = freezeCtx(openBatch);
      if (typeof PartnersApi.uploadViaSession !== 'function') {
        setStatusFor(ctx.batchId, 'مسار الرفع غير متاح.');
        return;
      }
      // Reconcile restored jobs first
      const all = jobsForBatch(ctx.batchId);
      for (let i = 0; i < all.length; i++) {
        const j = all[i];
        if (j.sessionId && (j.status === 'needs_reconcile' || j.status === 'verifying' || j.status === 'uploading')) {
          try {
            await reconcileJobSession(j);
          } catch (_) {}
        }
      }
      const pending = jobsForBatch(ctx.batchId).filter((j) =>
        [
          'assigned',
          'failed',
          'failed_retryable',
          'needs_file',
          'needs_reconcile',
          'verifying',
          'waiting',
          'saving',
          'creating',
        ].includes(j.status),
      );
      if (!pending.length) {
        const ready = jobsForBatch(ctx.batchId).filter((j) => j.status === 'ready').length;
        setStatusFor(
          ctx.batchId,
          ready ? 'لا مهام معلّقة · جاهز ' + ready : 'لا مهام رفع معلّقة لهذه الدفعة.',
        );
        if (isOpen(ctx.batchId)) renderCards();
        return;
      }
      if (uploadPumpRunning) {
        setStatusFor(ctx.batchId, 'رفع جارٍ (حد ' + MAX_UPLOAD_INFLIGHT + ') — لم تُنشأ مجموعة إضافية.');
        return;
      }
      uploadPumpRunning = true;
      let i = 0;
      await new Promise((resolve) => {
        const pump = () => {
          while (uploadInflight < MAX_UPLOAD_INFLIGHT && i < pending.length) {
            const job = pending[i++];
            if (job.status === 'ready' && job.mediaId) continue;
            uploadInflight++;
            runOneUpload(job).finally(() => {
              uploadInflight--;
              if (i >= pending.length && uploadInflight === 0) {
                uploadPumpRunning = false;
                resolve();
              } else pump();
            });
          }
          if (!pending.length || (i >= pending.length && uploadInflight === 0)) {
            uploadPumpRunning = false;
            resolve();
          }
        };
        pump();
      });
      refreshMediaProgress(ctx.batchId);
      if (isOpen(ctx.batchId)) renderCards();
      const s = summarizeBatchMedia(ctx.batchId);
      setStatusFor(
        ctx.batchId,
        'رفع ' +
          ctx.batchId.slice(0, 8) +
          ': ' +
          s.percent +
          '% · مكتمل ' +
          s.ready +
          '/' +
          s.total +
          ' · متبقّي ' +
          s.remaining +
          (s.verifying ? ' · تحقق ' + s.verifying : '') +
          (s.failed ? ' · فشل ' + s.failed : '') +
          (s.needsFile ? ' · يلزم ملف ' + s.needsFile : ''),
      );
    }

    const uploadBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: 'رفع/استكمال وسائط هذه الدفعة',
      onClick: () => uploadAssignedMedia(),
    });

    const matBtn = el('button', {
      type: 'button',
      className: 'btn btn-primary',
      text: 'حفظ ثم تحويل الدفعة',
      onClick: async () => {
        if (!openBatch) return;
        // Freeze destination BEFORE any await
        const ctx = freezeCtx(openBatch);
        if (!acquireBatchCommitLock(ctx.batchId)) {
          setStatusFor(ctx.batchId, 'تحويل جارٍ فعلًا لهذه الدفعة.');
          return;
        }
        // Snapshot dirty cards now (deep clone values to commit)
        const map = ensureBatchCards(ctx.batchId);
        const snapshots = Object.create(null);
        let abortReason = null;
        for (const cardId of Object.keys(map)) {
          const st = map[cardId];
          if (st.dirty && st.status !== 'materialized') {
            if (cardHasValidationErrors(st)) {
              abortReason = 'قيم غير صالحة في ' + cardId + ' — أوقِف التحويل.';
              break;
            }
            const snap = buildSavePayload(st);
            snap.values = deepCloneJson(snap.values);
            snap.clearFields = (snap.clearFields || []).slice();
            snapshots[cardId] = snap;
          } else if (st.status !== 'materialized' && cardHasValidationErrors(st)) {
            abortReason = 'قيم غير صالحة في ' + cardId + ' — أوقِف التحويل.';
            break;
          }
        }
        if (abortReason) {
          releaseBatchCommitLock(ctx.batchId);
          setStatusFor(ctx.batchId, abortReason);
          if (isOpen(ctx.batchId)) renderCards();
          return;
        }
        if (isOpen(ctx.batchId)) renderCards();
        try {
          setStatusFor(ctx.batchId, 'حفظ دفعة ' + ctx.batchId.slice(0, 8) + '…');
          const saved = await saveDirtyCards(ctx, { snapshots: snapshots });
          if (!saved.ok) {
            setStatusFor(ctx.batchId, 'تعذر التحويل: فشل حفظ ' + saved.failed.length + ' بطاقة.');
            return;
          }
          const afterMap = ensureBatchCards(ctx.batchId);
          for (const cardId of Object.keys(snapshots)) {
            const st = afterMap[cardId];
            if (st.dirty && st.editGen !== st.saveGen) {
              setStatusFor(ctx.batchId, 'توقف التحويل: تعديل أحدث على ' + cardId);
              return;
            }
            if (cardHasValidationErrors(st)) {
              setStatusFor(ctx.batchId, 'توقف التحويل: قيمة غير صالحة على ' + cardId);
              return;
            }
          }
          setStatusFor(ctx.batchId, 'تحويل ' + ctx.batchId.slice(0, 8) + '…');
          const key = 'bulk-ui-' + ctx.batchId;
          const out = await PartnersApi.materializeBulkBatch(
            ctx.batchId,
            { submitReview: true, failedOnly: true },
            key,
          );
          const fresh = await PartnersApi.getBulkBatch(ctx.batchId);
          syncStateFromBatch(fresh, { forceClean: true, keepOpenUntouched: !isOpen(ctx.batchId) });
          if (isOpen(ctx.batchId)) {
            openBatch = fresh;
            renderCards();
          }
          const detail = (out.results || [])
            .filter((r) => !r.ok)
            .map((r) => r.cardId + ':' + ((r.error && (r.error.messageAr || r.error.code)) || 'fail'))
            .join(' · ');
          setStatusFor(
            ctx.batchId,
            'تحويل ' +
              ctx.batchId.slice(0, 8) +
              ': نجح ' +
              out.succeeded +
              ' · تعثر ' +
              out.failed +
              ' · تخطي ' +
              out.skipped +
              (detail ? ' | ' + detail : '') +
              (isDeveloper
                ? ' — حساب المطوّر: التقديم ينشر مباشرة بلا موافقة إدارية.'
                : ' — ليس نشرًا (بانتظار موافقة المحتوى).'),
          );
        } catch (e) {
          setStatusFor(ctx.batchId, (e && (e.messageAr || e.message)) || String(e));
        } finally {
          releaseBatchCommitLock(ctx.batchId);
          if (isOpen(ctx.batchId)) renderCards();
        }
      },
    });

    root.appendChild(status);
    root.appendChild(mediaProgressHost);
    if (registryError) {
      root.appendChild(el('p', { className: 'lead', style: 'color:#b00020', text: 'فشل registry: ' + registryError }));
    }
    root.appendChild(listHost);
    root.appendChild(
      el('div', { className: 'journey-actions' }, [
        el('label', null, ['النوع ', kindSelect]),
        el('label', null, ['القالب ', profileSelect]),
        el('label', null, ['العدد ', countInput]),
        createBtn,
      ]),
    );
    root.appendChild(
      el('p', { className: 'lead' }, [
        'العمليات تُثبّت الدفعة عند البدء. الانتقال لا يحوّل دفعة أخرى. حد الفيديو 5 دقائق.',
      ]),
    );
    root.appendChild(fileInput);
    root.appendChild(
      el('div', { className: 'journey-actions' }, [
        sharedName,
        sharedPrice,
        el('label', null, [overwriteCk, ' استبدال المكتوب']),
        previewBtn,
        applySharedBtn,
        uploadBtn,
        matBtn,
      ]),
    );
    root.appendChild(cardsHost);

    await loadMyBatches();
    const existing = new URLSearchParams(location.search).get('bulk');
    if (existing) {
      try {
        const b = await PartnersApi.getBulkBatch(existing);
        openBatchView(b);
        // reconcile media for this batch on open
        const jobs = jobsForBatch(b.batchId);
        for (let i = 0; i < jobs.length; i++) {
          if (jobs[i].sessionId) {
            try {
              await reconcileJobSession(jobs[i]);
            } catch (_) {}
          }
        }
        if (isOpen(b.batchId)) renderCards();
        setStatusFor(b.batchId, 'استُعيدت ' + b.batchId + ' · وسائط: ' + jobsForBatch(b.batchId).length);
      } catch (e) {
        status.textContent = 'تعذر فتح الدفعة: ' + ((e && (e.messageAr || e.message)) || String(e));
      }
    }
  }

  window.MiraBulkAdd = {
    open: openBulkUi,
    defaultLimit: DEFAULT_LIMIT,
    sarToHalalas: sarToHalalas,
    halalasToSar: halalasToSar,
    freezeCtx: freezeCtx,
    buildSavePayload: buildSavePayload,
    buildVariantsFromColorsSizes: buildVariantsFromColorsSizes,
    buildAvailabilityJsonFromLocal: buildAvailabilityJsonFromLocal,
    cardHasValidationErrors: cardHasValidationErrors,
    deriveScheduleDefaults: deriveScheduleDefaults,
    applyDefaultsOntoWeeklyHours: applyDefaultsOntoWeeklyHours,
    hydrateScheduleUiFields: hydrateScheduleUiFields,
    readWeeklyHours: readWeeklyHours,
    upsertWeeklyHourRow: upsertWeeklyHourRow,
    variantSelectionKey: variantSelectionKey,
    _mediaJobs: mediaJobs,
    _cardsByBatch: cardsByBatch,
    _jobsForBatch: jobsForBatch,
    _jobsForCard: jobsForCard,
    _ensureBatchCards: ensureBatchCards,
    _cardKey: cardKey,
    MEDIA_STORE_KEY: MEDIA_STORE_KEY,
  };
})();
