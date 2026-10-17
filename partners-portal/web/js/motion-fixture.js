(function () {
  if (new URLSearchParams(location.search).get('motion-fixture') !== '1') return;

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  const calls = { create: 0, media: 0, booking: 0 };
  let bookings = [{
    id: 'b1',
    publicNumber: 'B-100',
    status: 'requested',
    serviceNameAr: 'جلسة اختبار',
    durationMin: 30,
    priceHalalas: 15000,
    startsAt: '2026-10-20T10:00:00.000Z',
    contactName: 'مستخدمة اختبار',
    contactPhone: '0500000000',
    notes: '',
  }];

  const api = window.PartnersApi;
  window.PartnersApi = Object.assign({}, api, {
    isLoggedIn: () => true,
    dashboard: async () => {
      await delay(450);
      if (sessionStorage.getItem('mira-motion-dashboard') === 'fail') throw new Error('انقطع الاتصال');
      return {
        partner: {
          type: 'clinic',
          nameAr: 'عيادة الاختبار',
          city: 'الرياض',
          logoEmoji: '',
          contactPhone: '0110000000',
        },
        analytics30d: { impressions: 12, clicks: null, bookingRequests: 1 },
        catalog: { productCount: 0, serviceCount: 0, products: [], services: [] },
      };
    },
    ads: async () => ({ items: [] }),
    commerceOrders: async () => ({ items: [] }),
    commerceBookings: async () => {
      await delay(200);
      return { items: bookings.map((row) => Object.assign({}, row)) };
    },
    commerceBookingTransition: async (id, body) => {
      calls.booking += 1;
      await delay(180);
      if (sessionStorage.getItem('mira-motion-booking') === 'fail') throw new Error('الوقت غير متاح');
      const row = bookings.find((item) => item.id === id);
      if (!row) throw new Error('الحجز غير موجود');
      row.status = body.status;
      return Object.assign({}, row);
    },
    createService: async (payload) => {
      calls.create += 1;
      await delay(350);
      if (String(payload.nameAr).indexOf('فشل') >= 0) throw new Error('تعذر الحفظ من الخادم');
      return Object.assign({ id: 'svc-test', contentStatus: 'draft', reviewStatus: 'draft', nameAr: payload.nameAr }, payload);
    },
    updateService: async (id, payload) => Object.assign({ id: id }, payload),
    preview: async () => ({ media: [] }),
    addMediaProgress: (kind, id, mimeType, dataBase64, hooks) => {
      calls.media += 1;
      return new Promise((resolve, reject) => {
        let ratio = 0;
        const timer = window.setInterval(() => {
          if (hooks && hooks.signal && hooks.signal.aborted) {
            window.clearInterval(timer);
            reject(Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' }));
            return;
          }
          ratio += 0.4;
          if (ratio < 1) {
            if (hooks && hooks.onProgress) hooks.onProgress(ratio);
            return;
          }
          window.clearInterval(timer);
          if (hooks && hooks.onProcessing) hooks.onProcessing();
          window.setTimeout(() => {
            if (sessionStorage.getItem('mira-motion-upload') === 'fail') reject(new Error('رفض الخادم الملف'));
            else resolve({ id: 'media-test' });
          }, 160);
        }, 70);
      });
    },
  });
  window.MiraMotionFixture = { calls: calls };
})();
