import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/pressable_scale.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/services/outfit_color_preview_service.dart';
import 'outfit_insight/outfit_illustration_painter.dart';
import 'outfit_insight/outfit_insight_item.dart';
import 'outfit_result_motion.dart';

/// «لو غيّرتِ اللون العلوي…» — interactive color swap preview.
class OutfitColorAlternativePanel extends StatefulWidget {
  final OutfitAnalysis analysis;

  const OutfitColorAlternativePanel({super.key, required this.analysis});

  @override
  State<OutfitColorAlternativePanel> createState() => _OutfitColorAlternativePanelState();
}

class _OutfitColorAlternativePanelState extends State<OutfitColorAlternativePanel> {
  late List<OutfitColorAlternative> _alternatives;
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _alternatives = OutfitColorPreviewService.alternatives(widget.analysis);
  }

  OutfitColorAlternative? get _selected =>
      _alternatives.isEmpty ? null : _alternatives[_selectedIndex.clamp(0, _alternatives.length - 1)];

  OutfitVisualKind _visualKind(OutfitPieceKind kind) {
    return switch (kind) {
      OutfitPieceKind.blazer => OutfitVisualKind.blazer,
      OutfitPieceKind.dress => OutfitVisualKind.dress,
      OutfitPieceKind.jeans => OutfitVisualKind.jeans,
      OutfitPieceKind.pants => OutfitVisualKind.pants,
      OutfitPieceKind.skirt => OutfitVisualKind.skirt,
      OutfitPieceKind.shirt => OutfitVisualKind.shirt,
      _ => OutfitVisualKind.shirt,
    };
  }

  @override
  Widget build(BuildContext context) {
    if (_alternatives.isEmpty) return const SizedBox.shrink();
    final selected = _selected!;

    return OutfitStaggerPop(
      index: 1,
      baseDelayMs: 160,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.palette_outlined, color: AppColors.primary, size: 22),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'معاينة لون بديل',
                    style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'لمسي لوناً لترى ${selected.pieceLabelAr} بدرجة مختلفة',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _PreviewColumn(
                    title: 'الحالي',
                    colorName: selected.currentColorAr,
                    scoreDelta: null,
                    child: _AnimatedPiece(
                      kind: _visualKind(selected.pieceKind),
                      primary: selected.currentColor,
                      accent: selected.currentColor.withValues(alpha: 0.7),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Icon(Icons.compare_arrows_rounded, color: AppColors.secondary),
                ),
                Expanded(
                  child: _PreviewColumn(
                    title: 'المقترح',
                    colorName: selected.alternativeColorAr,
                    scoreDelta: selected.projectedOverallDelta,
                    child: _AnimatedPiece(
                      key: ValueKey(selected.alternativeColorAr),
                      kind: _visualKind(selected.pieceKind),
                      primary: selected.alternativeColor,
                      accent: selected.alternativeColor.withValues(alpha: 0.72),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              selected.insightAr,
              style: AppTypography.bodySmall.copyWith(height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 52,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                reverse: true,
                itemCount: _alternatives.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final alt = _alternatives[index];
                  final isActive = index == _selectedIndex;
                  return PressableScale(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() => _selectedIndex = index);
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: alt.alternativeColor,
                        border: Border.all(
                          color: isActive ? AppColors.secondary : Colors.white,
                          width: isActive ? 3 : 2,
                        ),
                        boxShadow: isActive
                            ? [
                                BoxShadow(
                                  color: alt.alternativeColor.withValues(alpha: 0.5),
                                  blurRadius: 12,
                                ),
                              ]
                            : null,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PreviewColumn extends StatelessWidget {
  final String title;
  final String colorName;
  final int? scoreDelta;
  final Widget child;

  const _PreviewColumn({
    required this.title,
    required this.colorName,
    required this.scoreDelta,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(title, style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
        const SizedBox(height: 8),
        SizedBox(height: 88, child: child),
        const SizedBox(height: 8),
        Text(colorName, style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700)),
        if (scoreDelta != null) ...[
          const SizedBox(height: 4),
          Text(
            scoreDelta! >= 0 ? '+$scoreDelta% تقريباً' : '$scoreDelta% تقريباً',
            style: AppTypography.labelSmall.copyWith(
              color: scoreDelta! >= 0 ? AppColors.success : AppColors.gold,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}

class _AnimatedPiece extends StatelessWidget {
  final OutfitVisualKind kind;
  final Color primary;
  final Color accent;

  const _AnimatedPiece({
    super.key,
    required this.kind,
    required this.primary,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return OutfitFloatIdle(
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 380),
        switchInCurve: Curves.easeOutBack,
        child: CustomPaint(
          key: ValueKey('$kind-${primary.toARGB32()}'),
          painter: OutfitIllustrationPainter(kind: kind, primary: primary, accent: accent),
        ),
      ),
    );
  }
}
