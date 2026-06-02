import 'package:flutter/material.dart';

import '../theme/animations.dart';

/// Fade + slide-up with per-child delay — use on dashboard / result columns.
class StaggeredEntrance extends StatelessWidget {
  final List<Widget> children;
  final Duration itemDuration;
  final int staggerMs;
  final CrossAxisAlignment crossAxisAlignment;

  const StaggeredEntrance({
    super.key,
    required this.children,
    this.itemDuration = const Duration(milliseconds: 480),
    this.staggerMs = 70,
    this.crossAxisAlignment = CrossAxisAlignment.start,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: crossAxisAlignment,
      children: [
        for (var i = 0; i < children.length; i++)
          _StaggeredItem(
            index: i,
            staggerMs: staggerMs,
            duration: itemDuration,
            child: children[i],
          ),
      ],
    );
  }
}

class _StaggeredItem extends StatefulWidget {
  final int index;
  final int staggerMs;
  final Duration duration;
  final Widget child;

  const _StaggeredItem({
    required this.index,
    required this.staggerMs,
    required this.duration,
    required this.child,
  });

  @override
  State<_StaggeredItem> createState() => _StaggeredItemState();
}

class _StaggeredItemState extends State<_StaggeredItem>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacity;
  late Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _opacity = CurvedAnimation(parent: _controller, curve: AppAnimations.slowCurve);
    _offset = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: AppAnimations.slowCurve));

    Future<void>.delayed(Duration(milliseconds: widget.index * widget.staggerMs), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
    );
  }
}
