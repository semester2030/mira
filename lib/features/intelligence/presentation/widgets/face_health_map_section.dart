import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/face_health_map.dart';
import 'beauty_report_face_map/beauty_report_face_map.dart';
import '../../domain/constants/report_face_map_spec.dart';

/// Section 4 — Playground-style interactive Face Health Map.
class FaceHealthMapSection extends StatefulWidget {
  final FaceHealthMap map;

  const FaceHealthMapSection({super.key, required this.map});

  @override
  State<FaceHealthMapSection> createState() => _FaceHealthMapSectionState();
}

class _FaceHealthMapSectionState extends State<FaceHealthMapSection> {
  late String _selectedConcernId;

  FaceHealthMap get map => widget.map;

  @override
  void initState() {
    super.initState();
    _selectedConcernId = map.defaultConcernId.isNotEmpty
        ? map.defaultConcernId
        : (map.concernOverlays.isNotEmpty
            ? map.concernOverlays.first.concernId
            : '');
  }

  @override
  void didUpdateWidget(covariant FaceHealthMapSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.map.defaultConcernId != map.defaultConcernId &&
        map.overlayById(_selectedConcernId) == null) {
      _selectedConcernId = map.defaultConcernId;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!map.enabled) return const SizedBox.shrink();

    final overlay = map.overlayById(_selectedConcernId);
    final showRegional = overlay?.hasRegionalData ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PremiumCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Header(map: map),
              if (map.concernOverlays.isNotEmpty) ...[
                const SizedBox(height: 16),
                _ConcernSelector(
                  overlays: map.concernOverlays,
                  selectedId: _selectedConcernId,
                  onSelected: (id) => setState(() => _selectedConcernId = id),
                ),
              ],
              if (overlay != null) ...[
                const SizedBox(height: 14),
                _ConcernScoreHero(overlay: overlay, showRegional: showRegional),
              ],
              const SizedBox(height: 16),
              AnimatedBeautyReportFaceMap(
                concernId: _selectedConcernId.isNotEmpty
                    ? _selectedConcernId
                    : ReportFaceMapSpec.tabOrder.first,
                highlightZoneIds: overlay?.highlightZoneIds ?? const [],
                highlightColorHex: overlay?.highlightColor,
                concernScore: overlay?.globalScore ?? 70,
              ),
              const SizedBox(height: 14),
              _DisclaimerBox(
                text: map.disclaimerAr.isNotEmpty
                    ? map.disclaimerAr
                    : ReportFaceMapSpec.disclaimerAr,
              ),
            ],
          ),
        ),
        if (map.insightCards.isNotEmpty) ...[
          const SizedBox(height: 12),
          ...map.insightCards.map(
            (card) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: PremiumCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 4,
                      height: 48,
                      decoration: BoxDecoration(
                        color: _parseHex(
                          map.overlayById(card.concernId)?.highlightColor ??
                              '#C19EE0',
                        ),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            card.concernLabelAr,
                            style: AppTypography.labelLarge.copyWith(
                              color: AppColors.primaryDark,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            card.zoneLabelAr,
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textTertiary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            card.bodyAr,
                            style: AppTypography.bodyMedium.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.6,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Color _parseHex(String hex) {
    final value = hex.replaceFirst('#', '');
    return Color(int.parse('FF$value', radix: 16));
  }
}

class _Header extends StatelessWidget {
  final FaceHealthMap map;

  const _Header({required this.map});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppColors.primaryLight.withValues(alpha: 0.9),
                AppColors.cardPurple.withValues(alpha: 0.7),
              ],
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(
            Icons.face_retouching_natural_outlined,
            color: AppColors.primaryDark,
            size: 24,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(map.titleAr, style: AppTypography.titleMedium),
              if (map.subtitleAr.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  map.subtitleAr,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 8),
        _ConfidenceBadge(
          confidence: map.confidence,
          label: map.confidenceLabelAr,
        ),
      ],
    );
  }
}

class _ConcernSelector extends StatelessWidget {
  final List<FaceHealthConcernOverlay> overlays;
  final String selectedId;
  final ValueChanged<String> onSelected;

  const _ConcernSelector({
    required this.overlays,
    required this.selectedId,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: overlays.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final overlay = overlays[index];
          final selected = overlay.concernId == selectedId;
          final color = _parseHex(overlay.highlightColor);

          return Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => onSelected(overlay.concernId),
              borderRadius: BorderRadius.circular(14),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: selected
                      ? color.withValues(alpha: 0.18)
                      : AppColors.background,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: selected
                        ? color.withValues(alpha: 0.55)
                        : AppColors.border.withValues(alpha: 0.6),
                    width: selected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      overlay.labelAr,
                      style: AppTypography.labelMedium.copyWith(
                        color: selected
                            ? AppColors.primaryDark
                            : AppColors.textSecondary,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${overlay.globalScore}',
                      style: AppTypography.labelSmall.copyWith(
                        color: overlay.isHealthy
                            ? const Color(0xFF2E7D32)
                            : const Color(0xFFC62828),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Color _parseHex(String hex) {
    final value = hex.replaceFirst('#', '');
    return Color(int.parse('FF$value', radix: 16));
  }
}

class _ConcernScoreHero extends StatelessWidget {
  final FaceHealthConcernOverlay overlay;
  final bool showRegional;

  const _ConcernScoreHero({
    required this.overlay,
    required this.showRegional,
  });

  @override
  Widget build(BuildContext context) {
    final color = _parseHex(overlay.highlightColor);
    final progress = overlay.globalScore / 100;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.12),
            AppColors.cardPink.withValues(alpha: 0.25),
          ],
        ),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  overlay.labelAr,
                  style: AppTypography.labelLarge.copyWith(
                    color: AppColors.primaryDark,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  showRegional
                      ? 'درجات مناطقية — كل لون يطابق شدة الارتباط بالمنطقة'
                      : 'المناطق الملوّنة تتغيّر حسب المؤشر — كلما كان اللون أوضح، كان الارتباط أقوى',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          SizedBox(
            width: 56,
            height: 56,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 56,
                  height: 56,
                  child: CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 5,
                    backgroundColor: Colors.white.withValues(alpha: 0.6),
                    color: color,
                  ),
                ),
                Text(
                  '${overlay.globalScore}',
                  style: AppTypography.titleSmall.copyWith(
                    color: AppColors.primaryDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _parseHex(String hex) {
    final value = hex.replaceFirst('#', '');
    return Color(int.parse('FF$value', radix: 16));
  }
}

class _ConfidenceBadge extends StatelessWidget {
  final String confidence;
  final String label;

  const _ConfidenceBadge({required this.confidence, required this.label});

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = switch (confidence) {
      'high' => (AppColors.cardPurple, AppColors.primaryDark, Icons.verified_outlined),
      'medium' => (AppColors.cardBlue, AppColors.info, Icons.layers_outlined),
      _ => (AppColors.goldLight, const Color(0xFF8D6E00), Icons.info_outline),
    };

    return Container(
      constraints: const BoxConstraints(maxWidth: 110),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label,
              style: AppTypography.labelSmall.copyWith(color: fg, height: 1.2),
              maxLines: 3,
            ),
          ),
        ],
      ),
    );
  }
}

class _DisclaimerBox extends StatelessWidget {
  final String text;

  const _DisclaimerBox({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.cardOrange.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.45)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.shield_outlined, size: 18, color: Color(0xFF8D6E00)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textSecondary,
                height: 1.55,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
