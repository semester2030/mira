import 'dart:ui';

/// AI fashion scores for catalog pieces.
class FashionPieceScores {
  final int luxury;
  final int formal;
  final int minimal;
  final int business;

  const FashionPieceScores({
    this.luxury = 0,
    this.formal = 0,
    this.minimal = 0,
    this.business = 0,
  });

  int scoreForArchetype(String archetype) {
    return switch (archetype) {
      'quiet_luxury' || 'old_money' => luxury,
      'business' => business,
      'minimal' => minimal,
      'evening' || 'wedding' => formal,
      _ => luxury,
    };
  }
}

/// Multi-angle asset paths for interactive product views.
class PieceAngles {
  final String front;
  final String? back;
  final String? angle45;
  final String? detail;
  final String? fabric;

  const PieceAngles({
    required this.front,
    this.back,
    this.angle45,
    this.detail,
    this.fabric,
  });

  String get primary => front;

  List<String> get available => [
        front,
        if (back != null) back!,
        if (angle45 != null) angle45!,
        if (detail != null) detail!,
        if (fabric != null) fabric!,
      ];
}

/// Three-stage AI prompt set per piece.
class PiecePrompts {
  final String generation;
  final String editing;
  final String backgroundRemoval;

  const PiecePrompts({
    required this.generation,
    required this.editing,
    required this.backgroundRemoval,
  });
}

/// Color entry with hex + perceptual spaces for matching.
class FashionColorEntry {
  final String id;
  final String name;
  final String nameAr;
  final String hex;
  final List<double> lab;
  final List<double> hsv;

  const FashionColorEntry({
    required this.id,
    required this.name,
    required this.nameAr,
    required this.hex,
    this.lab = const [],
    this.hsv = const [],
  });

  Color get color {
    final h = hex.replaceFirst('#', '');
    return Color(int.parse('FF$h', radix: 16));
  }
}
