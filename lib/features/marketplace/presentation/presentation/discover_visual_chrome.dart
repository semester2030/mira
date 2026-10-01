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
    this.purchaseLabel = 'اشتري الآن',
    this.appointmentLabel = 'اطلبي موعدًا',
    this.categoryLabels,
    this.categoryAssetFamily,
    this.searchHintText,
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
    final bottomBand = (248 * textScale) + padding.bottom;
    final topBand = padding.top + 96.0;

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
          left: 10,
          right: 10,
          child: includeSearch
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      height: 40,
                      child: Row(
                        children: [
                          _GlassIconButton(icon: Icons.chevron_right, onTap: onBack, semanticLabel: 'رجوع'),
                          const Spacer(),
                          const _MiraMark(),
                          const Spacer(),
                          const SizedBox(width: 40),
                        ],
                      ),
                    ),
                    if (slide.preview)
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            'معاينة تجريبية',
                            style: AppTypography.labelSmall.copyWith(
                              color: Colors.white.withValues(alpha: 0.92),
                              shadows: const [Shadow(blurRadius: 6, color: Colors.black54)],
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: DiscoverSearchField(
                            hint: searchHint,
                            fieldKey: searchFieldKey,
                            focusNode: searchFocus,
                            controller: searchController,
                            onSearch: onSearch,
                            onTap: () => onUnavailable('البحث من هذه الشاشة غير متاح الآن'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _GlassIconButton(
                          icon: Icons.tune,
                          onTap: onFilter ?? () => onUnavailable('الفلاتر غير متاحة الآن'),
                          semanticLabel: 'الفلاتر',
                        ),
                      ],
                    ),
                    if (mediaCount > 1)
                      IgnorePointer(
                        child: Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: _MediaDots(count: mediaCount, index: mediaIndex),
                          ),
                        ),
                      ),
                  ],
                )
              : (mediaCount > 1
                  ? IgnorePointer(
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: _MediaDots(count: mediaCount, index: mediaIndex),
                      ),
                    )
                  : const SizedBox.shrink()),
        ),
        if (showMute)
          Positioned(
            top: topBand + 8,
            left: 12,
            child: _GlassIconButton(
              icon: muted ? Icons.volume_off_outlined : Icons.volume_up_outlined,
              onTap: onMute,
              semanticLabel: muted ? 'تشغيل الصوت' : 'كتم الصوت',
            ),
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
                  AppColors.background.withValues(alpha: 0.55),
                  AppColors.background.withValues(alpha: 0.92),
                ],
                stops: const [0, 0.35, 1],
              ),
            ),
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 36, 16, padding.bottom + 8),
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
                    family: family,
                    onDetails: onDetails,
                    onBuy: onBuy,
                    onUnavailable: onUnavailable,
                    onStore: onStore,
                    onAppointment: onAppointment,
                    onLocation: onLocation,
                    showPurchaseLink: showPurchaseLink,
                    showAppointmentRequest: showAppointmentRequest,
                    purchaseLabel: purchaseLabel,
                    appointmentLabel: appointmentLabel,
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 108,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        const gap = 8.0;
                        const minSize = 64.0;
                        final needed = categories.length * minSize + (categories.length - 1) * gap;
                        final fits = constraints.maxWidth >= needed;
                        final size = fits
                            ? ((constraints.maxWidth - (categories.length - 1) * gap) / categories.length).clamp(minSize, 78.0)
                            : minSize;
                        Widget chip(int index) {
                          return _CategoryChip(
                            assetFamily: assetFamily,
                            label: categories[index],
                            selected: index == selected,
                            size: size,
                            onTap: () => onCategory(index),
                          );
                        }

                        if (fits) {
                          return Row(
                            textDirection: TextDirection.rtl,
                            children: [
                              for (var index = 0; index < categories.length; index++) ...[
                                if (index > 0) const SizedBox(width: gap),
                                chip(index),
                              ],
                            ],
                          );
                        }
                        return ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: categories.length,
                          separatorBuilder: (_, __) => const SizedBox(width: gap),
                          itemBuilder: (context, index) => chip(index),
                        );
                      },
                    ),
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
    final partner = Text(
      slide.partnerName,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
    );
    final title = Text(
      slide.title,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: AppTypography.headlineSmall,
    );
    if (family == DiscoverVisualFamily.product) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          partner,
          title,
          if (slide.priceLabel != null)
            Text(slide.priceLabel!, style: AppTypography.titleLarge.copyWith(color: AppColors.primaryDark)),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        title,
        partner,
        if (slide.service != null)
          Text(slide.service!.city, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
        if (slide.priceLabel != null)
          Text(slide.priceLabel!, style: AppTypography.titleMedium.copyWith(color: AppColors.primaryDark)),
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
      child: ClipOval(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
          child: Material(
            color: AppColors.glassFill.withValues(alpha: 0.45),
            shape: CircleBorder(side: BorderSide(color: AppColors.border.withValues(alpha: 0.55))),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onTap,
              child: SizedBox(
                width: 44,
                height: 44,
                child: Icon(icon, color: iconColor ?? AppColors.textPrimary, size: 22),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.family,
    required this.onDetails,
    required this.onBuy,
    required this.onUnavailable,
    this.onStore,
    this.onAppointment,
    this.onLocation,
    this.showPurchaseLink = true,
    this.showAppointmentRequest = true,
    this.purchaseLabel = 'اشتري الآن',
    this.appointmentLabel = 'اطلبي موعدًا',
  });

  final DiscoverVisualFamily family;
  final VoidCallback onDetails;
  final VoidCallback onBuy;
  final void Function(String message) onUnavailable;
  final VoidCallback? onStore;
  final VoidCallback? onAppointment;
  final VoidCallback? onLocation;
  final bool showPurchaseLink;
  final bool showAppointmentRequest;
  final String purchaseLabel;
  final String appointmentLabel;

  @override
  Widget build(BuildContext context) {
    if (family == DiscoverVisualFamily.product) {
      return Row(
        textDirection: TextDirection.ltr,
        children: [
          _LabeledCircle(icon: Icons.info_outline, label: 'التفاصيل', onTap: onDetails),
          if (showPurchaseLink) ...[
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.onPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: const StadiumBorder(),
                ),
                onPressed: onBuy,
                icon: const Icon(Icons.shopping_bag_outlined),
                label: Text(purchaseLabel),
              ),
            ),
            const SizedBox(width: 8),
          ],
          _LabeledCircle(icon: Icons.storefront_outlined, label: 'المتجر', onTap: onStore ?? () => onUnavailable('صفحة المتجر غير متاحة الآن')),
        ],
      );
    }
    final radius = family == DiscoverVisualFamily.salon ? 18.0 : 28.0;
    OutlinedButton side(String label, IconData icon, VoidCallback onTap) {
      return OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          backgroundColor: AppColors.glassFill.withValues(alpha: 0.55),
          side: const BorderSide(color: AppColors.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius)),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        ),
        onPressed: onTap,
        icon: Icon(icon, size: 18),
        label: Text(label, style: AppTypography.labelMedium),
      );
    }

    return Row(
      textDirection: TextDirection.ltr,
      children: [
        Expanded(child: side('التفاصيل', Icons.info_outline, onDetails)),
        if (showAppointmentRequest) ...[
          const SizedBox(width: 8),
          Expanded(
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.onPrimary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onPressed: onAppointment ?? () => onUnavailable('طلب الموعد غير مفعّل لهذه الخدمة'),
              icon: const Icon(Icons.calendar_today_outlined, size: 18),
              label: Text(appointmentLabel),
            ),
          ),
          const SizedBox(width: 8),
        ],
        Expanded(child: side('الموقع', Icons.location_on_outlined, onLocation ?? () => onUnavailable('لا يوجد موقع مسجّل لهذه الجهة'))),
      ],
    );
  }
}

class _LabeledCircle extends StatelessWidget {
  const _LabeledCircle({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Column(
        children: [
          _GlassIconButton(icon: icon, onTap: onTap),
          const SizedBox(height: 4),
          Text(label, style: AppTypography.labelSmall),
        ],
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
              style: AppTypography.labelSmall.copyWith(color: selected ? AppColors.primaryDark : AppColors.textSecondary),
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
