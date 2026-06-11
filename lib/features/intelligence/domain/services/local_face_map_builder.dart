import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../skin_analysis/domain/services/skin_report_matrix.dart';
import '../constants/report_face_map_spec.dart';
import '../entities/face_health_map.dart';

/// Offline educational face map for guest / legacy reports.
abstract final class LocalFaceMapBuilder {
  LocalFaceMapBuilder._();

  static const _concernMeta = <String, ({String ar, String color})>{
    'pore': (ar: 'المسام', color: '#A855F7'),
    'moisture': (ar: 'الترطيب', color: '#3B82F6'),
    'oiliness': (ar: 'الدهون', color: '#F59E0B'),
    'redness': (ar: 'الاحمرار', color: '#EF4444'),
    'age_spot': (ar: 'التصبغات', color: '#D97706'),
    'wrinkle': (ar: 'التجاعيد', color: '#EC4899'),
    'acne': (ar: 'الحبوب', color: '#F97316'),
    'dark_circle': (ar: 'الهالات', color: '#7C3AED'),
    'texture': (ar: 'الملمس', color: '#10B981'),
  };

  static FaceHealthMap fromSkinReport(SkinReport report) {
    final scores = {
      for (final c in SkinReportMatrix.matrixScores(report)) c.id: c.score,
    };
    int ui(String id, int fallback) => scores[id] ?? fallback;

    final insights = <FaceHealthInsight>[];
    final overlays = <FaceHealthConcernOverlay>[];

    void addConcern({
      required String concernId,
      required int score,
      required String zoneNameAr,
    }) {
      final meta = _concernMeta[concernId];
      if (meta == null) return;

      overlays.add(FaceHealthConcernOverlay(
        concernId: concernId,
        labelAr: meta.ar,
        labelEn: concernId,
        globalScore: score,
        severity: score >= 70 ? 'mild' : score >= 55 ? 'moderate' : 'noticeable',
        zoneScores: const {},
        highlightZoneIds: const [],
        highlightColor: meta.color,
        hasRegionalData: false,
      ));

      if (score >= 58) return;
      final severity = score >= 50 ? 'بدرجة متوسطة' : 'بدرجة ملحوظة';
      insights.add(FaceHealthInsight(
        id: 'insight_$concernId',
        concernId: concernId,
        concernLabelAr: meta.ar,
        zoneIds: const [],
        zoneLabelAr: zoneNameAr,
        bodyAr:
            'بناءً على نتيجة ${meta.ar} $severity، تُبرز الخريطة المناطق الشائعة ارتباطاً — استرشاد تعليمي وليس تشخيصاً موضعياً.',
      ));
    }

    addConcern(
      concernId: 'pore',
      score: ui('pore', 100 - report.pores * 20),
      zoneNameAr: 'الأنف والخدين ووسط الجبهة',
    );
    addConcern(
      concernId: 'moisture',
      score: ui('moisture', report.hydration),
      zoneNameAr: 'الخدين والجبهة والذقن',
    );
    addConcern(
      concernId: 'oiliness',
      score: ui('oiliness', 100 - report.oiliness),
      zoneNameAr: 'منطقة T-Zone',
    );
    addConcern(
      concernId: 'redness',
      score: ui('redness', 100 - report.redness * 20),
      zoneNameAr: 'الخدين والأنف والذقن',
    );
    addConcern(
      concernId: 'age_spot',
      score: ui('age_spot', 100 - report.spots * 20),
      zoneNameAr: 'الخدين والجبهة وتحت العين',
    );
    addConcern(
      concernId: 'wrinkle',
      score: ui('wrinkle', 100 - report.wrinkles * 20),
      zoneNameAr: 'الجبهة وزوايا العين وخطوط الابتسامة',
    );
    addConcern(
      concernId: 'acne',
      score: ui('acne', 100 - report.acne * 20),
      zoneNameAr: 'الجبهة والخدين والذقن والفك',
    );
    addConcern(
      concernId: 'dark_circle',
      score: ui('dark_circle', _blend(report.hydration, report.wrinkles)),
      zoneNameAr: 'تحت العينين فقط',
    );
    addConcern(
      concernId: 'texture',
      score: ui('texture', 100 - report.pores * 15),
      zoneNameAr: 'الخدين والجبهة والذقن',
    );

    overlays.sort((a, b) {
      final ai = ReportFaceMapSpec.tabOrder.indexOf(a.concernId);
      final bi = ReportFaceMapSpec.tabOrder.indexOf(b.concernId);
      return (ai < 0 ? 99 : ai).compareTo(bi < 0 ? 99 : bi);
    });

    final weaker = overlays.where((o) => o.globalScore < 65).toList();
    final defaultId = weaker.isNotEmpty ? weaker.first.concernId : overlays.first.concernId;

    if (overlays.isEmpty) return FaceHealthMap.empty;

    return FaceHealthMap(
      enabled: true,
      confidence: 'low',
      confidenceLabelAr: 'استرشادي',
      mode: 'educational',
      titleAr: 'خريطة تحليل البشرة',
      subtitleAr: 'اختياري مؤشر — المناطق الملوّنة تتغيّر حسب المؤشر المختار',
      disclaimerAr: ReportFaceMapSpec.disclaimerAr,
      zones: _allZones(),
      insightCards: insights.take(4).toList(),
      concernOverlays: overlays,
      defaultConcernId: defaultId,
      markers: const [],
    );
  }

  static int _blend(int a, int b) => ((a + (100 - b * 20)) / 2).round();

  static List<FaceHealthZone> _allZones() {
    const zones = [
      ('forehead', 'الجبهة'),
      ('under_eyes_left', 'تحت العين اليسرى'),
      ('under_eyes_right', 'تحت العين اليمنى'),
      ('nose', 'الأنف'),
      ('cheeks_left', 'الخد الأيسر'),
      ('cheeks_right', 'الخد الأيمن'),
      ('chin', 'الذقن'),
      ('jawline', 'خط الفك'),
    ];

    return zones
        .map(
          (z) => FaceHealthZone(
            id: z.$1,
            labelAr: z.$2,
            highlight: false,
            highlightColor: '#C19EE0',
            concernIds: const [],
            source: 'educational',
          ),
        )
        .toList();
  }
}
