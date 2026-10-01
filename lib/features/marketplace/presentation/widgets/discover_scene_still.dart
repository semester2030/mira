import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../../shared/theme/typography.dart';
import '../presentation/presentation_models.dart';

/// Full-bleed scene: soft blurred backdrop + sharp contain foreground.
/// Matches the owner reference (media extends behind chrome without stretching the product).
class DiscoverSceneStill extends StatefulWidget {
  const DiscoverSceneStill({super.key, required this.media});

  final PresentationMedia media;

  @override
  State<DiscoverSceneStill> createState() => _DiscoverSceneStillState();
}

class _DiscoverSceneStillState extends State<DiscoverSceneStill> {
  Object? _error;
  var _attempt = 0;

  @override
  void didUpdateWidget(covariant DiscoverSceneStill oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.media.assetPath != widget.media.assetPath) {
      _error = null;
      _attempt = 0;
    }
  }

  Widget _image({required BoxFit fit, required bool backdrop}) {
    final key = ValueKey('${widget.media.assetPath}-$_attempt-${backdrop ? 'b' : 'f'}');
    void onError(Object error) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _error == null) setState(() => _error = error);
      });
    }

    if (widget.media.network) {
      return Image.network(
        widget.media.assetPath,
        key: key,
        fit: fit,
        alignment: Alignment.center,
        loadingBuilder: backdrop
            ? null
            : (context, child, progress) {
                if (progress == null) return child;
                return Center(child: Text('جاري تحميل الصورة', style: AppTypography.bodyMedium.copyWith(color: Colors.white70)));
              },
        errorBuilder: (_, error, __) {
          onError(error);
          return const SizedBox.shrink();
        },
      );
    }
    return Image.asset(
      widget.media.assetPath,
      key: key,
      fit: fit,
      alignment: Alignment.center,
      errorBuilder: (_, error, __) {
        onError(error);
        return const SizedBox.shrink();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return ColoredBox(
        color: const Color(0xFF2C2428),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('تعذر تحميل الصورة', style: AppTypography.bodyMedium.copyWith(color: Colors.white70)),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => setState(() {
                  _error = null;
                  _attempt += 1;
                }),
                child: const Text('إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: Color(0xFF2C2428)),
        // Soft fill only — heavily blurred so it is not a second readable product.
        ImageFiltered(
          imageFilter: ImageFilter.blur(sigmaX: 28, sigmaY: 28, tileMode: TileMode.decal),
          child: Transform.scale(
            scale: 1.2,
            child: Opacity(
              opacity: 0.55,
              child: _image(fit: BoxFit.cover, backdrop: true),
            ),
          ),
        ),
        const ColoredBox(color: Color(0x662C2428)),
        // Sharp product kept in proportion.
        _image(fit: BoxFit.contain, backdrop: false),
      ],
    );
  }
}

class DiscoverSceneCover extends StatelessWidget {
  const DiscoverSceneCover({super.key, required this.path});

  final String path;

  @override
  Widget build(BuildContext context) {
    final network = path.startsWith('http://') || path.startsWith('https://');
    final media = PresentationMedia(
      kind: PresentationMediaKind.image,
      assetPath: path,
      network: network,
    );
    return DiscoverSceneStill(media: media);
  }
}
