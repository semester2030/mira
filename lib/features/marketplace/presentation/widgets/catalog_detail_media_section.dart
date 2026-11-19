import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../domain/catalog_offer_media.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// Product-detail gallery: hero + optional side thumbs. No black «فيديو التفاصيل» tile.
class CatalogDetailMediaSection extends StatefulWidget {
  const CatalogDetailMediaSection({
    super.key,
    required this.media,
    this.videoCover,
  });

  final List<CatalogMediaLink> media;
  final CatalogMediaLink? videoCover;

  @override
  State<CatalogDetailMediaSection> createState() => _CatalogDetailMediaSectionState();
}

class _CatalogDetailMediaSectionState extends State<CatalogDetailMediaSection> {
  VideoPlayerController? _active;
  String? _activeUrl;
  var _muted = true;
  var _heroIndex = 0;
  String? _videoError;

  List<CatalogMediaLink> get _items => widget.media;

  @override
  void dispose() {
    _disposeActive();
    super.dispose();
  }

  Future<void> _disposeActive() async {
    final controller = _active;
    _active = null;
    _activeUrl = null;
    await controller?.pause();
    await controller?.dispose();
  }

  Future<void> _play(CatalogMediaLink item) async {
    if (item.kind != 'video') return;
    setState(() => _videoError = null);
    if (_activeUrl == item.url && _active != null) {
      if (_active!.value.isPlaying) {
        await _active!.pause();
      } else {
        await _active!.play();
      }
      if (mounted) setState(() {});
      return;
    }
    await _disposeActive();
    final controller = item.url.startsWith('http://') || item.url.startsWith('https://')
        ? VideoPlayerController.networkUrl(Uri.parse(item.url))
        : VideoPlayerController.asset(item.url);
    _active = controller;
    _activeUrl = item.url;
    try {
      await controller.initialize();
      await controller.setLooping(true);
      await controller.setVolume(_muted ? 0 : 1);
      await controller.play();
      if (mounted) setState(() {});
    } catch (_) {
      await _disposeActive();
      if (mounted) {
        setState(() => _videoError = 'تعذر تشغيل الفيديو. أعيدي المحاولة.');
      }
    }
  }

  Future<void> _toggleMute() async {
    _muted = !_muted;
    await _active?.setVolume(_muted ? 0 : 1);
    if (mounted) setState(() {});
  }

  void _openLightbox(int index) {
    final images = [for (final item in _items) if (item.kind == 'image') item];
    if (images.isEmpty) return;
    final start = images.indexWhere((item) => item.url == _items[index].url);
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _ImageLightbox(images: images, initialIndex: start < 0 ? 0 : start),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) return const SizedBox.shrink();
    if (_items.length == 1) {
      return AspectRatio(
        aspectRatio: 4 / 5,
        child: _tile(context, _items.first, index: 0, hero: true),
      );
    }

    final hero = _items[_heroIndex.clamp(0, _items.length - 1)];
    final thumbs = <CatalogMediaLink>[];
    for (var i = 0; i < _items.length; i++) {
      if (i == _heroIndex) continue;
      thumbs.add(_items[i]);
      if (thumbs.length >= 2) break;
    }

    return SizedBox(
      height: 320,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 5,
            child: _tile(context, hero, index: _heroIndex, hero: true),
          ),
          if (thumbs.isNotEmpty) ...[
            const SizedBox(width: 8),
            Expanded(
              flex: 3,
              child: Column(
                children: [
                  for (var t = 0; t < thumbs.length; t++) ...[
                    if (t > 0) const SizedBox(height: 8),
                    Expanded(
                      child: _tile(
                        context,
                        thumbs[t],
                        index: _items.indexOf(thumbs[t]),
                        hero: false,
                      ),
                    ),
                  ],
                  if (thumbs.length == 1) const Spacer(),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, CatalogMediaLink item, {required int index, required bool hero}) {
    final playing = _activeUrl == item.url && (_active?.value.isPlaying ?? false);
    final ready = _activeUrl == item.url && (_active?.value.isInitialized ?? false);
    final counter = '${index + 1}/${_items.length}';

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Material(
        color: AppColors.primaryLight.withValues(alpha: 0.35),
        child: InkWell(
          onTap: () {
            if (item.kind == 'video') {
              _play(item);
            } else {
              if (!hero) {
                setState(() => _heroIndex = index);
              } else {
                _openLightbox(index);
              }
            }
          },
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (item.kind == 'video')
                _VideoSurface(
                  item: item,
                  cover: widget.videoCover,
                  ready: ready,
                  controller: ready ? _active : null,
                  error: _activeUrl == item.url ? _videoError : null,
                  onRetry: () => _play(item),
                )
              else
                _Still(path: item.url),
              if (hero)
                Positioned(
                  right: 10,
                  bottom: 10,
                  child: _Badge(text: counter),
                ),
              if (hero && item.kind == 'image')
                Positioned(
                  left: 10,
                  bottom: 10,
                  child: _RoundIcon(icon: Icons.open_in_full, onTap: () => _openLightbox(index)),
                ),
              if (item.kind == 'video')
                Positioned(
                  left: 10,
                  bottom: 10,
                  child: Row(
                    children: [
                      _RoundIcon(
                        icon: playing ? Icons.pause : Icons.play_arrow,
                        onTap: () => _play(item),
                      ),
                      if (ready) ...[
                        const SizedBox(width: 6),
                        _RoundIcon(
                          icon: _muted ? Icons.volume_off_outlined : Icons.volume_up_outlined,
                          onTap: _toggleMute,
                        ),
                      ],
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VideoSurface extends StatelessWidget {
  const _VideoSurface({
    required this.item,
    required this.cover,
    required this.ready,
    required this.controller,
    required this.error,
    required this.onRetry,
  });

  final CatalogMediaLink item;
  final CatalogMediaLink? cover;
  final bool ready;
  final VideoPlayerController? controller;
  final String? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (ready && controller != null) {
      return FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: controller!.value.size.width == 0 ? 16 : controller!.value.size.width,
          height: controller!.value.size.height == 0 ? 9 : controller!.value.size.height,
          child: VideoPlayer(controller!),
        ),
      );
    }
    if (cover != null && cover!.url.isNotEmpty) {
      return Stack(
        fit: StackFit.expand,
        children: [
          _Still(path: cover!.url),
          if (error != null) _ErrorOverlay(message: error!, onRetry: onRetry),
        ],
      );
    }
    if (error != null) {
      return _ErrorOverlay(message: error!, onRetry: onRetry);
    }
    // Soft poster placeholder — never a labeled black rectangle.
    return ColoredBox(
      color: const Color(0xFFE8DDE3),
      child: Center(
        child: Icon(Icons.play_circle_outline, size: 48, color: AppColors.brandBurgundy.withValues(alpha: 0.7)),
      ),
    );
  }
}

class _ErrorOverlay extends StatelessWidget {
  const _ErrorOverlay({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xCC2C2428),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(message, style: AppTypography.bodySmall.copyWith(color: Colors.white), textAlign: TextAlign.center),
              TextButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(text, style: AppTypography.labelSmall.copyWith(color: Colors.white)),
    );
  }
}

class _RoundIcon extends StatelessWidget {
  const _RoundIcon({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.85),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(icon, size: 20, color: AppColors.textPrimary),
        ),
      ),
    );
  }
}

class _Still extends StatelessWidget {
  const _Still({required this.path});
  final String path;

  @override
  Widget build(BuildContext context) {
    final network = path.startsWith('http://') || path.startsWith('https://');
    if (network) {
      return Image.network(
        path,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.primaryLight),
      );
    }
    return Image.asset(
      path,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.primaryLight),
    );
  }
}

class _ImageLightbox extends StatefulWidget {
  const _ImageLightbox({required this.images, required this.initialIndex});
  final List<CatalogMediaLink> images;
  final int initialIndex;

  @override
  State<_ImageLightbox> createState() => _ImageLightboxState();
}

class _ImageLightboxState extends State<_ImageLightbox> {
  late final PageController _controller;

  @override
  void initState() {
    super.initState();
    _controller = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('الصور', style: AppTypography.titleMedium.copyWith(color: Colors.white)),
      ),
      body: PageView.builder(
        controller: _controller,
        itemCount: widget.images.length,
        itemBuilder: (context, index) {
          return InteractiveViewer(
            child: Center(child: _Still(path: widget.images[index].url)),
          );
        },
      ),
    );
  }
}
