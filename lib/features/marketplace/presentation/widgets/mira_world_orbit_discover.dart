// Home «اكتشفي عالم ميرا» — motion/geometry merge from MIRA_Discovery_Motion.zip.
// Keeps existing DiscoverLane ids, AppRoutes.discoverPresentation, and onLaneOpened.
import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/discover_catalog_query.dart';
import '../../data/lane_orb_assets.dart';

/// Fixed layout fractions vs component width (no pink orbit ring, no auto-spin).
/// Order clockwise from top: أناقتك · جمالك · الأطفال · الهدايا · مناسباتك · المجوهرات.
const _lanes = <(String, DiscoverLane, String, double, double)>[
  ('أناقتك', DiscoverLane.elegance, 'elegance', 0.500, 0.167),
  ('جمالك', DiscoverLane.beauty, 'beauty', 0.827, 0.408),
  ('الأطفال', DiscoverLane.children, 'children', 0.827, 0.940),
  ('الهدايا', DiscoverLane.gifts, 'gifts', 0.500, 1.180),
  ('مناسباتك', DiscoverLane.occasions, 'occasions', 0.173, 0.940),
  ('المجوهرات', DiscoverLane.jewelry, 'jewelry', 0.173, 0.408),
];

const _logoPath = 'assets/marketplace/discover/home_orbit/mira_center_logo.png';

class MiraWorldOrbitDiscover extends StatefulWidget {
  const MiraWorldOrbitDiscover({super.key, this.onLaneOpened});

  /// Test hook: reports Arabic title → lane id when a circle opens.
  final void Function(String titleAr, DiscoverLane lane)? onLaneOpened;

  @override
  State<MiraWorldOrbitDiscover> createState() => _MiraWorldOrbitDiscoverState();
}

class _MiraWorldOrbitDiscoverState extends State<MiraWorldOrbitDiscover> {
  bool _opening = false;

  Future<void> _open(int i) async {
    if (_opening) return;
    _opening = true;
    try {
      final lane = _lanes[i];
      final reduced = MediaQuery.disableAnimationsOf(context);
      if (!reduced) {
        await Future<void>.delayed(const Duration(milliseconds: 135));
      }
      if (!mounted || ModalRoute.of(context)?.isCurrent == false) return;
      // Finger-up + short settle ≈150ms; drag-cancel never reaches onTap.
      widget.onLaneOpened?.call(lane.$1, lane.$2);
      await Navigator.of(
        context,
      ).pushNamed(AppRoutes.discoverPresentation, arguments: lane.$2);
    } finally {
      _opening = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'اكتشفي عالم ميرا',
          textAlign: TextAlign.center,
          style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 5),
        Text(
          'اختاري ما يلهمك',
          textAlign: TextAlign.center,
          style: AppTypography.bodyMedium.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, c) {
            final w = math.min(c.maxWidth, 520.0);
            // ~31.6% of available width — ~50% larger visible photos than prior ~20.5%.
            final d = w * 0.316;
            final center = d * 1.22;
            final font = (w * 0.041).clamp(14.0, 18.0).toDouble();
            final labelH = math.max(
              24.0,
              MediaQuery.textScalerOf(context).scale(font) * 1.6,
            );
            // Grow canvas height on narrow screens instead of shrinking photos/labels.
            final h = w * 1.18 + d / 2 + 7 + labelH + 8;
            return Align(
              alignment: Alignment.topCenter,
              child: SizedBox(
                width: w,
                height: h,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      top: w * 0.674 - center / 2,
                      left: (w - center) / 2,
                      width: center,
                      height: center,
                      child: const _LivingMark(),
                    ),
                    for (var i = 0; i < _lanes.length; i++)
                      Positioned(
                        key: ValueKey('home-orb-${_lanes[i].$3}'),
                        left: w * _lanes[i].$4 - d / 2,
                        top: w * _lanes[i].$5 - d / 2,
                        width: d,
                        child: _Petal(
                          title: _lanes[i].$1,
                          asset: LaneOrbAssets.homeOrbitAssetForImageKey(
                            _lanes[i].$3,
                          )!,
                          diameter: d,
                          font: font,
                          labelH: labelH,
                          open: () => _open(i),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

class _Petal extends StatefulWidget {
  const _Petal({
    required this.title,
    required this.asset,
    required this.diameter,
    required this.font,
    required this.labelH,
    required this.open,
  });

  final String title;
  final String asset;
  final double diameter;
  final double font;
  final double labelH;
  final Future<void> Function() open;

  @override
  State<_Petal> createState() => _PetalState();
}

class _PetalState extends State<_Petal> {
  bool _pressed = false;
  bool _hover = false;
  bool _focus = false;
  bool _selected = false;

  Future<void> _activate() async {
    if (_selected) return;
    setState(() => _selected = true);
    try {
      await widget.open();
    } finally {
      if (mounted) {
        setState(() {
          _selected = false;
          _pressed = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    final active = _pressed || _selected;
    final target = active ? 1.0 : (_hover || _focus ? 0.55 : 0.0);
    return Semantics(
      button: true,
      label: widget.title,
      excludeSemantics: true,
      onTap: _activate,
      child: FocusableActionDetector(
        onShowHoverHighlight: (v) => setState(() => _hover = v),
        onShowFocusHighlight: (v) => setState(() => _focus = v),
        actions: <Type, Action<Intent>>{
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              _activate();
              return null;
            },
          ),
        },
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => setState(() => _pressed = true),
          onTapCancel: () => setState(() => _pressed = false),
          onTapUp: (_) => setState(() => _pressed = false),
          // Drag-away cancels → onTap does not fire → no navigation.
          onTap: _activate,
          child: Column(
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(end: target),
                duration: reduce
                    ? Duration.zero
                    : Duration(milliseconds: active ? 120 : 175),
                curve: Curves.easeOutCubic,
                child: ClipOval(
                  child: Image.asset(
                    widget.asset,
                    fit: BoxFit.cover,
                    width: widget.diameter,
                    height: widget.diameter,
                    excludeFromSemantics: true,
                    errorBuilder: (_, __, ___) =>
                        const ColoredBox(color: AppColors.primaryLight),
                  ),
                ),
                builder: (context, t, photo) => Transform.translate(
                  offset: Offset(0, reduce ? 0 : -5.5 * t),
                  child: Transform.scale(
                    scale: reduce ? 1 : 1 + 0.08 * t,
                    child: Container(
                      width: widget.diameter,
                      height: widget.diameter,
                      foregroundDecoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Color.lerp(
                            const Color(0xffffe7f0),
                            const Color(0xffe54a96),
                            t,
                          )!,
                          width: 1.7 + 1.6 * t,
                        ),
                      ),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Color.fromRGBO(
                              207,
                              55,
                              137,
                              0.07 + 0.35 * t,
                            ),
                            blurRadius: 5 + 15 * t,
                            spreadRadius: 0.5 + 3 * t,
                            offset: Offset(0, 2 + 3 * t),
                          ),
                        ],
                      ),
                      child: photo,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 5),
              SizedBox(
                width: widget.diameter,
                height: widget.labelH,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Text(
                    widget.title,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.visible,
                    style: AppTypography.bodySmall.copyWith(
                      fontSize: widget.font,
                      height: 1.22,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Fit visible bronze ink, not the outer square of an asset with built-in padding.
class _Ink {
  _Ink(this.image, this.bounds, this.radius);
  final ui.Image image;
  final Rect bounds;
  final double radius;
}

Future<_Ink> _measureInk(AssetBundle bundle) async {
  final bytes = await bundle.load(_logoPath);
  final codec = await ui.instantiateImageCodec(
    bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes),
    targetWidth: 512,
    allowUpscaling: false,
  );
  late final ui.Image im;
  try {
    im = (await codec.getNextFrame()).image;
  } finally {
    codec.dispose();
  }
  try {
    final w = im.width;
    final h = im.height;
    final data = (await im.toByteData(format: ui.ImageByteFormat.rawRgba))!;
    final b = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
    var xmin = w;
    var xmax = -1;
    var ymin = h;
    var ymax = -1;
    final points = <int>[];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        final dx = (x + 0.5 - w / 2) / (w / 2);
        final dy = (y + 0.5 - h / 2) / (h / 2);
        if (dx * dx + dy * dy > 0.93 * 0.93) continue;
        final k = (y * w + x) * 4;
        if (b[k + 3] < 210 ||
            b[k] < b[k + 2] + 16 ||
            b[k + 1] <= b[k + 2] + 2 ||
            b[k + 2] >= 203) {
          continue;
        }
        points.add(y * w + x);
        if (x < xmin) xmin = x;
        if (x > xmax) xmax = x;
        if (y < ymin) ymin = y;
        if (y > ymax) ymax = y;
      }
    }
    if (points.length < 48) {
      final rect = Rect.fromLTWH(0, 0, w.toDouble(), h.toDouble());
      return _Ink(im, rect, math.max(w, h) * 0.5);
    }
    final bounds = Rect.fromLTRB(
      (xmin - 2).clamp(0, w).toDouble(),
      (ymin - 2).clamp(0, h).toDouble(),
      (xmax + 3).clamp(0, w).toDouble(),
      (ymax + 3).clamp(0, h).toDouble(),
    );
    final c = bounds.center;
    var maxR2 = 0.0;
    for (final p in points) {
      final dx = (p % w) + 0.5 - c.dx;
      final dy = (p ~/ w) + 0.5 - c.dy;
      maxR2 = math.max(maxR2, dx * dx + dy * dy);
    }
    return _Ink(im, bounds, math.sqrt(maxR2) + 2);
  } catch (_) {
    im.dispose();
    rethrow;
  }
}

class _LivingMark extends StatefulWidget {
  const _LivingMark();

  @override
  State<_LivingMark> createState() => _LivingMarkState();
}

class _LivingMarkState extends State<_LivingMark>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _fill;
  AssetBundle? _bundle;
  _Ink? _ink;
  Timer? _pause;
  bool _allowed = false;
  bool _foreground = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final state = WidgetsBinding.instance.lifecycleState;
    _foreground = state == null || state == AppLifecycleState.resumed;
    _fill = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1850),
    );
    _fill.addStatusListener(_next);
  }

  void _next(AnimationStatus s) {
    if (!_allowed || !_foreground || _ink == null || !mounted) return;
    if (s == AnimationStatus.completed || s == AnimationStatus.dismissed) {
      _pause?.cancel();
      _pause = Timer(
        Duration(milliseconds: s == AnimationStatus.completed ? 520 : 1700),
        () {
          if (!mounted || !_allowed || !_foreground) return;
          if (s == AnimationStatus.completed) {
            _fill.reverse();
          } else {
            _fill.forward();
          }
        },
      );
    }
  }

  void _sync() {
    _pause?.cancel();
    _fill.stop();
    if (!_allowed || !_foreground || _ink == null) return;
    if (_fill.status == AnimationStatus.reverse || _fill.value >= 1) {
      _fill.reverse();
    } else {
      _fill.forward();
    }
  }

  Future<void> _load(AssetBundle bundle) async {
    try {
      final ink = await _measureInk(bundle);
      if (!mounted || _bundle != bundle) {
        ink.image.dispose();
        return;
      }
      final old = _ink;
      setState(() {
        _ink = ink;
        _failed = false;
      });
      old?.image.dispose();
      _sync();
    } catch (e, st) {
      if (!mounted || _bundle != bundle) return;
      FlutterError.reportError(
        FlutterErrorDetails(
          exception: e,
          stack: st,
          library: 'MIRA discovery logo',
        ),
      );
      setState(() => _failed = true);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduce = MediaQuery.disableAnimationsOf(context);
    final bundle = DefaultAssetBundle.of(context);
    if (bundle != _bundle) {
      _bundle = bundle;
      // Skip bronze-ink pixel scan under reduce-motion / goldens.
      if (!reduce) {
        _load(bundle);
      } else {
        setState(() {
          _failed = true;
          _ink?.image.dispose();
          _ink = null;
        });
      }
    }
    final allow =
        !reduce &&
        TickerMode.of(context) &&
        ModalRoute.of(context)?.isCurrent != false;
    if (allow != _allowed) {
      _allowed = allow;
      _sync();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pause?.cancel();
    _fill.dispose();
    _ink?.image.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: Semantics(
        image: true,
        label: 'ميرا',
        child: DecoratedBox(
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Color(0x198e436c),
                blurRadius: 12,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: ClipOval(
            child: _ink == null || _failed
                ? Image.asset(
                    _logoPath,
                    fit: BoxFit.contain,
                    excludeFromSemantics: true,
                    errorBuilder: (_, __, ___) => Padding(
                      padding: const EdgeInsets.all(18),
                      child: Image.asset(
                        'assets/images/mira_logo_icon.png',
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) =>
                            const Icon(Icons.spa, color: AppColors.primary),
                      ),
                    ),
                  )
                : CustomPaint(painter: _MarkPainter(_ink!, _fill, _allowed)),
          ),
        ),
      ),
    );
  }
}

class _MarkPainter extends CustomPainter {
  _MarkPainter(this.ink, this.fill, this.animated) : super(repaint: fill);

  final _Ink ink;
  final Animation<double> fill;
  final bool animated;

  @override
  void paint(Canvas canvas, Size size) {
    // Fit visible bronze ink tightly in the disc (drop asset padding); keep MIRA unclipped.
    final scale = size.shortestSide * 0.54 / ink.radius;
    final dest = Rect.fromCenter(
      center: size.center(Offset.zero),
      width: ink.bounds.width * scale,
      height: ink.bounds.height * scale,
    );
    final brush = Paint()..filterQuality = FilterQuality.high;
    canvas.drawImageRect(ink.image, ink.bounds, dest, brush);
    if (!animated || fill.value <= 0) return;
    final band = dest.height * 0.10;
    final y =
        dest.bottom +
        band -
        Curves.easeInOutSine.transform(fill.value) * (dest.height + 2 * band);
    canvas.saveLayer(dest, Paint());
    canvas.drawImageRect(
      ink.image,
      ink.bounds,
      dest,
      Paint()
        ..filterQuality = FilterQuality.high
        ..colorFilter = const ColorFilter.mode(
          Color(0xff805226),
          BlendMode.screen,
        ),
    );
    canvas.drawRect(
      dest,
      Paint()
        ..blendMode = BlendMode.dstIn
        ..shader = ui.Gradient.linear(
          Offset(0, y - band),
          Offset(0, y + band),
          const [Color(0x00ffffff), Color(0xadffffff)],
          const [0, 1],
        ),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_MarkPainter old) =>
      old.ink != ink || old.fill != fill || old.animated != animated;
}
