import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../skin_analysis/domain/services/skin_report_matrix.dart';
import '../entities/face_health_map.dart';

/// Offline mirror of backend `face-map-engine.ts` for guest / legacy.
abstract final class LocalFaceMapBuilder {
  LocalFaceMapBuilder._();

  static const _highlight = '#C19EE0';
  static const _disclaimer =
      'الخريطة التالية استرشادية وليست تشخيصاً مكانياً دقيقة — المناطق الملوّنة شائعة علمياً وليست «مشكلتك هنا بالضبط».';

  static const _concernMeta = <String, ({String ar, String en, String color})>{
    'oiliness': (ar: 'الدهون', en: 'Oiliness', color: '#F5A623'),
    'pore': (ar: 'المسام', en: 'Pores', color: '#9B59B6'),
    'moisture': (ar: 'الترطيب', en: 'Moisture', color: '#3498DB'),
    'redness': (ar: 'الاحمرار', en: 'Redness', color: '#E74C3C'),
    'age_spot': (ar: 'التصبغات', en: 'Spots', color: '#D35400'),
  };

  static FaceHealthMap fromSkinReport(SkinReport report) {
    final scores = {
      for (final c in SkinReportMatrix.matrixScores(report)) c.id: c.score,
    };
    int ui(String id, int fallback) => scores[id] ?? fallback;

    final insights = <FaceHealthInsight>[];
    final highlightIds = <String>{};
    final overlays = <FaceHealthConcernOverlay>[];

    void addRule({
      required String concernId,
      required String labelAr,
      required String zoneNameAr,
      required List<String> zoneIds,
      required int threshold,
      required int score,
    }) {
      final meta = _concernMeta[concernId];
      overlays.add(FaceHealthConcernOverlay(
        concernId: concernId,
        labelAr: meta?.ar ?? labelAr,
        labelEn: meta?.en ?? concernId,
        globalScore: score,
        severity: score >= 70 ? 'mild' : score >= 55 ? 'moderate' : 'noticeable',
        zoneScores: const {},
        highlightZoneIds: zoneIds,
        highlightColor: meta?.color ?? _highlight,
        hasRegionalData: false,
      ));

      if (score >= threshold) return;
      for (final z in zoneIds) {
        highlightIds.add(z);
      }
      final severity = score >= 50 ? 'بدرجة متوسطة' : 'بدرجة ملحوظة';
      insights.add(FaceHealthInsight(
        id: 'insight_$concernId',
        concernId: concernId,
        concernLabelAr: labelAr,
        zoneIds: zoneIds,
        zoneLabelAr: zoneNameAr,
        bodyAr:
            'بناءً على نتيجة $labelAr $severity، غالباً ما تظهر هذه المشكلة في $zoneNameAr — منطقة شائعة وليست تشخيصاً مؤكداً على وجهك.',
      ));
    }

    addRule(
      concernId: 'oiliness',
      labelAr: 'إفراز الدهون',
      zoneNameAr: 'T-Zone (الجبهة والأنف والذقن)',
      zoneIds: const ['t_zone', 'forehead', 'nose', 'chin'],
      threshold: 60,
      score: ui('oiliness', 100 - report.oiliness),
    );
    addRule(
      concernId: 'pore',
      labelAr: 'المسام',
      zoneNameAr: 'T-Zone (الأنف والذقن)',
      zoneIds: const ['t_zone', 'nose', 'chin'],
      threshold: 58,
      score: ui('pore', 100 - report.pores * 20),
    );
    addRule(
      concernId: 'moisture',
      labelAr: 'الترطيب',
      zoneNameAr: 'منطقة الخدين',
      zoneIds: const ['cheek_left', 'cheek_right'],
      threshold: 58,
      score: ui('moisture', report.hydration),
    );
    addRule(
      concernId: 'redness',
      labelAr: 'الاحمرار',
      zoneNameAr: 'منتصف الوجه والخدين',
      zoneIds: const ['cheek_left', 'cheek_right', 'nose'],
      threshold: 55,
      score: ui('redness', 100 - report.redness * 20),
    );
    addRule(
      concernId: 'age_spot',
      labelAr: 'التصبغات',
      zoneNameAr: 'الخدين والجبهة',
      zoneIds: const ['cheek_left', 'cheek_right', 'forehead'],
      threshold: 58,
      score: ui('age_spot', 100 - report.spots * 20),
    );

    overlays.sort((a, b) => a.globalScore.compareTo(b.globalScore));
    final defaultId = overlays.firstWhere(
      (o) => o.globalScore < 65,
      orElse: () => overlays.first,
    ).concernId;

    final cards = insights.take(4).toList();
    if (cards.isEmpty && overlays.isEmpty) return FaceHealthMap.empty;

    return FaceHealthMap(
      enabled: true,
      confidence: 'low',
      confidenceLabelAr: 'ثقة منخفضة — استرشادي',
      mode: 'educational',
      titleAr: 'خريطة تحليل البشرة',
      subtitleAr: 'استكشفي كل concern — المناطق الملوّنة شائعة علمياً',
      disclaimerAr: _disclaimer,
      zones: _buildZones(highlightIds),
      insightCards: cards,
      concernOverlays: overlays,
      defaultConcernId: defaultId,
      markers: const [],
    );
  }

  static List<FaceHealthZone> _buildZones(Set<String> highlightIds) {
    const base = [
      ('forehead', 'الجبهة'),
      ('under_eye', 'تحت العين'),
      ('cheek_left', 'الخد الأيسر'),
      ('cheek_right', 'الخد الأيمن'),
      ('nose', 'الأنف'),
      ('chin', 'الذقن'),
      ('jawline', 'خط الفك'),
    ];

    bool isHighlighted(String id) {
      if (highlightIds.contains(id)) return true;
      if (highlightIds.contains('t_zone') &&
          (id == 'forehead' || id == 'nose' || id == 'chin')) {
        return true;
      }
      return false;
    }

    final zones = base
        .map(
          (z) => FaceHealthZone(
            id: z.$1,
            labelAr: z.$2,
            highlight: isHighlighted(z.$1),
            highlightColor: _highlight,
            concernIds: const [],
            source: 'educational',
          ),
        )
        .toList();

    if (highlightIds.contains('t_zone')) {
      zones.add(const FaceHealthZone(
        id: 't_zone',
        labelAr: 'T-Zone',
        highlight: true,
        highlightColor: _highlight,
        concernIds: [],
        educationalNoteAr: 'منطقة T-Zone — شائعة للدهون والمسام',
        source: 'educational',
      ));
    }

    return zones;
  }
}
