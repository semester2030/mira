(function () {
  // Partner view of in-Mira COD orders and service booking requests.
  // The server enforces ownership and the state machine; buttons only offer legal next steps.

  const ORDER_LABELS = {
    new: 'جديد',
    accepted: 'مقبول',
    preparing: 'قيد التجهيز',
    out_for_delivery: 'في الطريق',
    delivered: 'تم التسليم',
    rejected: 'مرفوض',
    cancelled: 'ملغي',
    failed_delivery: 'تعذر التسليم',
  };
  const PAYMENT_LABELS = { uncollected: 'لم يُحصَّل', collected: 'حُصِّل نقدًا', waived: 'أُعفي' };
  const BOOKING_LABELS = {
    requested: 'طلب موعد (غير مؤكد)',
    confirmed: 'موعد مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    rejected: 'مرفوض',
  };

  // Mirrors FULFILLMENT_TRANSITIONS / BOOKING_TRANSITIONS for the partner actor.
  const ORDER_NEXT = {
    new: [['accepted', 'قبول'], ['rejected', 'رفض']],
    accepted: [['preparing', 'بدء التجهيز'], ['cancelled', 'إلغاء']],
    preparing: [['out_for_delivery', 'خرج للتوصيل'], ['cancelled', 'إلغاء']],
    out_for_delivery: [['delivered', 'تم التسليم'], ['failed_delivery', 'تعذر التسليم']],
    failed_delivery: [['out_for_delivery', 'إعادة التوصيل'], ['cancelled', 'إلغاء']],
  };
  const BOOKING_NEXT = {
    requested: [['confirmed', 'تأكيد الموعد'], ['rejected', 'رفض']],
    confirmed: [['completed', 'اكتمل'], ['cancelled', 'إلغاء']],
  };

  const state = { tab: 'orders', items: [], changedId: '' };

  function money(halalas) {
    if (halalas == null) return 'غير محددة';
    const riyals = halalas / 100;
    return (Number.isInteger(riyals) ? String(riyals) : riyals.toFixed(2)) + ' ر.س';
  }

  function when(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function node(parent, value, tag) {
    const el = document.createElement(tag || 'p');
    el.textContent = value == null ? '' : String(value);
    parent.appendChild(el);
    return el;
  }

  function button(parent, label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost';
    b.textContent = label;
    b.onclick = onClick;
    parent.appendChild(b);
    return b;
  }

  function statusLine() {
    return document.getElementById('commerceStatus');
  }

  function selectionText(selections) {
    if (!Array.isArray(selections) || !selections.length) return '';
    return ' (' + selections.map((s) => s.groupLabelAr + ': ' + s.valueLabelAr).join('، ') + ')';
  }

  function orderCard(order) {
    const card = document.createElement('article');
    card.className = 'card commerce-card';
    card.dataset.id = order.id;
    if (state.changedId === order.id) card.classList.add('status-changed');
    node(card, 'طلب ' + order.publicNumber, 'h3');
    const orderState = node(card, 'حالة التنفيذ: ' + (ORDER_LABELS[order.fulfillmentStatus] || order.fulfillmentStatus));
    orderState.dataset.state = 'fulfillment';
    node(card, 'تحصيل الدفع: ' + (PAYMENT_LABELS[order.paymentCollectionStatus] || order.paymentCollectionStatus) + ' · الدفع عند الاستلام');
    node(card, 'العميلة: ' + order.contactName + ' · ' + order.contactPhone);
    node(card, 'العنوان: ' + order.city + ' · ' + order.addressLine);
    if (order.notes) node(card, 'ملاحظات: ' + order.notes);
    (order.items || []).forEach((item) => {
      node(card, item.productNameAr + selectionText(item.selections) + ' × ' + item.quantity + ' = ' + money(item.lineTotalHalalas));
    });
    node(card, 'المجموع: ' + money(order.subtotalHalalas) + ' + توصيل ' + money(order.deliveryFeeHalalas) + ' = ' + money(order.totalHalalas));
    node(card, 'أُنشئ: ' + when(order.createdAt));

    const actions = document.createElement('div');
    actions.className = 'journey-actions';
    (ORDER_NEXT[order.fulfillmentStatus] || []).forEach((step) => {
      button(actions, step[1], () => transition('order', order, { fulfillmentStatus: step[0] }, step[1]));
    });
    const canCollect =
      order.paymentCollectionStatus === 'uncollected' && order.fulfillmentStatus === 'delivered';
    if (canCollect) {
      button(actions, 'تأكيد استلام النقد', () => transition('payment', order, {}, 'تأكيد استلام النقد'));
    }
    card.appendChild(actions);
    return card;
  }

  function bookingCard(booking) {
    const card = document.createElement('article');
    card.className = 'card commerce-card';
    card.dataset.id = booking.id;
    if (state.changedId === booking.id) card.classList.add('status-changed');
    node(card, 'حجز ' + booking.publicNumber, 'h3');
    const bookingState = node(card, 'الحالة: ' + (BOOKING_LABELS[booking.status] || booking.status));
    bookingState.dataset.state = 'booking';
    node(card, booking.serviceNameAr + ' · ' + booking.durationMin + ' دقيقة · ' + money(booking.priceHalalas) + ' · الدفع في الفرع');
    node(card, 'الموعد: ' + when(booking.startsAt));
    node(card, 'العميلة: ' + booking.contactName + ' · ' + booking.contactPhone);
    if (booking.notes) node(card, 'ملاحظات: ' + booking.notes);

    const actions = document.createElement('div');
    actions.className = 'journey-actions';
    (BOOKING_NEXT[booking.status] || []).forEach((step) => {
      button(actions, step[1], () => transition('booking', booking, { status: step[0] }, step[1]));
    });
    card.appendChild(actions);
    return card;
  }

  function summary(items) {
    const labels = state.tab === 'orders' ? ORDER_LABELS : BOOKING_LABELS;
    const field = state.tab === 'orders' ? 'fulfillmentStatus' : 'status';
    const counts = {};
    items.forEach((item) => {
      const key = item[field] || '';
      counts[key] = (counts[key] || 0) + 1;
    });
    const parts = Object.keys(counts).map((key) => (labels[key] || key) + ': ' + counts[key]);
    return items.length + ' في هذه الصفحة' + (parts.length ? ' · ' + parts.join(' · ') : '');
  }

  function paint(items, extra) {
    const list = document.getElementById('commerceList');
    state.items = items;
    list.removeAttribute('aria-busy');
    list.replaceChildren();
    if (!items.length) {
      statusLine().textContent = state.tab === 'orders' ? 'لا طلبات بعد.' : 'لا حجوزات بعد.';
      return;
    }
    statusLine().textContent = summary(items) + (extra ? ' ' + extra : '');
    items.forEach((item) => list.appendChild(state.tab === 'orders' ? orderCard(item) : bookingCard(item)));
    if (window.MiraMotion) MiraMotion.announce(statusLine().textContent);
  }

  function showLoadFailure(error) {
    const list = document.getElementById('commerceList');
    list.removeAttribute('aria-busy');
    list.replaceChildren();
    statusLine().textContent = 'تعذر تحميل البيانات: ' + error.message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-primary';
    retry.textContent = 'إعادة المحاولة';
    retry.onclick = () => load();
    list.appendChild(retry);
    retry.focus();
  }

  async function transition(kind, current, body, label) {
    const line = statusLine();
    line.textContent = 'جارٍ تحديث ' + (kind === 'booking' ? 'الحجز' : 'الطلب');
    const buttons = document.querySelectorAll('[data-id="' + current.id + '"] button');
    buttons.forEach((node) => {
      node.disabled = true;
      node.setAttribute('aria-busy', 'true');
    });
    try {
      const result = kind === 'booking'
        ? await PartnersApi.commerceBookingTransition(current.id, body)
        : kind === 'payment'
          ? await PartnersApi.commerceCollectPayment(current.id, body)
          : await PartnersApi.commerceOrderTransition(current.id, body);
      const confirmed = result && result.id && (kind === 'booking' ? result.status : (result.fulfillmentStatus || result.paymentCollectionStatus));
      if (!confirmed) throw new Error('لم يعد الخادم حالة مؤكدة');
      state.changedId = result.id;
      const merged = state.items.slice();
      const index = merged.findIndex((item) => item.id === result.id);
      if (index >= 0) merged[index] = Object.assign({}, merged[index], result);
      paint(merged);
      try {
        await load({ keepChanged: true });
      } catch (refreshError) {
        paint(merged, 'تعذر تحديث القائمة كاملة. الحالة المعروضة هي نتيجة الخادم.');
      }
    } catch (error) {
      buttons.forEach((node) => {
        node.disabled = false;
        node.removeAttribute('aria-busy');
      });
      const active = Array.from(buttons).find((node) => node.textContent === label);
      if (active) {
        active.disabled = false;
        active.focus();
      }
      line.textContent = 'بقيت الحالة السابقة. ' + error.message;
      if (window.MiraMotion) MiraMotion.announce(line.textContent);
    }
  }

  async function load(options) {
    const list = document.getElementById('commerceList');
    if (!list) return;
    const keepCards = Boolean(options && options.keepChanged);
      if (!keepCards) {
      statusLine().textContent = 'جارٍ التحميل';
      list.setAttribute('aria-busy', 'true');
      if ((options && options.replace) || !list.querySelector('.commerce-card')) {
        if (window.MiraMotion) MiraMotion.fillSkeletons(list, 'booking', 2);
      }
    }
    const ordersTab = document.getElementById('commerceTabOrders');
    const bookingsTab = document.getElementById('commerceTabBookings');
    if (ordersTab) ordersTab.setAttribute('aria-pressed', state.tab === 'orders' ? 'true' : 'false');
    if (bookingsTab) bookingsTab.setAttribute('aria-pressed', state.tab === 'bookings' ? 'true' : 'false');
    try {
      const data = state.tab === 'orders'
        ? await PartnersApi.commerceOrders('limit=30')
        : await PartnersApi.commerceBookings('limit=30');
      const items = (data.items || []).slice();
      if (state.changedId) {
        const local = state.items.find((item) => item.id === state.changedId);
        const index = items.findIndex((item) => item.id === state.changedId);
        if (local && index >= 0) items[index] = Object.assign({}, items[index], local);
      }
      paint(items);
      if (data.nextCursor) node(list, 'يوجد المزيد. تظهر هنا آخر ٣٠ فقط.');
      state.changedId = '';
    } catch (error) {
      if (keepCards) throw error;
      showLoadFailure(error);
    }
  }

  let bound = false;
  function init() {
    if (!bound) {
      bound = true;
      document.getElementById('commerceTabOrders').onclick = () => { state.tab = 'orders'; state.changedId = ''; load({ replace: true }); };
      document.getElementById('commerceTabBookings').onclick = () => { state.tab = 'bookings'; state.changedId = ''; load({ replace: true }); };
      document.getElementById('commerceRefresh').onclick = () => load();
    }
    load();
  }

  window.CommerceOrders = { init: init, load: load };
})();
