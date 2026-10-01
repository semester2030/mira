/// Marketplace / partners copy — single source for coming-soon messaging.
abstract final class MarketplaceCopy {
  MarketplaceCopy._();

  static const hubTitle = 'اكتشفي';
  static const comingSoonHeadline = 'الانطلاق قريباً ✨';
  static const comingSoonLead =
      'نجهّز لكِ منتجات التجميل، صالونات العناية، وعيادات التجميل المختارة — '
      'تُفعَّل تلقائياً عندما يكبر مجتمع ميرا.';
  static const comingSoonFocus =
      'ركّزي الآن على تحليل بشرتك وإطلالتك — شركاؤنا يأتون قريباً.';
  static const dashboardTeaser = 'ماركات · صالونات · عيادات — قريباً';
  static const sectionTeaser = 'شركاء ميرا — الانطلاق قريباً';
  static const testBuildNotice =
      'نسخة اختبار اكتشفي. الإغلاق يبقى الافتراضي في بناء الإنتاج.';
  static const serverUnmarkedBanner =
      'النقل: خادم ميرا. لا علامة صريحة تصنّف هذا المحتوى تجريبيًا أو حقيقيًا.';
  static const serverDemoBanner =
      'النقل: خادم ميرا. المحتوى موسوم تجريبيًا بعلامة صريحة، لا باسم الجهة.';
  static const localDemoBanner =
      'النقل: الكتالوج المحلي. المحتوى موسوم تجريبيًا داخل الكتالوج نفسه.';
  static const localUnmarkedBanner =
      'النقل: الكتالوج المحلي. لا علامة تجريبية صريحة على هذا المحتوى.';
  static const mixedContentBanner =
      'هذه الشاشة تجمع سجلات بعلامات محتوى مختلفة، ولا يُختصر وصفها بعبارة واحدة.';
  static const viewsUnavailable = 'العد غير مفعّل';
  static const isolatedSampleCaption =
      'عينة وسائط معزولة للاختبار. ليست صورة أو فيديو هذا المنتج.';
  static const externalLinkNotPurchase =
      'فتح الرابط ينقلك إلى متجر خارجي. ليس شراءً مؤكدًا داخل ميرا.';
  static const appointmentUnavailable =
      'طلب الموعد غير متاح. لا يوجد مسار تشغيلي ينشئ طلبًا يمكن للجهة متابعته.';
  static const noExternalStore =
      'لا يوجد متجر خارجي لهذه الجهة. الشراء يبقى عبر رابط المنتج إن وُجد، ولا توجد سلة داخل ميرا.';

  // ---- Commerce: cart, COD orders, bookings ----
  static const previewBuy = 'هذه معاينة ولا تنفّذ شراءً';
  static const previewAppointment = 'لم يُرسل طلب موعد. التواصل في المعاينة تجريبي.';
  static const loginAction = 'تسجيل الدخول';
  static const loginRequiredCart = 'يلزم تسجيل الدخول لإضافة المنتج إلى السلة.';
  static const loginRequiredOrders = 'يلزم تسجيل الدخول لعرض الطلبات.';
  static const loginRequiredBookings = 'يلزم تسجيل الدخول لطلب موعد أو عرض الحجوزات.';
  static const loginRequiredCheckout = 'يلزم تسجيل الدخول لإتمام الطلب.';
  static const variantUnavailable = 'هذه التركيبة غير متوفرة حاليًا.';
  static const outOfStock = 'نفد المخزون حاليًا.';
  static const addedToCart = 'أُضيف إلى السلة';
  static const viewCart = 'عرض السلة';
  static const addToCart = 'أضيفي للسلة';
  static const chooseOptionsFirst = 'اختاري الخيارات أولًا ثم أضيفي للسلة.';
  static const cartPartnerConflictTitle = 'سلتك تحتوي على منتجات من متجر آخر';
  static const cartPartnerConflictBody =
      'السلة الواحدة تخص متجرًا واحدًا. أكملي الطلب الحالي، أو أفرغي السلة ثم أضيفي هذا المنتج. لن نستبدل سلتك دون موافقتك.';
  static const cartPartnerConflictKeep = 'إكمال الطلب الحالي';
  static const cartPartnerConflictReplace = 'إفراغ السلة وإضافة هذا المنتج';
  static const cancel = 'إلغاء';
  static const codOnly = 'الدفع نقدًا عند الاستلام فقط. لا يوجد دفع داخل التطبيق.';
  static const deliveryFeeUnknown =
      'رسوم التوصيل غير محددة وسيؤكدها المتجر عند التواصل. هذا لا يعني أن التوصيل مجاني.';
  static const deliveryFeeUnknownAck = 'أوافق على المتابعة دون رسوم توصيل محددة';
  static const orderRequested = 'أُنشئ الطلب. المتجر لم يقبله بعد، والدفع نقدًا عند الاستلام.';
  static const bookingPayAtVenue = 'الدفع في الفرع. لا يوجد دفع داخل التطبيق.';
  static const bookingRequested = 'أُرسل طلب موعد. ليس مؤكدًا حتى توافق الجهة.';
  static const availabilityMissing = 'مواعيد هذه الخدمة غير محددة بعد، لذلك لا يمكن اختيار موعد الآن.';
  static const noSlotsForDay = 'لا توجد مواعيد متاحة في هذا اليوم.';
  static const emptyCart = 'السلة فارغة.';
  static const noOrders = 'لا توجد طلبات بعد.';
  static const noBookings = 'لا توجد حجوزات بعد.';
  static const favoritesTitle = 'المفضلة';
  static const favoritesEmpty = 'لا توجد عناصر محفوظة.';
  static const loginRequiredFavorites = 'يلزم تسجيل الدخول لعرض المفضلة.';

  static String chooseOption(String groupLabel) => 'يرجى اختيار $groupLabel.';

  static const categories = [
    (emoji: '💄', title: 'ماركات التجميل'),
    (emoji: '💅', title: 'صالونات العناية'),
    (emoji: '🏥', title: 'عيادات التجميل'),
  ];
}
