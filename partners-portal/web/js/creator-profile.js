/**
 * حساب المشهور — register/upsert on the logged-in partner; no duplicate profiles.
 */
(function (global) {
  'use strict';

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'text') node.textContent = props[k];
        else if (k === 'html') node.innerHTML = props[k];
        else if (k === 'className') node.className = props[k];
        else if (k.slice(0, 2) === 'on' && typeof props[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), props[k]);
        else if (props[k] != null) node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function apiBase() {
    if (window.PartnersApi && typeof PartnersApi.resolveUrl === 'function') {
      try {
        return PartnersApi.resolveUrl('');
      } catch (_) {}
    }
    return '';
  }

  async function loadCreatorProfile() {
    var body = document.getElementById('creatorProfileBody');
    if (!body) return;
    body.replaceChildren(el('p', { text: 'جارٍ التحميل…' }));
    if (!window.PartnersApi || typeof PartnersApi.creatorProfile !== 'function') {
      body.replaceChildren(el('p', { text: 'واجهة الحساب غير متاحة في هذه المحاكاة.' }));
      return;
    }
    try {
      var res = await PartnersApi.creatorProfile();
      if (res && res.registered && res.profile) renderRegistered(body, res.profile);
      else renderRegisterForm(body, null);
    } catch (error) {
      body.replaceChildren(
        el('p', { text: error.message || 'تعذر تحميل الملف' }),
        el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: 'إعادة المحاولة',
          onClick: function () {
            loadCreatorProfile();
          },
        }),
      );
    }
  }

  function renderRegisterForm(body, existing) {
    body.replaceChildren();
    var status = el('p', {
      text: existing
        ? 'عدّلي ملفك العام. الحفظ لا ينشئ مشهورًا مكررًا.'
        : 'التسجيل كمشهور يربط الملف بحسابك الحالي. يمكنك الإعلان عن عروض الغير دون متجر.',
    });
    var name = el('input', { name: 'displayNameAr', value: (existing && existing.displayNameAr) || '' });
    var bio = el('textarea', { name: 'bioAr' });
    bio.value = (existing && existing.bioAr) || '';
    var publicActive = el('input', { type: 'checkbox', name: 'publicActive' });
    publicActive.checked = !existing || existing.publicActive !== false;
    var avatarInput = el('input', { type: 'file', accept: 'image/*' });
    var save = el('button', { type: 'button', className: 'btn btn-primary', text: existing ? 'حفظ التعديلات' : 'التسجيل كمشهور' });
    body.append(
      status,
      el('div', null, [el('label', { text: 'اسم العرض' }), name]),
      el('div', null, [el('label', { text: 'نبذة قصيرة' }), bio]),
      el('div', null, [el('label', { text: 'صورة الملف' }), avatarInput]),
      el('div', null, [el('label', { text: 'ظاهر في الدليل العام' }), publicActive]),
      save,
    );
    save.onclick = async function () {
      if (save.dataset.busy === '1') return;
      save.dataset.busy = '1';
      save.disabled = true;
      try {
        var profile = await PartnersApi.upsertCreatorProfile({
          displayNameAr: name.value.trim(),
          bioAr: bio.value.trim(),
          publicActive: publicActive.checked,
        });
        if (avatarInput.files && avatarInput.files[0]) {
          var file = avatarInput.files[0];
          var b64 = await fileToBase64(file);
          profile = await PartnersApi.setCreatorAvatar(file.type || 'image/jpeg', b64);
        }
        status.textContent = 'حُفظ الملف.';
        renderRegistered(body, profile);
        if (typeof load === 'function') load();
      } catch (error) {
        status.textContent = error.message || 'تعذر الحفظ';
        save.disabled = false;
        save.dataset.busy = '';
      }
    };
  }

  function renderRegistered(body, profile) {
    body.replaceChildren();
    var preview = profile.previewAsCustomer || profile;
    var avatarUrl = preview.avatarUrl ? apiBase().replace(/\/$/, '') + preview.avatarUrl : null;
    var head = el('div', { className: 'creator-preview' });
    if (avatarUrl) {
      head.appendChild(el('img', { src: avatarUrl, alt: preview.displayNameAr || '', width: '96', height: '96', style: 'border-radius:50%;object-fit:cover' }));
    }
    head.appendChild(el('h3', { text: preview.displayNameAr || profile.displayNameAr || '' }));
    if (preview.bioAr || profile.bioAr) head.appendChild(el('p', { text: preview.bioAr || profile.bioAr }));
    head.appendChild(el('p', { text: 'معاينة كما تراها العميلة في الدليل.' }));
    var actions = el('div', { className: 'ad-actions' });
    var publicPage = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', text: 'صفحتي العامة' });
    var edit = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', text: 'تعديل ملفي' });
    var myAds = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', text: 'إعلاناتي' });
    var addAd = el('button', { type: 'button', className: 'btn btn-primary btn-sm', text: 'إضافة إعلان' });
    actions.append(publicPage, edit, myAds, addAd);
    body.append(head, actions);
    publicPage.onclick = function () {
      if (window.PortalShell && typeof PortalShell.navigate === 'function') PortalShell.navigate('creator', 'list');
      alert('صفحتك العامة تظهر في تطبيق ميرا تحت المشاهير باسم: ' + (profile.displayNameAr || ''));
    };
    edit.onclick = function () {
      renderRegisterForm(body, profile);
    };
    myAds.onclick = function () {
      if (window.PortalShell && typeof PortalShell.navigate === 'function') PortalShell.navigate('ads', 'list');
      else location.hash = '#/ads';
    };
    addAd.onclick = function () {
      if (window.PortalShell && typeof PortalShell.navigate === 'function') PortalShell.navigate('ads', 'list');
      else location.hash = '#/ads';
      setTimeout(function () {
        if (typeof renderAdForm === 'function') renderAdForm(null);
        var form = document.getElementById('adsForm');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };
  }

  global.loadCreatorProfile = loadCreatorProfile;
  global.renderCreatorProfile = loadCreatorProfile;
})(window);
