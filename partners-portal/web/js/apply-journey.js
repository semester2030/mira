/**
 * Partner apply journey: account type → offers → taxonomy matrix → details → review.
 * Catalog source: PartnersApi.activitiesCatalog() (same Mira taxonomy the portal/app use).
 */
(function (global) {
  'use strict';

  var API = global.PartnersApi;

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'text') node.textContent = props[k];
        else if (k === 'html') node.innerHTML = props[k];
        else if (k === 'className') node.className = props[k];
        else if (k === 'attrs') {
          Object.keys(props.attrs).forEach(function (a) {
            if (props.attrs[a] != null) node.setAttribute(a, props.attrs[a]);
          });
        } else if (k.slice(0, 2) === 'on' && typeof props[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), props[k]);
        } else if (props[k] != null) node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /** Mira-styled placeholder when taxonomy icon is missing — no text burned into art. */
  function placeholderDataUrl(seed, kind) {
    var h = 0;
    String(seed || 'mira').split('').forEach(function (ch) {
      h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    });
    var hues = kind === 'service' ? [320, 300, 280] : [340, 310, 200];
    var a = hues[h % hues.length];
    var b = hues[(h >> 3) % hues.length];
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="hsl(' +
      a +
      ' 70% 78%)"/>' +
      '<stop offset="100%" stop-color="hsl(' +
      b +
      ' 55% 62%)"/>' +
      '</linearGradient></defs>' +
      '<rect width="320" height="320" fill="url(#g)"/>' +
      '<circle cx="160" cy="150" r="54" fill="rgba(255,255,255,0.35)"/>' +
      '<circle cx="160" cy="150" r="28" fill="rgba(255,255,255,0.55)"/>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function iconUrl(item) {
    if (item && item.icon && item.icon.smallUrl) return item.icon.smallUrl;
    if (item && item.icon && item.icon.largeUrl) return item.icon.largeUrl;
    return placeholderDataUrl(item && (item.imageKey || item.id), item && item.kind);
  }

  var state = {
    step: 0,
    accountType: null, // individual | company | celebrity
    sellProducts: false,
    provideServices: false,
    advertiseForOthers: false,
    facilityIdentity: [],
    selected: Object.create(null), // activityId -> true
    expandedGroup: null,
    catalog: { items: [], identityKinds: {}, modes: {} },
    search: '',
    matrixTab: 'product',
    locations: [],
  };

  function showMsg(kind, text) {
    var msg = $('msg');
    if (!msg) return;
    msg.className = 'alert ' + kind;
    msg.textContent = text;
    msg.classList.remove('hidden');
  }

  function hideMsg() {
    var msg = $('msg');
    if (msg) msg.classList.add('hidden');
  }

  function showStep(n) {
    state.step = n;
    document.querySelectorAll('.apply-panel').forEach(function (p) {
      p.classList.toggle('on', Number(p.getAttribute('data-panel')) === n);
    });
    document.querySelectorAll('#stepper .step').forEach(function (s) {
      var i = Number(s.getAttribute('data-s'));
      s.classList.toggle('on', i === n);
      s.classList.toggle('done', i < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function needsMatrix() {
    return state.sellProducts || state.provideServices;
  }

  function identityForSubmit() {
    if (state.accountType === 'individual') return ['independent'];
    if (state.accountType === 'celebrity') {
      var ids = ['creator'];
      if (state.sellProducts) ids.push('brand');
      if (state.provideServices) ids.push('salon');
      return ids;
    }
    // company
    var fac = state.facilityIdentity.slice();
    if (!fac.length) {
      if (state.provideServices && state.sellProducts) fac = ['salon', 'brand'];
      else if (state.provideServices) fac = ['salon'];
      else fac = ['brand'];
    }
    return fac;
  }

  function collectLines() {
    var out = [];
    (state.catalog.items || []).forEach(function (it) {
      if (!state.selected[it.id]) return;
      if (state.sellProducts && state.provideServices) {
        /* keep both */
      } else if (state.sellProducts && it.kind !== 'product') return;
      else if (state.provideServices && it.kind !== 'service') return;
      else if (!state.sellProducts && !state.provideServices) return;
      out.push({ activity: it.id, scope: 'category' });
    });
    return out;
  }

  function selectedSummary() {
    return collectLines()
      .map(function (l) {
        var it = (state.catalog.items || []).find(function (x) {
          return x.id === l.activity;
        });
        return it ? it.label : l.activity;
      })
      .slice(0, 24);
  }

  function groupsForKind(kind) {
    var map = Object.create(null);
    (state.catalog.items || []).forEach(function (it) {
      if (it.kind !== kind) return;
      if (!map[it.group]) map[it.group] = [];
      map[it.group].push(it);
    });
    return Object.keys(map)
      .sort(function (a, b) {
        return a.localeCompare(b, 'ar');
      })
      .map(function (g) {
        return { name: g, items: map[g] };
      });
  }

  function renderAccountType() {
    var box = $('accountTypeGrid');
    if (!box) return;
    box.replaceChildren();
    [
      {
        id: 'individual',
        title: 'فرد',
        blurb: 'تسجّلين باسمك كمختصّة مستقلة.',
        img: placeholderDataUrl('individual', 'service'),
      },
      {
        id: 'company',
        title: 'شركة أو مؤسسة',
        blurb: 'صالون أو متجر أو عيادة تحت اسم المنشأة.',
        img: placeholderDataUrl('company', 'product'),
      },
      {
        id: 'celebrity',
        title: 'مشهور',
        blurb: 'أعلني عن عروض الغير أو عروضك — بدون متجر فارغ إلزامي.',
        img: placeholderDataUrl('celebrity', 'product'),
      },
    ].forEach(function (opt) {
      var card = el(
        'button',
        {
          type: 'button',
          className: 'choice-card' + (state.accountType === opt.id ? ' on' : ''),
          attrs: { 'aria-pressed': state.accountType === opt.id ? 'true' : 'false', 'data-testid': 'account-' + opt.id },
          onClick: function () {
            state.accountType = opt.id;
            if (opt.id !== 'celebrity') state.advertiseForOthers = false;
            renderAccountType();
            $('toOffers').disabled = !state.accountType;
          },
        },
        [
          el('img', { className: 'choice-card__img', src: opt.img, alt: '' }),
          el('div', { className: 'choice-card__body' }, [
            el('span', { className: 'choice-card__check', text: state.accountType === opt.id ? '✓' : '' }),
            el('h2', { text: opt.title }),
            el('p', { text: opt.blurb }),
          ]),
        ],
      );
      box.appendChild(card);
    });
  }

  function renderOffers() {
    var box = $('offersGrid');
    if (!box) return;
    box.replaceChildren();
    var opts = [
      {
        key: 'sellProducts',
        title: 'أبيع منتجات',
        blurb: 'فتح مصفوفة منتجات ميرا لاختيار تخصصاتك.',
        kind: 'product',
      },
      {
        key: 'provideServices',
        title: 'أقدّم خدمات',
        blurb: 'فتح مصفوفة الخدمات القابلة للحجز.',
        kind: 'service',
      },
    ];
    if (state.accountType === 'celebrity') {
      opts.push({
        key: 'advertiseForOthers',
        title: 'أعلن عن منتجات أو خدمات للغير',
        blurb: 'بعد التسجيل تربطين إعلانًا بعرض صاحبه الأصلي — بلا متجر فارغ.',
        kind: 'product',
      });
    }
    opts.forEach(function (opt) {
      var on = !!state[opt.key];
      var card = el(
        'button',
        {
          type: 'button',
          className: 'choice-card choice-card--offer' + (on ? ' on' : ''),
          attrs: { 'aria-pressed': on ? 'true' : 'false', 'data-testid': 'offer-' + opt.key },
          onClick: function () {
            state[opt.key] = !state[opt.key];
            renderOffers();
            updateOffersNext();
          },
        },
        [
          el('img', { className: 'choice-card__img', src: placeholderDataUrl(opt.key, opt.kind), alt: '' }),
          el('div', { className: 'choice-card__body' }, [
            el('span', { className: 'choice-card__check', text: on ? '✓' : '' }),
            el('h2', { text: opt.title }),
            el('p', { text: opt.blurb }),
          ]),
        ],
      );
      box.appendChild(card);
    });
    updateOffersNext();
  }

  function updateOffersNext() {
    var ok =
      state.sellProducts ||
      state.provideServices ||
      (state.accountType === 'celebrity' && state.advertiseForOthers);
    var btn = $('toMatrixOrDetails');
    if (btn) btn.disabled = !ok;
  }

  function renderMatrix() {
    var host = $('matrixHost');
    if (!host) return;
    host.replaceChildren();

    var chips = el('div', { className: 'selected-chips', attrs: { 'data-testid': 'selected-summary' } });
    var labels = selectedSummary();
    chips.appendChild(el('strong', { text: 'المختار: ' + labels.length + ' ' }));
    labels.slice(0, 8).forEach(function (t) {
      chips.appendChild(el('span', { className: 'chip', text: t }));
    });
    if (labels.length > 8) chips.appendChild(el('span', { className: 'chip', text: '…' }));
    host.appendChild(chips);

    var tools = el('div', { className: 'matrix-tools' });
    var search = el('input', {
      type: 'search',
      className: 'matrix-search',
      placeholder: 'بحث داخل المصفوفة…',
      attrs: { value: state.search, 'data-testid': 'matrix-search' },
      onInput: function (e) {
        state.search = e.target.value.trim();
        renderMatrix();
      },
    });
    tools.appendChild(search);

    if (state.sellProducts && state.provideServices) {
      var tabs = el('div', { className: 'matrix-tabs', attrs: { role: 'tablist' } });
      ['product', 'service'].forEach(function (tab) {
        var label = tab === 'product' ? 'منتجاتي' : 'خدماتي';
        tabs.appendChild(
          el(
            'button',
            {
              type: 'button',
              className: 'matrix-tab' + (state.matrixTab === tab ? ' on' : ''),
              attrs: { role: 'tab', 'aria-selected': state.matrixTab === tab ? 'true' : 'false' },
              onClick: function () {
                state.matrixTab = tab;
                state.expandedGroup = null;
                renderMatrix();
              },
            },
            [label],
          ),
        );
      });
      tools.appendChild(tabs);
    }
    host.appendChild(tools);

    var kind =
      state.sellProducts && state.provideServices
        ? state.matrixTab
        : state.sellProducts
          ? 'product'
          : 'service';
    var groups = groupsForKind(kind);
    var q = state.search.toLowerCase();

    var grid = el('div', { className: 'matrix-grid', attrs: { 'data-testid': 'matrix-groups' } });
    groups.forEach(function (g) {
      var filtered = g.items.filter(function (it) {
        if (!q) return true;
        return (
          (it.label || '').toLowerCase().indexOf(q) >= 0 ||
          (it.group || '').toLowerCase().indexOf(q) >= 0 ||
          (it.id || '').toLowerCase().indexOf(q) >= 0
        );
      });
      if (!filtered.length && q) return;
      var selectedInGroup = filtered.some(function (it) {
        return state.selected[it.id];
      });
      var card = el(
        'button',
        {
          type: 'button',
          className: 'matrix-card' + (state.expandedGroup === g.name ? ' expanded' : '') + (selectedInGroup ? ' has-sel' : ''),
          onClick: function () {
            state.expandedGroup = state.expandedGroup === g.name ? null : g.name;
            renderMatrix();
          },
        },
        [
          el('img', {
            className: 'matrix-card__img',
            src: iconUrl(filtered[0] || g.items[0]),
            alt: '',
            loading: 'lazy',
          }),
          el('span', { className: 'matrix-card__check', text: selectedInGroup ? '✓' : '' }),
          el('span', { className: 'matrix-card__label', text: g.name }),
          el('span', { className: 'matrix-card__meta', text: filtered.length + ' نوع' }),
        ],
      );
      grid.appendChild(card);
    });
    host.appendChild(grid);

    if (state.expandedGroup) {
      var group = groups.find(function (g) {
        return g.name === state.expandedGroup;
      });
      if (group) {
        var sub = el('div', { className: 'matrix-subgrid', attrs: { 'data-testid': 'matrix-leaves' } });
        sub.appendChild(el('h3', { text: state.expandedGroup }));
        var leafGrid = el('div', { className: 'matrix-grid matrix-grid--leaves' });
        group.items
          .filter(function (it) {
            if (!q) return true;
            return (it.label || '').toLowerCase().indexOf(q) >= 0;
          })
          .forEach(function (it) {
            var on = !!state.selected[it.id];
            leafGrid.appendChild(
              el(
                'button',
                {
                  type: 'button',
                  className: 'matrix-card matrix-card--leaf' + (on ? ' on' : ''),
                  attrs: { 'data-activity-id': it.id, 'aria-pressed': on ? 'true' : 'false' },
                  onClick: function (e) {
                    e.stopPropagation();
                    state.selected[it.id] = !state.selected[it.id];
                    renderMatrix();
                  },
                },
                [
                  el('img', { className: 'matrix-card__img', src: iconUrl(it), alt: '', loading: 'lazy' }),
                  el('span', { className: 'matrix-card__check', text: on ? '✓' : '' }),
                  el('span', { className: 'matrix-card__label', text: it.label }),
                ],
              ),
            );
          });
        sub.appendChild(leafGrid);

        if (kind === 'service') {
          var modes = el('fieldset', { className: 'modes-box' });
          modes.appendChild(el('legend', { text: 'مكان تقديم الخدمة (للخدمات المختارة)' }));
          var modesRow = el('div', { className: 'opts-inline', attrs: { id: 'modesBox' } });
          Object.keys(state.catalog.modes || {}).forEach(function (k) {
            var lab = el('label', { className: 'check-pill' });
            var inp = el('input', {
              type: 'checkbox',
              value: k,
              name: 'locations',
              onChange: function () {
                state.locations = [...modesRow.querySelectorAll('input:checked')].map(function (i) {
                  return i.value;
                });
              },
            });
            if (state.locations.indexOf(k) >= 0) inp.checked = true;
            lab.appendChild(inp);
            lab.appendChild(document.createTextNode(' ' + state.catalog.modes[k]));
            modesRow.appendChild(lab);
          });
          modes.appendChild(modesRow);
          sub.appendChild(modes);
        }
        host.appendChild(sub);
      }
    }
  }

  function toggleDetailsPanels() {
    document.querySelectorAll('.details-individual').forEach(function (n) {
      n.classList.toggle('hidden', state.accountType !== 'individual');
    });
    document.querySelectorAll('.details-company').forEach(function (n) {
      n.classList.toggle('hidden', state.accountType !== 'company');
    });
    document.querySelectorAll('.details-celebrity').forEach(function (n) {
      n.classList.toggle('hidden', state.accountType !== 'celebrity');
    });
    var facBox = $('facilityIdentityBox');
    if (facBox && state.accountType === 'company') {
      facBox.replaceChildren();
      Object.keys(state.catalog.identityKinds || {}).forEach(function (k) {
        if (k === 'independent' || k === 'creator') return;
        var lab = el('label', { className: 'check-pill' });
        var inp = el('input', {
          type: 'checkbox',
          value: k,
          name: 'facilityIdentity',
          onChange: function () {
            state.facilityIdentity = [...facBox.querySelectorAll('input:checked')].map(function (i) {
              return i.value;
            });
          },
        });
        if (state.facilityIdentity.indexOf(k) >= 0) inp.checked = true;
        lab.appendChild(inp);
        lab.appendChild(document.createTextNode(' ' + state.catalog.identityKinds[k]));
        facBox.appendChild(lab);
      });
    }
  }

  function readLocations() {
    var fromDom = [...document.querySelectorAll('#modesBox input:checked, .modes-box input:checked')].map(function (i) {
      return i.value;
    });
    if (fromDom.length) {
      state.locations = fromDom;
      return fromDom;
    }
    return state.locations.slice();
  }

  function buildReview() {
    var pathLabel =
      state.accountType === 'individual'
        ? 'فرد'
        : state.accountType === 'company'
          ? 'شركة أو مؤسسة'
          : 'مشهور';
    var offers = [];
    if (state.sellProducts) offers.push('أبيع منتجات');
    if (state.provideServices) offers.push('أقدّم خدمات');
    if (state.advertiseForOthers) offers.push('أعلن للغير');
    var labels = selectedSummary();
    $('reviewBox').innerHTML =
      '<p><b>نوع الحساب:</b> ' +
      pathLabel +
      '</p>' +
      '<p><b>النشاط:</b> ' +
      (offers.join(' · ') || '—') +
      '</p>' +
      (labels.length
        ? '<p><b>التصنيفات:</b></p><ul>' + labels.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>'
        : '<p>بدون تصنيفات مملوكة — مناسب لإعلان الغير فقط.</p>') +
      '<p>بعد الإرسال يبقى الطلب قيد مراجعة الإدارة.</p>';
  }

  function goAfterOffers() {
    if (needsMatrix()) {
      if (state.sellProducts && !state.provideServices) state.matrixTab = 'product';
      if (state.provideServices && !state.sellProducts) state.matrixTab = 'service';
      renderMatrix();
      showStep(2);
    } else {
      toggleDetailsPanels();
      showStep(3);
    }
  }

  function validateDetails() {
    var form = $('applyForm');
    if (form.password.value !== form.passwordConfirm.value) throw new Error('كلمتا المرور غير متطابقتين');
    if (!form.password.value || form.password.value.length < 8) throw new Error('كلمة المرور 8 أحرف على الأقل');
    if (state.accountType === 'individual') {
      if (!$('nameAr').value.trim() || !$('nameEn').value.trim()) throw new Error('أدخلي الاسم');
      if (!$('contactEmail').value.trim() || !$('contactPhone').value.trim()) throw new Error('أدخلي الجوال والبريد');
      $('contactName').value = $('nameAr').value.trim();
    } else if (state.accountType === 'company') {
      if (!$('facilityNameAr').value.trim()) throw new Error('أدخلي اسم المنشأة');
      if (!$('facilityEmail').value.trim() || !$('facilityPhone').value.trim()) throw new Error('أدخلي جوال وبريد المنشأة');
      if (!state.facilityIdentity.length) {
        state.facilityIdentity = identityForSubmit().filter(function (k) {
          return k !== 'creator' && k !== 'independent';
        });
      }
    } else {
      if (!$('creatorNameAr').value.trim() || !$('creatorNameEn').value.trim()) throw new Error('أدخلي اسم العرض');
      if (!$('creatorEmail').value.trim() || !$('creatorPhone').value.trim()) throw new Error('أدخلي الجوال والبريد');
      if (!$('creatorBio').value.trim()) throw new Error('أدخلي نبذة قصيرة');
    }
  }

  async function submit() {
    hideMsg();
    showMsg('warn', 'جاري الإرسال...');
    var form = $('applyForm');
    var lines = collectLines();
    var advertiseOnly =
      state.accountType === 'celebrity' && state.advertiseForOthers && !state.sellProducts && !state.provideServices;
    if (!advertiseOnly && !lines.length) {
      showMsg('err', 'اختاري تصنيفًا واحدًا على الأقل من المصفوفة');
      return;
    }
    var locations = readLocations();
    if (state.provideServices && lines.some(function (l) {
      var it = state.catalog.items.find(function (x) { return x.id === l.activity; });
      return it && it.kind === 'service';
    }) && !locations.length) {
      showMsg('err', 'حددي مكان تقديم الخدمة');
      return;
    }

    var identity = identityForSubmit();
    var description =
      state.accountType === 'celebrity'
        ? $('creatorBio').value.trim()
        : ($('actDesc') && $('actDesc').value.trim()) || 'طلب انضمام';

    var payload = {
      password: form.password.value,
      message: form.message.value || undefined,
      activities: {
        identity: identity,
        locations: locations,
        description: description,
        lines: lines,
        advertiseForOthers: !!state.advertiseForOthers,
        sellProducts: !!state.sellProducts,
        provideServices: !!state.provideServices,
      },
      descriptionAr: description,
    };

    if (state.accountType === 'individual') {
      payload.nameAr = $('nameAr').value.trim();
      payload.nameEn = $('nameEn').value.trim();
      payload.contactName = payload.nameAr;
      payload.contactEmail = $('contactEmail').value.trim();
      payload.contactPhone = $('contactPhone').value.trim();
      payload.city = $('city').value.trim() || 'الرياض';
    } else if (state.accountType === 'company') {
      payload.nameAr = $('facilityNameAr').value.trim();
      payload.nameEn = $('facilityNameEn').value.trim() || payload.nameAr;
      payload.contactName = $('facilityContactName').value.trim() || payload.nameAr;
      payload.contactEmail = $('facilityEmail').value.trim();
      payload.contactPhone = $('facilityPhone').value.trim();
      payload.city = $('facilityCity').value.trim() || 'الرياض';
      var storeUrl = $('storeUrl').value.trim();
      if (storeUrl) payload.storeUrl = storeUrl;
      var cr = $('crNumber').value.trim();
      var vat = $('vatNumber').value.trim();
      if (cr) payload.crNumber = cr;
      if (vat) payload.vatNumber = vat;
    } else {
      payload.nameAr = $('creatorNameAr').value.trim();
      payload.nameEn = $('creatorNameEn').value.trim();
      payload.contactName = payload.nameAr;
      payload.contactEmail = $('creatorEmail').value.trim();
      payload.contactPhone = $('creatorPhone').value.trim();
      payload.city = $('creatorCity').value.trim() || 'الرياض';
    }

    try {
      var res = await API.apply(payload);
      showMsg('ok', '');
      $('msg').innerHTML =
        '<p><b>تم استلام طلبك وهو قيد مراجعة الإدارة</b></p>' +
        '<p>رمز التتبع:</p><div class="token-box">' +
        res.statusToken +
        '</div> <a href="status.html?token=' +
        encodeURIComponent(res.statusToken) +
        '">تتبع الحالة</a>';
      form.reset();
      state.accountType = null;
      state.selected = Object.create(null);
      state.sellProducts = state.provideServices = state.advertiseForOthers = false;
      showStep(0);
      renderAccountType();
    } catch (err) {
      showMsg('err', err.messageAr || err.message || 'تعذّر الإرسال');
    }
  }

  function wire() {
    $('toOffers').onclick = function () {
      if (!state.accountType) return;
      renderOffers();
      showStep(1);
    };
    $('backAccount').onclick = function () {
      showStep(0);
    };
    $('toMatrixOrDetails').onclick = function () {
      goAfterOffers();
    };
    $('backOffers').onclick = function () {
      showStep(1);
    };
    $('toDetails').onclick = function () {
      if (needsMatrix() && !collectLines().length && !(state.advertiseForOthers && !state.sellProducts && !state.provideServices)) {
        showMsg('err', 'اختاري نوعًا واحدًا على الأقل');
        return;
      }
      if (needsMatrix() && !(($('actDesc') && $('actDesc').value.trim()) || '').length) {
        showMsg('err', 'اكتبي وصفًا مختصرًا لنشاطك');
        return;
      }
      hideMsg();
      toggleDetailsPanels();
      showStep(3);
    };
    $('backMatrixOrOffers').onclick = function () {
      if (needsMatrix()) showStep(2);
      else showStep(1);
    };
    $('toReview').onclick = function () {
      try {
        validateDetails();
        hideMsg();
        buildReview();
        showStep(4);
      } catch (e) {
        showMsg('err', e.message);
      }
    };
    $('backDetails').onclick = function () {
      showStep(3);
    };
    $('applyForm').addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
  }

  function iconStats() {
    var items = state.catalog.items || [];
    var withIcon = items.filter(function (i) {
      return i.icon && (i.icon.smallUrl || i.icon.largeUrl);
    }).length;
    return { total: items.length, withIcon: withIcon, missing: items.length - withIcon };
  }

  function boot() {
    wire();
    renderAccountType();
    showStep(0);
    API.activitiesCatalog()
      .then(function (data) {
        state.catalog = data || { items: [], identityKinds: {}, modes: {} };
        var st = iconStats();
        var hint = $('catalogHint');
        if (hint) {
          hint.textContent =
            'سجل ميرا: ' +
            st.total +
            ' نوعًا — صور عاملة: ' +
            st.withIcon +
            (st.missing ? ' — بلا صورة مخزّنة: ' + st.missing + ' (تُعرض بخلفية ميرا الموحّدة)' : '');
        }
        global.__MIRA_APPLY_ICON_STATS__ = st;
      })
      .catch(function (err) {
        showMsg('err', 'تعذّر تحميل سجل التصنيفات: ' + (err.messageAr || err.message));
      });
  }

  global.MiraApplyJourney = {
    boot: boot,
    state: state,
    placeholderDataUrl: placeholderDataUrl,
    iconUrl: iconUrl,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
