import 'package:flutter/material.dart';

import '../../../../shared/icons/fashion/mira_fashion_icon.dart';
import '../../../../shared/icons/fashion/mira_fashion_icon_id.dart';
import '../../../../shared/icons/fashion/mira_fashion_icon_registry.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';

/// Internal Owner Preview — NOT a production Fashion migration surface.
class FashionIconSystemPreviewScreen extends StatefulWidget {
  const FashionIconSystemPreviewScreen({super.key});

  @override
  State<FashionIconSystemPreviewScreen> createState() =>
      _FashionIconSystemPreviewScreenState();
}

class _FashionIconSystemPreviewScreenState
    extends State<FashionIconSystemPreviewScreen> {
  MiraFashionIconSizeRole _size = MiraFashionIconSizeRole.normal;
  bool _lightSurface = true;

  static const _groupTitles = <MiraFashionIconGroup, String>{
    MiraFashionIconGroup.garments: 'أنواع القطع',
    MiraFashionIconGroup.attributes: 'سمات القطعة',
    MiraFashionIconGroup.accessories: 'الإكسسوارات',
    MiraFashionIconGroup.occasions: 'المناسبات',
    MiraFashionIconGroup.seasonStyle: 'الموسم والأسلوب',
    MiraFashionIconGroup.intelligence: 'ذكاء الأزياء',
  };

  @override
  Widget build(BuildContext context) {
    final bg = _lightSurface ? AppColors.background : Colors.white;
    return Scaffold(
      backgroundColor: bg,
      appBar: const MiraAppBar(pageTitle: 'نظام أيقونات ميرا للأزياء'),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'معاينة داخلية للمالك — 36 أيقونة · بدون استبدال إنتاجي',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('صغير'),
                      selected: _size == MiraFashionIconSizeRole.small,
                      onSelected: (_) =>
                          setState(() => _size = MiraFashionIconSizeRole.small),
                    ),
                    ChoiceChip(
                      label: const Text('عادي'),
                      selected: _size == MiraFashionIconSizeRole.normal,
                      onSelected: (_) =>
                          setState(() => _size = MiraFashionIconSizeRole.normal),
                    ),
                    ChoiceChip(
                      label: const Text('كبير'),
                      selected: _size == MiraFashionIconSizeRole.large,
                      onSelected: (_) =>
                          setState(() => _size = MiraFashionIconSizeRole.large),
                    ),
                    FilterChip(
                      label: Text(_lightSurface ? 'سطح ميرا' : 'أبيض'),
                      selected: _lightSurface,
                      onSelected: (v) => setState(() => _lightSurface = v),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'PHOSPHOR ${MiraFashionIconRegistry.phosphorCount} · '
                  'MIRA SVG ${MiraFashionIconRegistry.customSvgCount} · '
                  'المجموع ${MiraFashionIconRegistry.totalCount}',
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                for (final group in MiraFashionIconGroup.values) ...[
                  Text(
                    _groupTitles[group]!,
                    style: AppTypography.titleMedium.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  for (final spec in MiraFashionIconRegistry.byGroup(group))
                    _IconPreviewCard(spec: spec, sizeRole: _size),
                  const SizedBox(height: 18),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IconPreviewCard extends StatelessWidget {
  final MiraFashionIconSpec spec;
  final MiraFashionIconSizeRole sizeRole;

  const _IconPreviewCard({required this.spec, required this.sizeRole});

  @override
  Widget build(BuildContext context) {
    final sourceLabel = spec.source == MiraFashionIconSource.phosphor
        ? 'PHOSPHOR'
        : 'MIRA SVG';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: spec.ownerHighAttention
              ? AppColors.gold.withValues(alpha: 0.65)
              : AppColors.border.withValues(alpha: 0.45),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      spec.labelAr,
                      style: AppTypography.titleMedium.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      '${spec.englishId} · $sourceLabel'
                      '${spec.phosphorName != null ? ' · ${spec.phosphorName}' : ''}',
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (spec.ownerHighAttention)
                Text(
                  'مراجعة مالك',
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.gold,
                    fontWeight: FontWeight.w700,
                  ),
                ),
            ],
          ),
          if (spec.ownerReviewNote != null) ...[
            const SizedBox(height: 6),
            Text(
              spec.ownerReviewNote!,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textTertiary,
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              _StateCol(
                label: 'افتراضي',
                child: MiraFashionIconChrome(
                  id: spec.id,
                  state: MiraFashionIconState.defaults,
                  sizeRole: sizeRole,
                ),
              ),
              const SizedBox(width: 12),
              _StateCol(
                label: 'محدد',
                child: MiraFashionIconChrome(
                  id: spec.id,
                  state: MiraFashionIconState.selected,
                  sizeRole: sizeRole,
                ),
              ),
              const SizedBox(width: 12),
              _StateCol(
                label: 'معطّل',
                child: MiraFashionIconChrome(
                  id: spec.id,
                  state: MiraFashionIconState.disabled,
                  sizeRole: sizeRole,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StateCol extends StatelessWidget {
  final String label;
  final Widget child;

  const _StateCol({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        child,
        const SizedBox(height: 6),
        Text(label, style: AppTypography.labelSmall),
      ],
    );
  }
}
