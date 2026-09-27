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

  static const categories = [
    (emoji: '💄', title: 'ماركات التجميل'),
    (emoji: '💅', title: 'صالونات العناية'),
    (emoji: '🏥', title: 'عيادات التجميل'),
  ];
}
