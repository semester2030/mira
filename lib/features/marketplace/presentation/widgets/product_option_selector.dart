import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/catalog_product_options.dart';
import '../../domain/entities/catalog_product.dart';

typedef ProductOptionChanged = void Function(
  Map<String, String> selected,
  CatalogProductVariant? variant,
);

/// Elegant size / color / volume chips for product details.
class ProductOptionSelector extends StatefulWidget {
  const ProductOptionSelector({
    super.key,
    required this.product,
    this.onChanged,
  });

  final CatalogProduct product;
  final ProductOptionChanged? onChanged;

  @override
  State<ProductOptionSelector> createState() => _ProductOptionSelectorState();
}

class _ProductOptionSelectorState extends State<ProductOptionSelector> {
  late Map<String, String> _selected;

  @override
  void initState() {
    super.initState();
    _selected = {};
  }

  @override
  void didUpdateWidget(covariant ProductOptionSelector oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.product.id != widget.product.id) {
      _selected = {};
    }
  }

  CatalogProductVariant? get _match => CatalogOptionMatrix.match(
        variants: widget.product.variants,
        selected: _selected,
      );

  String? get _summary {
    if (_selected.isEmpty) return null;
    final parts = <String>[];
    for (final group in widget.product.optionGroups) {
      final id = _selected[group.id];
      if (id == null) continue;
      CatalogOptionValue? value;
      for (final item in group.values) {
        if (item.id == id) {
          value = item;
          break;
        }
      }
      if (value != null) parts.add(value.displayLabel);
    }
    if (parts.isEmpty) return null;
    return parts.join(' — ');
  }

  bool get _needsAlternative {
    if (_selected.isEmpty || widget.product.variants.isEmpty) return false;
    if (_selected.length < widget.product.optionGroups.length) return false;
    return _match == null;
  }

  void _select(CatalogOptionGroup group, CatalogOptionValue value) {
    setState(() {
      final next = Map<String, String>.from(_selected);
      if (next[group.id] == value.id) {
        next.remove(group.id);
      } else {
        next[group.id] = value.id;
      }
      _selected = CatalogOptionMatrix.sanitize(
        groups: widget.product.optionGroups,
        variants: widget.product.variants,
        selected: next,
        preferGroupId: group.id,
      );
    });
    widget.onChanged?.call(_selected, _match);
  }

  Color? _swatch(CatalogOptionValue value) {
    final hex = value.swatchHex;
    if (hex == null || hex.isEmpty) return null;
    final raw = hex.replaceFirst('#', '');
    if (raw.length != 6) return null;
    return Color(int.parse('FF$raw', radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    final groups = widget.product.optionGroups;
    if (groups.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final group in groups) ...[
          Text(group.labelAr, style: AppTypography.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final value in group.values)
                _chip(
                  group: group,
                  value: value,
                  enabled: CatalogOptionMatrix.availableValueIds(
                    group: group,
                    variants: widget.product.variants,
                    selected: _selected,
                  ).contains(value.id),
                ),
            ],
          ),
          const SizedBox(height: 16),
        ],
        if (_summary != null)
          Text(
            'اختيارك: $_summary',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
        if (_needsAlternative) ...[
          const SizedBox(height: 8),
          Text(
            'هذا التركيب غير متاح. اختاري مقاسًا أو لونًا آخر.',
            style: AppTypography.bodySmall.copyWith(color: AppColors.error),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }

  Widget _chip({
    required CatalogOptionGroup group,
    required CatalogOptionValue value,
    required bool enabled,
  }) {
    final selected = _selected[group.id] == value.id;
    final swatch = _swatch(value);
    final border = selected
        ? AppColors.primary
        : enabled
            ? AppColors.border
            : AppColors.border.withValues(alpha: 0.4);
    final fill = selected ? AppColors.primaryLight : AppColors.surface;
    final labelColor = !enabled
        ? AppColors.textTertiary
        : selected
            ? AppColors.primaryDark
            : AppColors.textPrimary;

    return Semantics(
      button: true,
      selected: selected,
      enabled: enabled,
      label: '${group.labelAr} ${value.displayLabel}${enabled ? '' : ' غير متاح'}',
      child: Material(
        color: fill,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: enabled ? () => _select(group, value) : null,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            constraints: const BoxConstraints(minWidth: 48, minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: border, width: selected ? 2 : 1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (swatch != null) ...[
                  Container(
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      color: swatch,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.border),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Flexible(
                  child: Text(
                    value.displayLabel,
                    style: AppTypography.labelLarge.copyWith(
                      color: labelColor,
                      decoration: enabled ? null : TextDecoration.lineThrough,
                    ),
                  ),
                ),
                if (!enabled) ...[
                  const SizedBox(width: 6),
                  Text('غير متاح', style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
