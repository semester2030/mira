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

  const state = { tab: 'orders' };

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
    card.className = 'card';
    node(card, 'طلب ' + order.publicNumber, 'h3');
    node(card, 'حالة التنفيذ: ' + (ORDER_LABELS[order.fulfillmentStatus] || order.fulfillmentStatus));
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
      button(actions, step[1], async () => {
        statusLine().textContent = 'جارٍ تحديث الطلب';
        try {
          await PartnersApi.commerceOrderTransition(order.id, { fulfillmentStatus: step[0] });
          await load();
        } catch (error) {
          statusLine().textContent = 'تعذر التحديث: ' + error.message;
        }
      });
    });
    const canCollect =
      order.paymentCollectionStatus === 'uncollected' && order.fulfillmentStatus === 'delivered';
    if (canCollect) {
      button(actions, 'تأكيد استلام النقد', async () => {
        statusLine().textContent = 'جارٍ تسجيل التحصيل';
        try {
          await PartnersApi.commerceCollectPayment(order.id, {});
          await load();
        } catch (error) {
          statusLine().textContent = 'تعذر تسجيل التحصيل: ' + error.message;
        }
      });
    }
    card.appendChild(actions);
    return card;
  }

  function bookingCard(booking) {
    const card = document.createElement('article');
    card.className = 'card';
    node(card, 'حجز ' + booking.publicNumber, 'h3');
    node(card, 'الحالة: ' + (BOOKING_LABELS[booking.status] || booking.status));
    node(card, booking.serviceNameAr + ' · ' + booking.durationMin + ' دقيقة · ' + money(booking.priceHalalas) + ' · الدفع في الفرع');
    node(card, 'الموعد: ' + when(booking.startsAt));
    node(card, 'العميلة: ' + booking.contactName + ' · ' + booking.contactPhone);
    if (booking.notes) node(card, 'ملاحظات: ' + booking.notes);

    const actions = document.createElement('div');
    actions.className = 'journey-actions';
    (BOOKING_NEXT[booking.status] || []).forEach((step) => {
      button(actions, step[1], async () => {
        statusLine().textContent = 'جارٍ تحديث الحجز';
        try {
          await PartnersApi.commerceBookingTransition(booking.id, { status: step[0] });
          await load();
        } catch (error) {
          statusLine().textContent = 'تعذر التحديث: ' + error.message;
        }
      });
    });
    card.appendChild(actions);
    return card;
  }

  async function load() {
    const list = document.getElementById('commerceList');
    if (!list) return;
    statusLine().textContent = 'جارٍ التحميل';
    list.replaceChildren();
    try {
      const data = state.tab === 'orders'
        ? await PartnersApi.commerceOrders('limit=30')
        : await PartnersApi.commerceBookings('limit=30');
      const items = data.items || [];
      statusLine().textContent = items.length ? '' : (state.tab === 'orders' ? 'لا طلبات بعد.' : 'لا حجوزات بعد.');
      items.forEach((item) => list.appendChild(state.tab === 'orders' ? orderCard(item) : bookingCard(item)));
      if (data.nextCursor) node(list, 'يوجد المزيد. تظهر هنا آخر ٣٠ فقط.');
    } catch (error) {
      statusLine().textContent = 'تعذر تحميل البيانات: ' + error.message;
    }
  }

  let bound = false;
  function init() {
    if (!bound) {
      bound = true;
      document.getElementById('commerceTabOrders').onclick = () => { state.tab = 'orders'; load(); };
      document.getElementById('commerceTabBookings').onclick = () => { state.tab = 'bookings'; load(); };
      document.getElementById('commerceRefresh').onclick = () => load();
    }
    load();
  }

  window.CommerceOrders = { init: init, load: load };
})();
