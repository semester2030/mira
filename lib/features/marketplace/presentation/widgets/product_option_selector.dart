import 'package:flutter/material.dart';

import '../../domain/catalog_attribute_display.dart';
import '../../domain/entities/catalog_product.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// Size / color / volume picker. Colors render as circles when a swatch or known label exists.
class ProductOptionSelector extends StatefulWidget {
  const ProductOptionSelector({
    super.key,
    required this.product,
    this.initialSelected,
    required this.onChanged,
  });

  final CatalogProduct product;
  final Map<String, String>? initialSelected;
  final void Function(Map<String, String> selected, CatalogProductVariant? variant) onChanged;

  @override
  State<ProductOptionSelector> createState() => _ProductOptionSelectorState();
}

class _ProductOptionSelectorState extends State<ProductOptionSelector> {
  late Map<String, String> _selected = Map<String, String>.from(widget.initialSelected ?? const {});

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _emit());
  }

  @override
  void didUpdateWidget(covariant ProductOptionSelector oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.product.id != widget.product.id || oldWidget.initialSelected != widget.initialSelected) {
      _selected = Map<String, String>.from(widget.initialSelected ?? const {});
      _emit();
    }
  }

  void _emit() {
    final variant = CatalogOptionMatrix.match(variants: widget.product.variants, selected: _selected);
    widget.onChanged(Map<String, String>.from(_selected), variant);
  }

  void _select(CatalogOptionGroup group, CatalogOptionValue value) {
    setState(() => _selected[group.id] = value.id);
    _emit();
  }

  Color? _swatch(CatalogOptionValue value) {
    final hex = value.swatchHex;
    if (hex != null && hex.isNotEmpty) {
      final raw = hex.replaceFirst('#', '');
      if (raw.length == 6) return Color(int.parse('FF$raw', radix: 16));
    }
    final argb = CatalogAttributeDisplay.colorArgbFromLabel(value.labelAr);
    if (argb != null) return Color(argb);
    return null;
  }

  bool _isColorGroup(CatalogOptionGroup group) {
    final kind = group.kind.toLowerCase();
    if (kind == 'color' || kind == 'colour') return true;
    final label = group.labelAr.trim();
    return label == 'اللون' || label.contains('لون');
  }

  bool _isSizeGroup(CatalogOptionGroup group) {
    final kind = group.kind.toLowerCase();
    if (kind == 'size') return true;
    final label = group.labelAr.trim();
    return label == 'المقاس' || label.contains('مقاس');
  }

  String? get _summary {
    if (_selected.isEmpty) return null;
    final parts = <String>[];
    for (final group in widget.product.optionGroups) {
      final id = _selected[group.id];
      if (id == null) continue;
      final match = group.values.where((v) => v.id == id);
      if (match.isNotEmpty) parts.add(match.first.displayLabel);
    }
    return parts.isEmpty ? null : parts.join(' • ');
  }

  bool get _needsAlternative {
    if (_selected.isEmpty || widget.product.variants.isEmpty) return false;
    return CatalogOptionMatrix.match(variants: widget.product.variants, selected: _selected) == null;
  }

  @override
  Widget build(BuildContext context) {
    final groups = widget.product.optionGroups;
    if (groups.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final group in groups) ...[
          if (_isColorGroup(group))
            _colorBlock(group)
          else if (_isSizeGroup(group))
            _sizeBlock(group)
          else ...[
            Text(group.labelAr, style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy), textAlign: TextAlign.right),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.end,
              children: [
                for (final value in group.values)
                  _textChip(
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
          ],
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

  Widget _colorBlock(CatalogOptionGroup group) {
    final selectedId = _selected[group.id];
    String? selectedLabel;
    if (selectedId != null) {
      final match = group.values.where((v) => v.id == selectedId);
      if (match.isNotEmpty) selectedLabel = match.first.displayLabel;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          selectedLabel == null ? group.labelAr : '${group.labelAr}: $selectedLabel',
          style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy),
          textAlign: TextAlign.right,
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          alignment: WrapAlignment.end,
          children: [
            for (final value in group.values)
              _colorCircle(
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
      ],
    );
  }

  Widget _sizeBlock(CatalogOptionGroup group) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(
              'دليل المقاسات',
              style: AppTypography.labelMedium.copyWith(color: AppColors.brandBurgundy),
            ),
            const SizedBox(width: 4),
            Icon(Icons.straighten, size: 16, color: AppColors.brandBurgundy),
            const Spacer(),
            Text(
              group.labelAr,
              style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.end,
          children: [
            for (final value in group.values)
              _sizeChip(
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
      ],
    );
  }

  Widget _colorCircle({
    required CatalogOptionGroup group,
    required CatalogOptionValue value,
    required bool enabled,
  }) {
    final selected = _selected[group.id] == value.id;
    final swatch = _swatch(value) ?? AppColors.primaryLight;
    return Semantics(
      button: true,
      selected: selected,
      enabled: enabled,
      label: '${group.labelAr} ${value.displayLabel}',
      child: InkWell(
        onTap: enabled ? () => _select(group, value) : null,
        customBorder: const CircleBorder(),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: swatch,
            border: Border.all(
              color: selected ? AppColors.brandBurgundy : AppColors.border,
              width: selected ? 3 : 1,
            ),
            boxShadow: selected
                ? [BoxShadow(color: AppColors.brandBurgundy.withValues(alpha: 0.2), blurRadius: 6)]
                : null,
          ),
          child: selected
              ? Icon(Icons.check, size: 20, color: swatch.computeLuminance() > 0.55 ? AppColors.brandBurgundy : Colors.white)
              : (!enabled ? Icon(Icons.close, size: 16, color: Colors.black38) : null),
        ),
      ),
    );
  }

  Widget _sizeChip({
    required CatalogOptionGroup group,
    required CatalogOptionValue value,
    required bool enabled,
  }) {
    final selected = _selected[group.id] == value.id;
    return Semantics(
      button: true,
      selected: selected,
      enabled: enabled,
      label: '${group.labelAr} ${value.displayLabel}',
      child: Material(
        color: selected ? AppColors.brandBurgundy : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: enabled ? () => _select(group, value) : null,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            constraints: const BoxConstraints(minWidth: 48, minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selected ? AppColors.brandBurgundy : (enabled ? AppColors.border : AppColors.border.withValues(alpha: 0.4)),
                width: selected ? 2 : 1,
              ),
            ),
            child: Text(
              value.displayLabel,
              textAlign: TextAlign.center,
              style: AppTypography.labelLarge.copyWith(
                color: !enabled
                    ? AppColors.textTertiary
                    : selected
                        ? Colors.white
                        : AppColors.textPrimary,
                decoration: enabled ? null : TextDecoration.lineThrough,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _textChip({
    required CatalogOptionGroup group,
    required CatalogOptionValue value,
    required bool enabled,
  }) {
    final selected = _selected[group.id] == value.id;
    return Material(
      color: selected ? AppColors.brandBurgundy : AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: enabled ? () => _select(group, value) : null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? AppColors.brandBurgundy : AppColors.border),
          ),
          child: Text(
            value.displayLabel,
            style: AppTypography.labelLarge.copyWith(
              color: selected ? Colors.white : AppColors.textPrimary,
              decoration: enabled ? null : TextDecoration.lineThrough,
            ),
          ),
        ),
      ),
    );
  }
}
