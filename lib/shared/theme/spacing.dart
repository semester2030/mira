import 'package:flutter/material.dart';

class AppSpacing {
  // المسافات الأساسية
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
  static const double xxl = 48.0;
  static const double xxxl = 64.0;

  // المسافات الخاصة بالهوامش
  static const EdgeInsets marginXs = EdgeInsets.all(xs);
  static const EdgeInsets marginSm = EdgeInsets.all(sm);
  static const EdgeInsets marginMd = EdgeInsets.all(md);
  static const EdgeInsets marginLg = EdgeInsets.all(lg);
  static const EdgeInsets marginXl = EdgeInsets.all(xl);
  static const EdgeInsets marginXxl = EdgeInsets.all(xxl);
  static const EdgeInsets marginXxxl = EdgeInsets.all(xxxl);

  // المسافات الخاصة بالحشو
  static const EdgeInsets paddingXs = EdgeInsets.all(xs);
  static const EdgeInsets paddingSm = EdgeInsets.all(sm);
  static const EdgeInsets paddingMd = EdgeInsets.all(md);
  static const EdgeInsets paddingLg = EdgeInsets.all(lg);
  static const EdgeInsets paddingXl = EdgeInsets.all(xl);
  static const EdgeInsets paddingXxl = EdgeInsets.all(xxl);
  static const EdgeInsets paddingXxxl = EdgeInsets.all(xxxl);

  // المسافات الأفقية
  static const EdgeInsets horizontalXs = EdgeInsets.symmetric(horizontal: xs);
  static const EdgeInsets horizontalSm = EdgeInsets.symmetric(horizontal: sm);
  static const EdgeInsets horizontalMd = EdgeInsets.symmetric(horizontal: md);
  static const EdgeInsets horizontalLg = EdgeInsets.symmetric(horizontal: lg);
  static const EdgeInsets horizontalXl = EdgeInsets.symmetric(horizontal: xl);
  static const EdgeInsets horizontalXxl = EdgeInsets.symmetric(horizontal: xxl);
  static const EdgeInsets horizontalXxxl = EdgeInsets.symmetric(horizontal: xxxl);

  // المسافات الرأسية
  static const EdgeInsets verticalXs = EdgeInsets.symmetric(vertical: xs);
  static const EdgeInsets verticalSm = EdgeInsets.symmetric(vertical: sm);
  static const EdgeInsets verticalMd = EdgeInsets.symmetric(vertical: md);
  static const EdgeInsets verticalLg = EdgeInsets.symmetric(vertical: lg);
  static const EdgeInsets verticalXl = EdgeInsets.symmetric(vertical: xl);
  static const EdgeInsets verticalXxl = EdgeInsets.symmetric(vertical: xxl);
  static const EdgeInsets verticalXxxl = EdgeInsets.symmetric(vertical: xxxl);

  // المسافات المختلطة
  static const EdgeInsets mixedXs = EdgeInsets.symmetric(horizontal: xs, vertical: sm);
  static const EdgeInsets mixedSm = EdgeInsets.symmetric(horizontal: sm, vertical: md);
  static const EdgeInsets mixedMd = EdgeInsets.symmetric(horizontal: md, vertical: lg);
  static const EdgeInsets mixedLg = EdgeInsets.symmetric(horizontal: lg, vertical: xl);
  static const EdgeInsets mixedXl = EdgeInsets.symmetric(horizontal: xl, vertical: xxl);
  static const EdgeInsets mixedXxl = EdgeInsets.symmetric(horizontal: xxl, vertical: xxxl);

  // المسافات الخاصة بالبطاقات
  static const EdgeInsets cardPadding = EdgeInsets.all(md);
  static const EdgeInsets cardMargin = EdgeInsets.all(sm);
  static const EdgeInsets cardContentPadding = EdgeInsets.all(lg);

  // المسافات الخاصة بالأزرار
  static const EdgeInsets buttonPadding = EdgeInsets.symmetric(horizontal: lg, vertical: md);
  static const EdgeInsets iconButtonPadding = EdgeInsets.all(sm);
  static const EdgeInsets textButtonPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);

  // المسافات الخاصة بالحقول
  static const EdgeInsets inputPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets inputMargin = EdgeInsets.only(bottom: md);

  // المسافات الخاصة بالقوائم
  static const EdgeInsets listItemPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets listItemMargin = EdgeInsets.only(bottom: sm);
  static const EdgeInsets listPadding = EdgeInsets.all(md);

  // المسافات الخاصة بالشاشات
  static const EdgeInsets screenPadding = EdgeInsets.all(md);
  static const EdgeInsets screenContentPadding = EdgeInsets.all(lg);
  static const EdgeInsets screenHeaderPadding = EdgeInsets.all(lg);

  // المسافات الخاصة بالتنقل
  static const EdgeInsets navigationPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets navigationItemPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets navigationBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);

  // المسافات الخاصة بالتنبيهات
  static const EdgeInsets alertPadding = EdgeInsets.all(md);
  static const EdgeInsets alertContentPadding = EdgeInsets.all(lg);
  static const EdgeInsets alertActionPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);

  // المسافات الخاصة بالحوارات
  static const EdgeInsets dialogPadding = EdgeInsets.all(lg);
  static const EdgeInsets dialogContentPadding = EdgeInsets.all(xl);
  static const EdgeInsets dialogActionPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);

  // المسافات الخاصة بالشريط السفلي
  static const EdgeInsets bottomSheetPadding = EdgeInsets.all(lg);
  static const EdgeInsets bottomSheetContentPadding = EdgeInsets.all(xl);
  static const EdgeInsets bottomSheetHandlePadding = EdgeInsets.symmetric(vertical: sm);

  // المسافات الخاصة بالشريط العلوي
  static const EdgeInsets appBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets appBarTitlePadding = EdgeInsets.symmetric(horizontal: md);
  static const EdgeInsets appBarActionPadding = EdgeInsets.symmetric(horizontal: sm);

  // المسافات الخاصة بالشريط الجانبي
  static const EdgeInsets drawerPadding = EdgeInsets.all(lg);
  static const EdgeInsets drawerHeaderPadding = EdgeInsets.all(lg);
  static const EdgeInsets drawerItemPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);

  // المسافات الخاصة بالشريط التقدمي
  static const EdgeInsets progressBarPadding = EdgeInsets.symmetric(vertical: sm);
  static const EdgeInsets progressBarMargin = EdgeInsets.symmetric(vertical: md);

  // المسافات الخاصة بالشريط التمرير
  static const EdgeInsets scrollBarPadding = EdgeInsets.symmetric(horizontal: sm);
  static const EdgeInsets scrollBarMargin = EdgeInsets.symmetric(vertical: md);

  // المسافات الخاصة بالشريط التبويب
  static const EdgeInsets tabBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets tabBarItemPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets tabBarIndicatorPadding = EdgeInsets.symmetric(horizontal: md);

  // المسافات الخاصة بالشريط البحث
  static const EdgeInsets searchBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets searchBarContentPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets searchBarIconPadding = EdgeInsets.symmetric(horizontal: sm);

  // المسافات الخاصة بالشريط التصفية
  static const EdgeInsets filterBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterBarContentPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterBarItemPadding = EdgeInsets.symmetric(horizontal: sm, vertical: xs);

  // المسافات الخاصة بالشريط الفرز
  static const EdgeInsets sortBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets sortBarContentPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets sortBarItemPadding = EdgeInsets.symmetric(horizontal: sm, vertical: xs);

  // المسافات الخاصة بالشريط التصفية والفرز
  static const EdgeInsets filterSortBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterSortBarContentPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterSortBarItemPadding = EdgeInsets.symmetric(horizontal: sm, vertical: xs);

  // المسافات الخاصة بالشريط التصفية والفرز والبحث
  static const EdgeInsets filterSortSearchBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterSortSearchBarContentPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterSortSearchBarItemPadding = EdgeInsets.symmetric(horizontal: sm, vertical: xs);

  // المسافات الخاصة بالشريط التصفية والفرز والبحث والتبويب
  static const EdgeInsets filterSortSearchTabBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterSortSearchTabBarContentPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterSortSearchTabBarItemPadding = EdgeInsets.symmetric(horizontal: sm, vertical: xs);

  // المسافات الخاصة بالشريط التصفية والفرز والبحث والتبويب والتنقل
  static const EdgeInsets filterSortSearchTabNavigationBarPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterSortSearchTabNavigationBarContentPadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);
  static const EdgeInsets filterSortSearchTabNavigationBarItemPadding = EdgeInsets.symmetric(horizontal: sm, vertical: xs);
} 