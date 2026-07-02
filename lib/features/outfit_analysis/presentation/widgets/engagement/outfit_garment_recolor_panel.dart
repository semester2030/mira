import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../core/config/mira_api_config.dart';
import '../../../../../core/navigation/app_routes.dart';
import '../../../../../core/navigation/route_args.dart';
import '../../../../../core/services/app_session.dart';
import '../../../../../core/session/analysis_session.dart';
import '../../../../../core/utils/mira_api_error_message.dart';
import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../../../../../shared/widgets/premium/premium_exports.dart';
import '../../../data/datasources/vision_api_data_source.dart';
import '../../../data/helpers/vision_color_mapper.dart';
import '../../../domain/entities/outfit_analysis.dart';
import '../../../domain/helpers/garment_recolor_prompt_builder.dart';
import '../../../domain/helpers/garment_recolor_vision_context.dart';
import '../../../domain/services/outfit_color_preview_service.dart';

/// True garment recolor via FASHN Edit — فصل «جرّبي».
/// Includes garment picker, color chips, editable Arabic prompt, and explicit apply.
class OutfitGarmentRecolorPanel extends StatefulWidget {
  final OutfitAnalysis analysis;

  const OutfitGarmentRecolorPanel({super.key, required this.analysis});

  @override
  State<OutfitGarmentRecolorPanel> createState() => _OutfitGarmentRecolorPanelState();
}

class _OutfitGarmentRecolorPanelState extends State<OutfitGarmentRecolorPanel>
    with SingleTickerProviderStateMixin {
  final _api = VisionApiDataSource();
  final _promptController = TextEditingController();
  final _customColorController = TextEditingController();

  bool _loading = false;
  bool _promptEdited = false;
  bool _syncingPrompt = false;
  String? _error;
  VisionGarmentRecolorResult? _result;
  String? _selectedColorAr;
  late String _garmentLabelAr;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _garmentLabelAr = _initialGarmentLabel();
    _selectedColorAr = _colorOptions.isNotEmpty ? _colorOptions.first.nameAr : 'أسود';
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _syncPromptFromSelection();
    _promptController.addListener(_onPromptEdited);
  }

  @override
  void dispose() {
    _promptController.removeListener(_onPromptEdited);
    _promptController.dispose();
    _customColorController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _onPromptEdited() {
    if (_syncingPrompt) return;
    if (!_promptEdited) {
      setState(() => _promptEdited = true);
    }
  }

  void _writePrompt(String text) {
    _syncingPrompt = true;
    _promptController.text = text;
    _syncingPrompt = false;
  }

  String _initialGarmentLabel() {
    final alts = OutfitColorPreviewService.alternatives(widget.analysis, max: 1);
    if (alts.isNotEmpty) return alts.first.pieceLabelAr;
    if (widget.analysis.clothingType.isNotEmpty) {
      return widget.analysis.clothingType;
    }
    return GarmentRecolorPromptBuilder.garmentOptions.first;
  }

  List<_ColorOption> get _colorOptions {
    final alts = OutfitColorPreviewService.alternatives(widget.analysis, max: 6);
    final seen = <String>{};
    final out = <_ColorOption>[];

    for (final alt in alts) {
      if (seen.add(alt.alternativeColorAr)) {
        out.add(_ColorOption(
          nameAr: alt.alternativeColorAr,
          color: alt.alternativeColor,
        ));
      }
    }

    const extras = ['أسود', 'كحلي', 'ذهبي', 'نبيتي'];
    for (final name in extras) {
      if (seen.add(name)) {
        out.add(_ColorOption(
          nameAr: name,
          color: VisionColorMapper.toDisplayColor(name),
        ));
      }
    }
    return out;
  }

  String get _effectiveColorAr {
    final custom = _customColorController.text.trim();
    if (custom.isNotEmpty) return custom;
    return _selectedColorAr ?? 'أسود';
  }

  GarmentRecolorVisionContext get _visionContext =>
      GarmentRecolorVisionContext.fromAnalysis(widget.analysis, garmentLabelAr: _garmentLabelAr);

  void _syncPromptFromSelection() {
    if (_promptEdited) return;
    _writePrompt(GarmentRecolorPromptBuilder.build(
      garmentLabelAr: _garmentLabelAr,
      targetColorAr: _effectiveColorAr,
      visionContext: _visionContext,
    ));
  }

  void _resetPrompt() {
    setState(() => _promptEdited = false);
    _syncPromptFromSelection();
  }

  Future<void> _applyRecolor() async {
    final path = widget.analysis.frozenImagePath;
    if (path == null || !File(path).existsSync()) return;

    if (!MiraApiConfig.useBackend) {
      setState(() {
        _error = 'فعّلي الاتصال بسيرفر ميرا لتجربة إعادة التلوين الحقيقية';
      });
      return;
    }

    final colorAr = _effectiveColorAr;
    if (colorAr.isEmpty) {
      setState(() => _error = 'اختاري لوناً أو اكتبي اسمه');
      return;
    }

    final prompt = _promptController.text.trim();
    if (prompt.length < 20) {
      setState(() => _error = 'البرومبت قصير جداً — عدّليه أو اضغطي «إعادة توليد»');
      return;
    }

    HapticFeedback.mediumImpact();
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });

    try {
      final result = await _api.recolorGarment(
        imagePath: path,
        targetColorAr: colorAr,
        garmentLabelAr: _garmentLabelAr,
        customPromptAr: prompt,
        visionContextJson: _visionContext.toJsonString(),
        targetColorHex: GarmentRecolorPromptBuilder.colorHex[colorAr],
      );

      if (!mounted) return;

      if (result == null || result.imageBase64.isEmpty) {
        setState(() {
          _loading = false;
          _error = 'تعذّر إعادة التلوين — تأكدي من اتصال السيرفر و FASHN_API_KEY';
        });
        return;
      }

      HapticFeedback.lightImpact();
      if (result.recolorAttemptId != null) {
        AnalysisSession.setRecolorAttemptId(result.recolorAttemptId);
      }
      setState(() {
        _loading = false;
        _result = result;
        _compare = 0.5;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = friendlyMiraError(e);
      });
    }
  }

  double _compare = 0.5;

  @override
  Widget build(BuildContext context) {
    final path = widget.analysis.frozenImagePath;
    if (path == null || !File(path).existsSync()) return const SizedBox.shrink();

    final options = _colorOptions;
    if (options.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.auto_fix_high_rounded, color: AppColors.gold, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'إعادة تلوين حقيقية',
                  style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              if (_loading)
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.secondary),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'فصل «جرّبي» — معالجة على السيرفر مع Phase Q (QEL). لن تُعرض نتيجة تغيّر هويتك.',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, height: 1.45),
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AspectRatio(
              aspectRatio: 3 / 4,
              child: Image.file(File(path), fit: BoxFit.cover),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'القطعة المراد تلوينها',
            style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: GarmentRecolorPromptBuilder.garmentOptions.contains(_garmentLabelAr)
                ? _garmentLabelAr
                : _garmentLabelAr,
            decoration: InputDecoration(
              filled: true,
              fillColor: AppColors.background,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            hint: Text(_garmentLabelAr, style: AppTypography.bodyMedium),
            items: [
              if (!GarmentRecolorPromptBuilder.garmentOptions.contains(_garmentLabelAr))
                DropdownMenuItem(value: _garmentLabelAr, child: Text(_garmentLabelAr)),
              for (final g in GarmentRecolorPromptBuilder.garmentOptions)
                DropdownMenuItem(value: g, child: Text(g)),
            ],
            onChanged: _loading
                ? null
                : (v) {
                    if (v == null) return;
                    setState(() {
                      _garmentLabelAr = v;
                      _syncPromptFromSelection();
                    });
                  },
          ),
          const SizedBox(height: 14),
          Text(
            'اللون المستهدف',
            style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: options.map((opt) {
              final selected = _selectedColorAr == opt.nameAr && _customColorController.text.isEmpty;
              return _ColorChip(
                option: opt,
                selected: selected,
                onTap: _loading
                    ? null
                    : () {
                        HapticFeedback.selectionClick();
                        setState(() {
                          _selectedColorAr = opt.nameAr;
                          _customColorController.clear();
                          _syncPromptFromSelection();
                        });
                      },
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _customColorController,
            enabled: !_loading,
            textAlign: TextAlign.right,
            decoration: InputDecoration(
              hintText: 'أو اكتبي لوناً مخصصاً (مثل: عنابي)',
              filled: true,
              fillColor: AppColors.background,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            onChanged: (_) {
              setState(() => _syncPromptFromSelection());
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Text(
                  'البرومبت (يُرسل لميرا)',
                  style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              TextButton(
                onPressed: _loading ? null : _resetPrompt,
                child: const Text('إعادة توليد'),
              ),
            ],
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _promptController,
            enabled: !_loading,
            maxLines: 6,
            minLines: 4,
            textAlign: TextAlign.right,
            style: AppTypography.bodySmall.copyWith(height: 1.55, color: Colors.white),
            decoration: InputDecoration(
              hintText: 'عدّلي البرومبت العربي قبل الإرسال…',
              filled: true,
              fillColor: const Color(0xFF1A1625),
              hintStyle: AppTypography.bodySmall.copyWith(color: Colors.white54),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: AppColors.gold.withValues(alpha: 0.35)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: AppColors.gold.withValues(alpha: 0.25)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: AppColors.gold.withValues(alpha: 0.6)),
              ),
              contentPadding: const EdgeInsets.all(14),
            ),
            cursorColor: AppColors.gold,
          ),
          const SizedBox(height: 14),
          PremiumButton(
            label: _loading ? 'جاري المعالجة…' : 'تطبيق التلوين على صورتي',
            icon: Icons.brush_rounded,
            variant: PremiumButtonVariant.gold,
            onPressed: _loading ? null : _applyRecolor,
          ),
          if (_loading) ...[
            const SizedBox(height: 16),
            _LoadingState(pulse: _pulseController, colorAr: _effectiveColorAr),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.error.withValues(alpha: 0.25)),
              ),
              child: Text(
                _error!,
                style: AppTypography.bodySmall.copyWith(color: AppColors.error, height: 1.45),
              ),
            ),
          ],
          if (_result != null) ...[
            const SizedBox(height: 16),
            if (_result!.qel != null) ...[
              _QelBadge(qel: _result!.qel!, attempt: _result!.attempt),
              const SizedBox(height: 10),
            ],
            Text(
              _result!.userMessageAr,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            _BeforeAfterCompare(
              originalPath: path,
              resultBase64: _result!.imageBase64,
              compare: _compare,
              onCompareChanged: (v) => setState(() => _compare = v),
            ),
            const SizedBox(height: 10),
            Text(
              'اسحبي للمقارنة — قبل / بعد',
              textAlign: TextAlign.center,
              style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
            ),
            if (_result!.recolorAttemptId != null && AppSession.canUseCloud) ...[
              const SizedBox(height: 14),
              PremiumButton(
                label: 'اسألي ميرا عن التلوين · QEL',
                icon: Icons.chat_bubble_outline_rounded,
                variant: PremiumButtonVariant.secondary,
                onPressed: () => Navigator.pushNamed(
                  context,
                  AppRoutes.miraAdvisor,
                  arguments: AdvisorRouteArgs.atelier(
                    recolorAttemptId: _result!.recolorAttemptId!,
                    outfitAnalysis: widget.analysis,
                    skinReport: AnalysisSession.lastSkin,
                    initialQuestion: 'لماذا نجح التلوين؟',
                  ),
                ),
              ),
            ],
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.lock_outline_rounded, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'معالجة على سيرفر ميرا — لا مشاركة · لا حفظ للصورة',
                  style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QelBadge extends StatelessWidget {
  final VisionGarmentQelResult qel;
  final int attempt;

  const _QelBadge({required this.qel, required this.attempt});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.verified_user_rounded, color: AppColors.success, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Phase Q — جودة ${qel.scorePercent}% · ${qel.cropFirst == true ? 'Q2 crop' : 'Q3 gate'} · محاولة $attempt',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.success,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ColorOption {
  final String nameAr;
  final Color color;

  const _ColorOption({required this.nameAr, required this.color});
}

class _ColorChip extends StatelessWidget {
  final _ColorOption option;
  final bool selected;
  final VoidCallback? onTap;

  const _ColorChip({required this.option, required this.selected, this.onTap});

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.secondary.withValues(alpha: 0.12) : AppColors.background,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.secondary : AppColors.border.withValues(alpha: 0.5),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: option.color,
                border: Border.all(color: Colors.white, width: 1.5),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              option.nameAr,
              style: AppTypography.labelSmall.copyWith(
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  final AnimationController pulse;
  final String colorAr;

  const _LoadingState({required this.pulse, required this.colorAr});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulse,
      builder: (context, _) {
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              colors: [
                AppColors.secondary.withValues(alpha: 0.06 + pulse.value * 0.06),
                AppColors.gold.withValues(alpha: 0.04 + pulse.value * 0.04),
              ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.brush_rounded, color: AppColors.secondary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'ميرا تعيد تلوين إطلالتك إلى $colorAr…',
                      style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'قد تستغرق حتى 90 ثانية — QEL يتحقق من الهوية والخامة',
                style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _BeforeAfterCompare extends StatelessWidget {
  final String originalPath;
  final String resultBase64;
  final double compare;
  final ValueChanged<double> onCompareChanged;

  const _BeforeAfterCompare({
    required this.originalPath,
    required this.resultBase64,
    required this.compare,
    required this.onCompareChanged,
  });

  @override
  Widget build(BuildContext context) {
    final resultBytes = base64Decode(resultBase64);

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final w = constraints.maxWidth;
            final splitX = w * compare;

            return Stack(
              fit: StackFit.expand,
              children: [
                Image.memory(resultBytes, fit: BoxFit.cover),
                ClipRect(
                  clipper: _LeftClipper(fraction: compare),
                  child: Image.file(File(originalPath), fit: BoxFit.cover),
                ),
                Positioned(
                  left: splitX - 1.5,
                  top: 0,
                  bottom: 0,
                  child: Container(width: 3, color: AppColors.gold),
                ),
                const Positioned(left: 12, bottom: 12, child: _Badge(label: 'بعد')),
                const Positioned(right: 12, bottom: 12, child: _Badge(label: 'قبل')),
                Positioned.fill(
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onHorizontalDragUpdate: (d) {
                      final next = (compare + d.delta.dx / w).clamp(0.08, 0.92);
                      onCompareChanged(next);
                    },
                    onTapDown: (d) {
                      onCompareChanged((d.localPosition.dx / w).clamp(0.08, 0.92));
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;

  const _Badge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(color: Colors.white, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _LeftClipper extends CustomClipper<Rect> {
  final double fraction;

  _LeftClipper({required this.fraction});

  @override
  Rect getClip(Size size) => Rect.fromLTWH(0, 0, size.width * fraction, size.height);

  @override
  bool shouldReclip(covariant _LeftClipper oldClipper) => oldClipper.fraction != fraction;
}
