// Home «اكتشفي عالم ميرا» — horizontal photographic circle row (Dar Car–style swipe).
// Keeps DiscoverLane ids, AppRoutes.discoverPresentation, and onLaneOpened.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/discover_catalog_query.dart';
import '../../data/lane_orb_assets.dart';

/// RTL visual order (right → left): أناقتك · جمالك · المجوهرات · مناسباتك · الهدايا · الأطفال.
const _lanes = <(String titleAr, DiscoverLane lane, String imageKey)>[
  ('أناقتك', DiscoverLane.elegance, 'elegance'),
  ('جمالك', DiscoverLane.beauty, 'beauty'),
  ('المجوهرات', DiscoverLane.jewelry, 'jewelry'),
  ('مناسباتك', DiscoverLane.occasions, 'occasions'),
  ('الهدايا', DiscoverLane.gifts, 'gifts'),
  ('الأطفال', DiscoverLane.children, 'children'),
];

const _gap = 12.0;
const _diameterFraction = 0.40;

class MiraWorldOrbitDiscover extends StatefulWidget {
  const MiraWorldOrbitDiscover({super.key, this.onLaneOpened});

  /// Test hook: reports Arabic title → lane id when a circle opens.
  final void Function(String titleAr, DiscoverLane lane)? onLaneOpened;

  @override
  State<MiraWorldOrbitDiscover> createState() => _MiraWorldOrbitDiscoverState();
}

class _MiraWorldOrbitDiscoverState extends State<MiraWorldOrbitDiscover> {
  final ScrollController _scroll = ScrollController();
  bool _opening = false;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

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
      // Finger-up + short settle; drag-cancel never reaches onTap.
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
            final w = c.maxWidth;
            // ~40% of available width → two full circles + clear third peek.
            final d = (w * _diameterFraction).clamp(112.0, 168.0);
            final font = (w * 0.041).clamp(14.0, 18.0).toDouble();
            final labelH = math.max(
              24.0,
              MediaQuery.textScalerOf(context).scale(font) * 1.55,
            );
            final stride = d + _gap;
            final rowH = d + 5 + labelH;

            return SizedBox(
              height: rowH,
              child: SingleChildScrollView(
                key: const PageStorageKey<String>('mira-world-lane-row'),
                controller: _scroll,
                scrollDirection: Axis.horizontal,
                primary: false,
                physics: _CircleSnapScrollPhysics(itemExtent: stride),
                child: Row(
                  children: [
                    for (var i = 0; i < _lanes.length; i++) ...[
                      if (i > 0) const SizedBox(width: _gap),
                      SizedBox(
                        width: d,
                        child: _Petal(
                          key: ValueKey('home-orb-${_lanes[i].$3}'),
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

/// Snaps to the nearest circle after the finger lifts (Dar Car card-row feel).
class _CircleSnapScrollPhysics extends ScrollPhysics {
  const _CircleSnapScrollPhysics({required this.itemExtent, super.parent});

  final double itemExtent;

  @override
  _CircleSnapScrollPhysics applyTo(ScrollPhysics? ancestor) {
    return _CircleSnapScrollPhysics(
      itemExtent: itemExtent,
      parent: buildParent(ancestor),
    );
  }

  double _targetPixels(ScrollMetrics position, double velocity) {
    final extent = itemExtent <= 0 ? 1.0 : itemExtent;
    final page = position.pixels / extent;
    final projected =
        page + (velocity.abs() < 180 ? 0.0 : velocity.sign * 0.35);
    final maxPage =
        ((position.maxScrollExtent + extent * 0.5) / extent).floor();
    final targetPage = projected.round().clamp(0, math.max(0, maxPage));
    return (targetPage * extent).clamp(
      position.minScrollExtent,
      position.maxScrollExtent,
    );
  }

  @override
  Simulation? createBallisticSimulation(
    ScrollMetrics position,
    double velocity,
  ) {
    final target = _targetPixels(position, velocity);
    if ((target - position.pixels).abs() < 0.5) {
      return super.createBallisticSimulation(position, velocity);
    }
    return ScrollSpringSimulation(
      spring,
      position.pixels,
      target,
      velocity,
      tolerance: toleranceFor(position),
    );
  }
}

class _Petal extends StatefulWidget {
  const _Petal({
    super.key,
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
            mainAxisSize: MainAxisSize.min,
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
                    alignment: Alignment.center,
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
