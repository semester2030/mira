import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/typography.dart';
import 'soft_confetti.dart';

/// One-shot celebration after successful analysis.
abstract final class AnalysisCelebration {
  AnalysisCelebration._();

  static const _skinMessage = 'بشرتك تبدو رائعة اليوم ✨';
  static const _outfitMessage = 'إطلالتك متناسقة وجميلة ✨';

  static String messageForSkin() => _skinMessage;
  static String messageForOutfit() => _outfitMessage;

  static void show(BuildContext context, {required String message}) {
    final overlay = Overlay.of(context);
    late OverlayEntry entry;

    entry = OverlayEntry(
      builder: (ctx) => _CelebrationLayer(
        message: message,
        onDone: () {
          entry.remove();
        },
      ),
    );
    overlay.insert(entry);
  }
}

class CelebrationOnMount extends StatefulWidget {
  final Widget child;
  final String message;

  const CelebrationOnMount({
    super.key,
    required this.child,
    required this.message,
  });

  @override
  State<CelebrationOnMount> createState() => _CelebrationOnMountState();
}

class _CelebrationOnMountState extends State<CelebrationOnMount> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) AnalysisCelebration.show(context, message: widget.message);
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _CelebrationLayer extends StatefulWidget {
  final String message;
  final VoidCallback onDone;

  const _CelebrationLayer({required this.message, required this.onDone});

  @override
  State<_CelebrationLayer> createState() => _CelebrationLayerState();
}

class _CelebrationLayerState extends State<_CelebrationLayer>
    with SingleTickerProviderStateMixin {
  late AnimationController _banner;

  @override
  void initState() {
    super.initState();
    _banner = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
  }

  @override
  void dispose() {
    _banner.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Stack(
        fit: StackFit.expand,
        children: [
          SoftConfettiOverlay(onComplete: widget.onDone),
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.only(top: 72),
                child: FadeTransition(
                  opacity: CurvedAnimation(parent: _banner, curve: Curves.easeOut),
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, -0.15),
                      end: Offset.zero,
                    ).animate(CurvedAnimation(parent: _banner, curve: Curves.easeOutCubic)),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 24),
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.surface.withValues(alpha: 0.95),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.15),
                            blurRadius: 24,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.auto_awesome_rounded, color: AppColors.gold, size: 22),
                          const SizedBox(width: 10),
                          Flexible(
                            child: Text(
                              widget.message,
                              style: AppTypography.titleMedium,
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
