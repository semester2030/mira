import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../domain/catalog_offer_media.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// Mixed detail media with one audible video at a time and no autoplay-all.
class CatalogDetailMediaSection extends StatefulWidget {
  const CatalogDetailMediaSection({super.key, required this.media});

  final List<CatalogMediaLink> media;

  @override
  State<CatalogDetailMediaSection> createState() => _CatalogDetailMediaSectionState();
}

class _CatalogDetailMediaSectionState extends State<CatalogDetailMediaSection> {
  VideoPlayerController? _active;
  String? _activeUrl;
  var _muted = true;

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
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر تشغيل الفيديو')));
      }
    }
  }

  Future<void> _toggleMute() async {
    _muted = !_muted;
    await _active?.setVolume(_muted ? 0 : 1);
    if (mounted) setState(() {});
  }

  void _openImage(BuildContext context, int index) {
    final images = [
      for (final item in widget.media)
        if (item.kind == 'image') item,
    ];
    if (images.isEmpty) return;
    final start = images.indexWhere((item) => identical(item, widget.media[index]) || item.url == widget.media[index].url);
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _ImageLightbox(images: images, initialIndex: start < 0 ? 0 : start),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.media.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('الوسائط', style: AppTypography.titleMedium),
        const SizedBox(height: 10),
        for (var i = 0; i < widget.media.length; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          if (widget.media[i].kind == 'image')
            GestureDetector(
              onTap: () => _openImage(context, i),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: AspectRatio(
                  aspectRatio: 4 / 5,
                  child: ColoredBox(
                    color: const Color(0xFF2C2428),
                    child: _Still(path: widget.media[i].url),
                  ),
                ),
              ),
            )
          else
            _DetailVideoTile(
              path: widget.media[i].url,
              playing: _activeUrl == widget.media[i].url && (_active?.value.isPlaying ?? false),
              ready: _activeUrl == widget.media[i].url && (_active?.value.isInitialized ?? false),
              muted: _muted,
              controller: _activeUrl == widget.media[i].url ? _active : null,
              onPlay: () => _play(widget.media[i]),
              onMute: _toggleMute,
            ),
        ],
      ],
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
      return Image.network(path, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.primaryLight));
    }
    return Image.asset(path, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.primaryLight));
  }
}

class _DetailVideoTile extends StatelessWidget {
  const _DetailVideoTile({
    required this.path,
    required this.playing,
    required this.ready,
    required this.muted,
    required this.onPlay,
    required this.onMute,
    this.controller,
  });

  final String path;
  final bool playing;
  final bool ready;
  final bool muted;
  final VoidCallback onPlay;
  final VoidCallback onMute;
  final VideoPlayerController? controller;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: Color(0xFF2C2428)),
            if (ready && controller != null)
              FittedBox(
                fit: BoxFit.contain,
                child: SizedBox(
                  width: controller!.value.size.width == 0 ? 16 : controller!.value.size.width,
                  height: controller!.value.size.height == 0 ? 9 : controller!.value.size.height,
                  child: VideoPlayer(controller!),
                ),
              )
            else
              Center(child: Text('فيديو التفاصيل', style: AppTypography.bodyMedium.copyWith(color: Colors.white70))),
            Positioned(
              left: 12,
              bottom: 12,
              child: Row(
                children: [
                  Material(
                    color: AppColors.glassFill.withValues(alpha: 0.55),
                    shape: const CircleBorder(),
                    child: IconButton(
                      onPressed: onPlay,
                      icon: Icon(playing ? Icons.pause : Icons.play_arrow, color: AppColors.textPrimary),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Material(
                    color: AppColors.glassFill.withValues(alpha: 0.55),
                    shape: const CircleBorder(),
                    child: IconButton(
                      onPressed: onMute,
                      icon: Icon(muted ? Icons.volume_off_outlined : Icons.volume_up_outlined, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
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
