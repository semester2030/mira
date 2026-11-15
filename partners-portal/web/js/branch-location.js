(function () {
  /** Subset of mira-api/src/geo/saudi-cities.json — provider must pick explicitly. */
  var SAUDI_CITIES = [
    { id: 'sa-riyadh', nameAr: 'الرياض' },
    { id: 'sa-jeddah', nameAr: 'جدة' },
    { id: 'sa-makkah', nameAr: 'مكة المكرمة' },
    { id: 'sa-madinah', nameAr: 'المدينة المنورة' },
    { id: 'sa-dammam', nameAr: 'الدمام' },
    { id: 'sa-khobar', nameAr: 'الخبر' },
    { id: 'sa-taif', nameAr: 'الطائف' },
    { id: 'sa-tabuk', nameAr: 'تبوك' },
    { id: 'sa-abha', nameAr: 'أبها' },
    { id: 'sa-khamis', nameAr: 'خميس مشيط' },
    { id: 'sa-najran', nameAr: 'نجران' },
    { id: 'sa-jazan', nameAr: 'جازان' },
    { id: 'sa-hail', nameAr: 'حائل' },
    { id: 'sa-buraidah', nameAr: 'بريدة' },
    { id: 'sa-jubail', nameAr: 'الجبيل' },
    { id: 'sa-yanbu', nameAr: 'ينبع' },
    { id: 'sa-qatif', nameAr: 'القطيف' },
    { id: 'sa-kharj', nameAr: 'الخرج' },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function status(msg, isErr) {
    const el = $('branchLocationStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  function parseCoord(raw, kind) {
    const n = Number(String(raw || '').trim().replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    if (kind === 'lat' && (n < -90 || n > 90)) return null;
    if (kind === 'lng' && (n < -180 || n > 180)) return null;
    if (n === 0) return null;
    return n;
  }

  function mapUrl(lat, lng) {
    return 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng);
  }

  function isIndependent() {
    return !!(
      window.sessionActivities &&
      window.sessionActivities.providerKind === 'independent'
    );
  }

  function suggestCityIdFromPartner() {
    const partner = window.sessionPartner || {};
    const city = String(partner.city || '').trim();
    if (!city) return '';
    const lower = city.toLowerCase();
    for (var i = 0; i < SAUDI_CITIES.length; i++) {
      var c = SAUDI_CITIES[i];
      if (city.indexOf(c.nameAr) >= 0) return c.id;
    }
    if (lower.indexOf('jeddah') >= 0) return 'sa-jeddah';
    if (lower.indexOf('makkah') >= 0 || lower.indexOf('mecca') >= 0) return 'sa-makkah';
    if (lower.indexOf('madinah') >= 0 || lower.indexOf('medina') >= 0) return 'sa-madinah';
    if (lower.indexOf('dammam') >= 0) return 'sa-dammam';
    if (lower.indexOf('riyadh') >= 0) return 'sa-riyadh';
    return '';
  }

  function fillCitySelect(preferredId) {
    const sel = $('branchCityId');
    if (!sel) return;
    const current = preferredId || sel.value || suggestCityIdFromPartner();
    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'اختاري مدينة المقر';
    sel.appendChild(placeholder);
    SAUDI_CITIES.forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nameAr;
      if (c.id === current) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function selectedCityId() {
    const sel = $('branchCityId');
    return sel && sel.value ? String(sel.value).trim() : '';
  }

  function fillSelect(branches) {
    const sel = $('branchSelect');
    if (!sel) return;
    sel.innerHTML = '';
    (branches || []).forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = (b.nameAr || b.id) + (b.cityNameAr ? ' · ' + b.cityNameAr : '');
      opt.dataset.lat = b.lat != null ? String(b.lat) : '';
      opt.dataset.lng = b.lng != null ? String(b.lng) : '';
      opt.dataset.name = b.nameAr || '';
      opt.dataset.cityId = b.cityId || '';
      sel.appendChild(opt);
    });
    if (!branches || !branches.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = isIndependent()
        ? 'لا مقر بعد — أدخلي الاسم والمدينة والإحداثيات واحفظي'
        : 'لا يوجد فرع — أضيفي المدينة والإحداثيات واحفظي للإنشاء';
      sel.appendChild(opt);
    }
    onSelectChange();
    const createHint = $('branchCreateHint');
    if (createHint) {
      createHint.classList.toggle('hidden', !!(branches && branches.length));
    }
  }

  function renderList(branches) {
    const host = $('branchesList');
    if (!host) return;
    if (!branches || !branches.length) {
      host.innerHTML = isIndependent()
        ? '<p class="lead">ابدئي بمقر استقبال واحد: اختاري المدينة، التقطي الموقع أو الصقي الإحداثيات ثم احفظي.</p>'
        : '<p class="lead">ما عندك فروع نشطة بعد.</p>';
      return;
    }
    host.innerHTML = branches
      .map((b) => {
        const coords =
          Number.isFinite(b.lat) && Number.isFinite(b.lng) && !(b.lat === 0 && b.lng === 0)
            ? b.lat + ', ' + b.lng
            : 'بلا إحداثيات دقيقة';
        const link =
          Number.isFinite(b.lat) && Number.isFinite(b.lng) && !(b.lat === 0 && b.lng === 0)
            ? '<a href="' + mapUrl(b.lat, b.lng) + '" target="_blank" rel="noopener">خريطة</a>'
            : '';
        return (
          '<div class="branch-row" style="padding:0.4rem 0;border-bottom:1px solid rgba(0,0,0,.08)">' +
          '<strong>' +
          (b.nameAr || b.id) +
          '</strong> · ' +
          (b.cityNameAr || '') +
          '<br/><span class="muted">' +
          coords +
          '</span> ' +
          link +
          '</div>'
        );
      })
      .join('');
  }

  function onSelectChange() {
    const sel = $('branchSelect');
    if (!sel || !sel.selectedOptions.length) return;
    const opt = sel.selectedOptions[0];
    if (opt && opt.value) {
      $('branchNameAr').value = opt.dataset.name || '';
      $('branchLat').value = opt.dataset.lat || '';
      $('branchLng').value = opt.dataset.lng || '';
      fillCitySelect(opt.dataset.cityId || suggestCityIdFromPartner());
    } else {
      if (!$('branchNameAr').value) {
        $('branchNameAr').value = isIndependent() ? 'مقر الاستقبال' : 'الفرع الرئيسي';
      }
      fillCitySelect(suggestCityIdFromPartner());
    }
    updatePreview();
  }

  function updatePreview() {
    const lat = parseCoord($('branchLat').value, 'lat');
    const lng = parseCoord($('branchLng').value, 'lng');
    const a = $('branchMapPreview');
    if (!a) return;
    if (lat == null || lng == null) {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', 'true');
      return;
    }
    a.href = mapUrl(lat, lng);
    a.removeAttribute('aria-disabled');
  }

  function useMyLocation() {
    status('جارٍ قراءة موقع الجهاز…');
    if (!navigator.geolocation) {
      status('المتصفح لا يدعم الموقع. الصق الإحداثيات يدويًا.', true);
      return;
    }
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      status('يتطلب الموقع اتصال HTTPS (أو localhost).', true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        $('branchLat').value = String(pos.coords.latitude);
        $('branchLng').value = String(pos.coords.longitude);
        updatePreview();
        status('تم التقاط الموقع. راجعي المدينة على الخريطة ثم احفظي.');
      },
      (err) => {
        status(err && err.message ? err.message : 'رُفض إذن الموقع أو تعذّر القراءة.', true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    const lat = parseCoord($('branchLat').value, 'lat');
    const lng = parseCoord($('branchLng').value, 'lng');
    if (lat == null || lng == null) {
      status('أدخل إحداثيات صالحة (وليست 0,0).', true);
      return;
    }
    const cityId = selectedCityId();
    if (!cityId) {
      status('اختاري مدينة المقر قبل الحفظ — لا يُفترض الرياض تلقائيًا.', true);
      return;
    }
    const nameAr = String($('branchNameAr').value || '').trim() || (isIndependent() ? 'مقر الاستقبال' : 'الفرع');
    const id = $('branchSelect').value;
    status(id ? 'جارٍ الحفظ…' : 'جارٍ إنشاء المقر…');
    try {
      let saved;
      if (!id) {
        saved = await PartnersApi.createBranch({
          nameAr,
          cityId,
          lat,
          lng,
        });
      } else {
        saved = await PartnersApi.updateBranch(id, {
          nameAr: nameAr || undefined,
          cityId,
          lat,
          lng,
        });
      }
      const branches = Array.isArray(window.sessionBranches) ? window.sessionBranches.slice() : [];
      const ix = branches.findIndex((b) => b.id === saved.id);
      if (ix >= 0) branches[ix] = Object.assign({}, branches[ix], saved);
      else branches.push(saved);
      window.sessionBranches = branches;
      renderList(branches);
      fillSelect(branches);
      $('branchSelect').value = saved.id;
      onSelectChange();
      status((id ? 'حُفظ موقع ' : 'أُنشئ مقر ') + (saved.nameAr || saved.id) + (saved.cityNameAr ? ' · ' + saved.cityNameAr : ''));
    } catch (err) {
      status((err && (err.messageAr || err.message)) || 'تعذّر الحفظ', true);
    }
  }

  window.MiraBranchLocation = {
    refresh(branches) {
      const list = Array.isArray(branches) ? branches : window.sessionBranches || [];
      fillCitySelect(suggestCityIdFromPartner());
      renderList(list);
      fillSelect(list);
      const section = $('branchesSection');
      if (section) {
        section.classList.remove('hidden');
        const lead = section.querySelector('[data-venue-lead]');
        if (lead) {
          lead.textContent = isIndependent()
            ? 'مقرّ تقديم الخدمة (استوديو/منزل الاستقبال) — موقع واحد فقط'
            : 'مواقع الفروع';
        }
      }
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('branchLocationForm');
    if (!form) return;
    fillCitySelect(suggestCityIdFromPartner());
    form.addEventListener('submit', onSubmit);
    $('branchSelect')?.addEventListener('change', onSelectChange);
    $('branchLat')?.addEventListener('input', updatePreview);
    $('branchLng')?.addEventListener('input', updatePreview);
    $('branchUseMyLocation')?.addEventListener('click', useMyLocation);
  });
})();
