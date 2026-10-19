import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import 'discover_category_assets.dart';
import 'discover_view_count.dart';
import 'presentation_models.dart';

/// Layout follows the owner reference frames. Colors and type come from [AppColors] and [AppTypography].
enum DiscoverVisualFamily { product, clinic, salon }

DiscoverVisualFamily visualFamilyFor(PresentationSlide slide) {
  final type = slide.service?.partnerType;
  if (type == 'clinic') return DiscoverVisualFamily.clinic;
  if (type == 'salon') return DiscoverVisualFamily.salon;
  return DiscoverVisualFamily.product;
}

class DiscoverVisualChrome extends StatelessWidget {
  const DiscoverVisualChrome({
    super.key,
    required this.slide,
    required this.mediaCount,
    required this.mediaIndex,
    required this.showMute,
    required this.muted,
    required this.onBack,
    required this.onDetails,
    required this.onMute,
    required this.onBuy,
    required this.onUnavailable,
    required this.selectedCategory,
    required this.onCategory,
    this.searchController,
    this.searchFieldKey,
    this.searchFocus,
    this.onSearch,
    this.onStore,
    this.onAppointment,
    this.appointmentEnabled = false,
    this.onLocation,
    this.onFavorite,
    this.favoriteSaved = false,
    this.onShare,
    this.onFilter,
    this.provenance,
    this.includeSearch = true,
    this.viewCount = const DiscoverViewSnapshot.disabled(targetKind: 'product', targetId: ''),
    this.advertisementLabel,
    this.showPurchaseLink = true,
    this.showAppointmentRequest = true,
    this.purchaseLabel = 'أضيفي للسلة',
    this.appointmentLabel = 'احجزي موعدًا',
    this.categoryLabels,
    this.categoryAssetFamily,
    this.searchHintText,
    this.showCategoryRail = true,
    this.bottomReserve = 0,
  });

  final PresentationSlide slide;
  final int mediaCount;
  final int mediaIndex;
  final bool showMute;
  final bool muted;
  final VoidCallback onBack;
  final VoidCallback onDetails;
  final VoidCallback onMute;
  final VoidCallback onBuy;
  final void Function(String message) onUnavailable;
  final int selectedCategory;
  final ValueChanged<int> onCategory;
  final TextEditingController? searchController;
  final Key? searchFieldKey;
  final FocusNode? searchFocus;
  final ValueChanged<String>? onSearch;
  final VoidCallback? onStore;
  final VoidCallback? onAppointment;
  final bool appointmentEnabled;
  final VoidCallback? onLocation;
  final VoidCallback? onFavorite;
  final bool favoriteSaved;
  final VoidCallback? onShare;
  final VoidCallback? onFilter;
  final String? provenance;
  final bool includeSearch;
  final DiscoverViewSnapshot viewCount;
  final String? advertisementLabel;
  final bool showPurchaseLink;
  final bool showAppointmentRequest;
  final String purchaseLabel;
  final String appointmentLabel;
  final List<String>? categoryLabels;
  final String? categoryAssetFamily;
  final String? searchHintText;
  final bool showCategoryRail;
  final double bottomReserve;

  @override
  Widget build(BuildContext context) {
    final family = visualFamilyFor(slide);
    final padding = MediaQuery.paddingOf(context);
    final textScale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.4);
    final categories = categoryLabels ??
        switch (family) {
          DiscoverVisualFamily.product => const ['الكل', 'الوجه', 'الجسم', 'الشعر', 'الملابس'],
          DiscoverVisualFamily.clinic => const ['الكل', 'البشرة', 'الشعر', 'الليزر', 'الأسنان'],
          DiscoverVisualFamily.salon => const ['الكل', 'الشعر', 'المكياج', 'الأظافر', 'العناية'],
        };
    final selected = selectedCategory.clamp(0, categories.length - 1);
    final searchHint = searchHintText ??
        switch (family) {
          DiscoverVisualFamily.product => 'ابحثي عن منتج أو علامة',
          DiscoverVisualFamily.clinic => 'ابحثي عن عيادة أو مشغل أو خدمة',
          DiscoverVisualFamily.salon => 'ابحثي عن عيادة أو مشغل أو خدمة',
        };
    final assetFamily = categoryAssetFamily ?? family.name;
    final bottomBand = (220 * textScale) + padding.bottom;
    final topBand = padding.top + 52.0;

    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.28),
                    Colors.transparent,
                  ],
                  stops: const [0, 1],
                ),
              ),
              child: SizedBox(height: topBand + 12),
            ),
          ),
        ),
        Positioned(
          top: padding.top + 4,
          left: 4,
          right: 4,
          child: includeSearch
              ? _DiscoverTopChrome(
                  muted: muted,
                  showMute: showMute,
                  preview: slide.preview,
                  searchHint: searchHint,
                  searchFieldKey: searchFieldKey,
                  searchFocus: searchFocus,
                  searchController: searchController,
                  onBack: onBack,
                  onMute: onMute,
                  onSearch: onSearch,
                  onFilter: onFilter ?? () => onUnavailable('الفلاتر غير متاحة الآن'),
                  onSearchUnavailable: () => onUnavailable('البحث من هذه الشاشة غير متاح الآن'),
                  mediaCount: mediaCount,
                  mediaIndex: mediaIndex,
                )
              : (mediaCount > 1
                  ? IgnorePointer(
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 4, right: 8),
                          child: _MediaDots(count: mediaCount, index: mediaIndex),
                        ),
                      ),
                    )
                  : const SizedBox.shrink()),
        ),
        Positioned(
          right: 10,
          top: topBand,
          bottom: bottomBand,
          child: Align(
            alignment: Alignment.center,
            child: _InteractionColumn(
              favoriteSaved: favoriteSaved,
              onFavorite: onFavorite ?? () => onUnavailable('المفضلة غير متاحة الآن'),
              onShare: onShare ?? () => onUnavailable('المشاركة غير متاحة الآن'),
              viewCount: viewCount,
              onViewTap: viewCount.state == DiscoverViewState.disabled || viewCount.state == DiscoverViewState.unavailable
                  ? null
                  : () => onUnavailable(viewCount.label),
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.28),
                  Colors.black.withValues(alpha: 0.55),
                ],
                stops: const [0, 0.42, 1],
              ),
            ),
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 28, 16, padding.bottom + 8 + bottomReserve),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _OfferCopy(slide: slide, family: family),
                  if (advertisementLabel != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      advertisementLabel!,
                      style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                  const SizedBox(height: 10),
                  _Actions(
                    slide: slide,
                    onDetails: onDetails,
                    onBuy: onBuy,
                    onUnavailable: onUnavailable,
                    onStore: onStore,
                    onAppointment: onAppointment,
                    showPurchaseLink: showPurchaseLink,
                    showAppointmentRequest: showAppointmentRequest,
                    purchaseLabel: purchaseLabel,
                    appointmentLabel: appointmentLabel,
                  ),
                  const SizedBox(height: 10),
                  if (showCategoryRail)
                    DiscoverCategoryRail(
                      labels: categories,
                      assetFamily: assetFamily,
                      selected: selected,
                      onSelected: onCategory,
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _MiraMark extends StatelessWidget {
  const _MiraMark();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'ميرَا',
      image: true,
      child: Image.asset(
        'assets/images/mira_logo_icon.png',
        height: 28,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => Text(
          'MIRA',
          style: AppTypography.titleMedium.copyWith(
            letterSpacing: 1.6,
            color: Colors.white,
            shadows: const [Shadow(blurRadius: 8, color: Colors.black54)],
          ),
        ),
      ),
    );
  }
}

class _InteractionColumn extends StatelessWidget {
  const _InteractionColumn({
    required this.favoriteSaved,
    required this.onFavorite,
    required this.onShare,
    required this.viewCount,
    this.onViewTap,
  });

  final bool favoriteSaved;
  final VoidCallback onFavorite;
  final VoidCallback onShare;
  final DiscoverViewSnapshot viewCount;
  final VoidCallback? onViewTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _GlassIconButton(
          icon: favoriteSaved ? Icons.favorite : Icons.favorite_border,
          onTap: onFavorite,
          semanticLabel: favoriteSaved ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة',
          iconColor: favoriteSaved ? AppColors.primary : AppColors.textPrimary,
        ),
        const SizedBox(height: 12),
        _GlassIconButton(
          icon: Icons.share_outlined,
          onTap: onShare,
          semanticLabel: 'مشاركة',
        ),
        const SizedBox(height: 12),
        DiscoverViewBadge(snapshot: viewCount, onTap: onViewTap),
      ],
    );
  }
}

class _OfferCopy extends StatelessWidget {
  const _OfferCopy({required this.slide, required this.family});

  final PresentationSlide slide;
  final DiscoverVisualFamily family;

  @override
  Widget build(BuildContext context) {
    const shadow = [Shadow(blurRadius: 8, color: Colors.black54)];
    final partner = Text(
      slide.partnerName,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppTypography.bodySmall.copyWith(color: Colors.white, shadows: shadow),
    );
    final title = Text(
      slide.title,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: AppTypography.headlineSmall.copyWith(color: Colors.white, shadows: shadow),
    );
    if (family == DiscoverVisualFamily.product) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          partner,
          title,
          if (slide.priceLabel != null)
            Text(slide.priceLabel!, style: AppTypography.titleLarge.copyWith(color: Colors.white, shadows: shadow)),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        title,
        partner,
        if (slide.service != null)
          Text(slide.service!.city, style: AppTypography.bodySmall.copyWith(color: Colors.white70, shadows: shadow)),
        if (slide.priceLabel != null)
          Text(slide.priceLabel!, style: AppTypography.titleMedium.copyWith(color: Colors.white, shadows: shadow)),
      ],
    );
  }
}

class DiscoverSearchField extends StatelessWidget {
  const DiscoverSearchField({super.key, required this.hint, required this.onTap, this.fieldKey, this.focusNode, this.controller, this.onSearch});

  final String hint;
  final VoidCallback onTap;
  final Key? fieldKey;
  final FocusNode? focusNode;
  final TextEditingController? controller;
  final ValueChanged<String>? onSearch;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Material(
          color: AppColors.glassFill.withValues(alpha: 0.62),
          child: InkWell(
            onTap: controller == null ? onTap : null,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: controller == null ? 8 : 0),
              child: Row(
                children: [
                  const Icon(Icons.search, color: AppColors.textTertiary, size: 18),
                  const SizedBox(width: 6),
                  Expanded(
                    child: controller == null
                        ? Text(hint, style: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary))
                        : TextField(
                            key: fieldKey,
                            focusNode: focusNode,
                            controller: controller,
                            onChanged: onSearch,
                            style: AppTypography.bodyMedium,
                            decoration: InputDecoration(
                              hintText: hint,
                              hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              disabledBorder: InputBorder.none,
                              errorBorder: InputBorder.none,
                              focusedErrorBorder: InputBorder.none,
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Compact Places-style chrome icons: white glyph, no glass disc.
class _ChromeIcon extends StatelessWidget {
  const _ChromeIcon({
    required this.icon,
    required this.onTap,
    this.semanticLabel,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: IconButton(
        onPressed: onTap,
        tooltip: semanticLabel,
        visualDensity: VisualDensity.compact,
        padding: const EdgeInsets.all(8),
        constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
        icon: Icon(
          icon,
          color: Colors.white,
          size: 24,
          shadows: const [Shadow(blurRadius: 6, color: Colors.black54)],
        ),
      ),
    );
  }
}

class _DiscoverTopChrome extends StatefulWidget {
  const _DiscoverTopChrome({
    required this.muted,
    required this.showMute,
    required this.preview,
    required this.searchHint,
    required this.onBack,
    required this.onMute,
    required this.onFilter,
    required this.onSearchUnavailable,
    required this.mediaCount,
    required this.mediaIndex,
    this.searchFieldKey,
    this.searchFocus,
    this.searchController,
    this.onSearch,
  });

  final bool muted;
  final bool showMute;
  final bool preview;
  final String searchHint;
  final VoidCallback onBack;
  final VoidCallback onMute;
  final VoidCallback onFilter;
  final VoidCallback onSearchUnavailable;
  final int mediaCount;
  final int mediaIndex;
  final Key? searchFieldKey;
  final FocusNode? searchFocus;
  final TextEditingController? searchController;
  final ValueChanged<String>? onSearch;

  @override
  State<_DiscoverTopChrome> createState() => _DiscoverTopChromeState();
}

class _DiscoverTopChromeState extends State<_DiscoverTopChrome> {
  bool _searchOpen = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_searchOpen && widget.searchController != null)
          Row(
            children: [
              _ChromeIcon(
                icon: Icons.close,
                onTap: () {
                  setState(() => _searchOpen = false);
                  widget.searchFocus?.unfocus();
                },
                semanticLabel: 'إغلاق البحث',
              ),
              Expanded(
                child: DiscoverSearchField(
                  hint: widget.searchHint,
                  fieldKey: widget.searchFieldKey,
                  focusNode: widget.searchFocus,
                  controller: widget.searchController,
                  onSearch: widget.onSearch,
                  onTap: widget.onSearchUnavailable,
                ),
              ),
            ],
          )
        else
          SizedBox(
            height: 44,
            child: Row(
              children: [
                _ChromeIcon(icon: Icons.chevron_right, onTap: widget.onBack, semanticLabel: 'رجوع'),
                if (widget.showMute)
                  _ChromeIcon(
                    icon: widget.muted ? Icons.volume_off : Icons.volume_up,
                    onTap: widget.onMute,
                    semanticLabel: widget.muted ? 'تشغيل الصوت' : 'كتم الصوت',
                  ),
                const Spacer(),
                const _MiraMark(),
                const Spacer(),
                _ChromeIcon(
                  icon: Icons.search,
                  onTap: () {
                    if (widget.searchController == null) {
                      widget.onSearchUnavailable();
                      return;
                    }
                    setState(() => _searchOpen = true);
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      widget.searchFocus?.requestFocus();
                    });
                  },
                  semanticLabel: 'بحث',
                ),
                _ChromeIcon(icon: Icons.tune, onTap: widget.onFilter, semanticLabel: 'الفلاتر'),
              ],
            ),
          ),
        if (widget.preview)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Padding(
              padding: const EdgeInsets.only(top: 2, right: 12),
              child: Text(
                'معاينة تجريبية',
                style: AppTypography.labelSmall.copyWith(
                  color: Colors.white.withValues(alpha: 0.92),
                  shadows: const [Shadow(blurRadius: 6, color: Colors.black54)],
                ),
              ),
            ),
          ),
        if (widget.mediaCount > 1)
          IgnorePointer(
            child: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Align(
                alignment: Alignment.centerRight,
                child: _MediaDots(count: widget.mediaCount, index: widget.mediaIndex),
              ),
            ),
          ),
      ],
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
    this.semanticLabel,
    this.iconColor,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? semanticLabel;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(
              icon,
              color: iconColor ?? Colors.white,
              size: 22,
              shadows: const [Shadow(blurRadius: 6, color: Colors.black54)],
            ),
          ),
        ),
      ),
    );
  }
}

class DiscoverVenueCopy {
  static String label(PresentationSlide slide) {
    if (slide.service == null) return 'المتجر';
    return switch (slide.service!.partnerType) {
      'clinic' => 'العيادة',
      'salon' => 'الصالون',
      'workshop' || 'atelier' => 'المشغل',
      _ => 'مقدّم الخدمة',
    };
  }

  static IconData icon(PresentationSlide slide) {
    if (slide.service == null) return Icons.storefront_outlined;
    return switch (slide.service!.partnerType) {
      'clinic' => Icons.local_hospital_outlined,
      'salon' => Icons.content_cut,
      'workshop' || 'atelier' => Icons.chair_outlined,
      _ => Icons.badge_outlined,
    };
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.slide,
    required this.onDetails,
    required this.onBuy,
    required this.onUnavailable,
    this.onStore,
    this.onAppointment,
    this.showPurchaseLink = true,
    this.showAppointmentRequest = true,
    this.purchaseLabel = 'أضيفي للسلة',
    this.appointmentLabel = 'احجزي موعدًا',
  });

  final PresentationSlide slide;
  final VoidCallback onDetails;
  final VoidCallback onBuy;
  final void Function(String message) onUnavailable;
  final VoidCallback? onStore;
  final VoidCallback? onAppointment;
  final bool showPurchaseLink;
  final bool showAppointmentRequest;
  final String purchaseLabel;
  final String appointmentLabel;

  static const double _side = 48;
  static const double _center = 64;
  static const double _gap = 12;
  static const double _touch = 48;

  @override
  Widget build(BuildContext context) {
    final service = slide.product == null && slide.service != null;
    final showCenter = service ? showAppointmentRequest : showPurchaseLink;
    final label = service ? appointmentLabel : purchaseLabel;
    final icon = service ? Icons.calendar_month_rounded : Icons.shopping_bag;
    final onTap = service
        ? (onAppointment ?? () => onUnavailable('طلب الموعد غير مفعّل لهذه الخدمة'))
        : onBuy;
    final venue = DiscoverVenueCopy.label(slide);
    final small = MediaQuery.sizeOf(context).shortestSide < 360;
    final side = small ? 44.0 : _side;
    final center = small ? 58.0 : _center;
    return Row(
      textDirection: TextDirection.ltr,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        _ClusterSide(
          diameter: side,
          icon: Icons.info_outline,
          label: 'التفاصيل',
          onTap: onDetails,
        ),
        if (showCenter) ...[
          const SizedBox(width: _gap),
          _ClusterPrimary(
            diameter: center,
            icon: icon,
            label: label,
            onTap: onTap,
          ),
          const SizedBox(width: _gap),
        ] else
          const SizedBox(width: _gap),
        _ClusterSide(
          diameter: side,
          icon: DiscoverVenueCopy.icon(slide),
          label: venue,
          onTap: onStore ?? () => onUnavailable('صفحة $venue غير متاحة الآن'),
        ),
      ],
    );
  }
}

class _ClusterSide extends StatelessWidget {
  const _ClusterSide({
    required this.diameter,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final double diameter;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final target = diameter < _Actions._touch ? _Actions._touch : diameter;
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: target + 8,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: target,
                height: target,
                child: Center(
                  child: Container(
                    width: diameter,
                    height: diameter,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.12),
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: Icon(icon, color: Colors.white, size: 22),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.labelSmall.copyWith(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  shadows: const [Shadow(blurRadius: 4, color: Color(0x66000000), offset: Offset(0, 1))],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ClusterPrimary extends StatelessWidget {
  const _ClusterPrimary({
    required this.diameter,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final double diameter;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final target = diameter < _Actions._touch ? _Actions._touch : diameter;
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: target + 8,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: target,
                height: target,
                child: Center(
                  child: Container(
                    width: diameter,
                    height: diameter,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primary,
                    ),
                    child: Icon(icon, color: Colors.white, size: 28),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: AppTypography.labelSmall.copyWith(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  shadows: const [Shadow(blurRadius: 4, color: Color(0x66000000), offset: Offset(0, 1))],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class DiscoverCategoryRail extends StatelessWidget {
  const DiscoverCategoryRail({
    super.key,
    required this.labels,
    required this.assetFamily,
    required this.selected,
    required this.onSelected,
  });

  final List<String> labels;
  final String assetFamily;
  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 108,
      child: LayoutBuilder(
        builder: (context, constraints) {
          const gap = 8.0;
          const minSize = 64.0;
          final needed = labels.length * minSize + (labels.length - 1) * gap;
          final fits = constraints.maxWidth >= needed;
          final size = fits
              ? ((constraints.maxWidth - (labels.length - 1) * gap) / labels.length).clamp(minSize, 78.0)
              : minSize;
          Widget chip(int index) {
            return _CategoryChip(
              assetFamily: assetFamily,
              label: labels[index],
              selected: index == selected,
              size: size,
              onTap: () => onSelected(index),
            );
          }

          if (fits) {
            return Row(
              textDirection: TextDirection.rtl,
              children: [
                for (var index = 0; index < labels.length; index++) ...[
                  if (index > 0) const SizedBox(width: gap),
                  chip(index),
                ],
              ],
            );
          }
          return ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: labels.length,
            separatorBuilder: (_, __) => const SizedBox(width: gap),
            itemBuilder: (context, index) => chip(index),
          );
        },
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.assetFamily,
    required this.label,
    required this.selected,
    required this.size,
    required this.onTap,
  });

  final String assetFamily;
  final String label;
  final bool selected;
  final double size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final path = DiscoverCategoryAssets.thumb(assetFamily, label);
    return InkWell(
      onTap: onTap,
      child: SizedBox(
        width: size,
        child: Column(
          children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 2.5 : 1),
              ),
              child: Padding(
                padding: const EdgeInsets.all(3),
                child: ClipOval(
                  child: path == null
                      ? const ColoredBox(color: AppColors.primaryLight)
                      : Image.asset(
                          path,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.primaryLight),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelSmall.copyWith(
                color: Colors.white,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                shadows: const [Shadow(blurRadius: 6, color: Colors.black54)],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MediaDots extends StatelessWidget {
  const _MediaDots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        textDirection: TextDirection.ltr,
        children: [
          for (var i = 0; i < count; i++)
            Container(
              width: i == index ? 28 : 16,
              height: 4,
              margin: const EdgeInsets.only(left: 4),
              decoration: BoxDecoration(
                color: i == index ? AppColors.primary : Colors.white.withValues(alpha: 0.45),
                borderRadius: BorderRadius.circular(2),
                border: Border.all(color: i == index ? AppColors.primaryDark : Colors.white54),
              ),
            ),
        ],
      ),
    );
  }
}
