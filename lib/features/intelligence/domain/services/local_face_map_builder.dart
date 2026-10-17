import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../constants/report_face_map_spec.dart';
import '../entities/face_health_map.dart';

/// Offline educational face map for guest / legacy reports.
///
/// @Deprecated Phase 4F — prefer server FaceHealthMap + sibling faceIntelligence.
/// See docs/architecture/local-face-map-builder-deprecation.md
@Deprecated(
  'Prefer server FaceHealthMap and MiraBeautyReport.faceIntelligence. '
  'See docs/architecture/local-face-map-builder-deprecation.md',
)
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
    // concernScores holds stored ui_score values. SkinReportMatrix.matrixScores
    // falls back to severity formulas when that map is empty; those derived
    // numbers are not measurements and are not copied onto overlays.
    int? measured(String id) {
      if (report.concernScores.containsKey(id)) {
        return _contractScore(report.concernScores[id]);
      }
      if (id == 'moisture') return _contractScore(report.hydration);
      return null;
    }

    final insights = <FaceHealthInsight>[];
    final overlays = <FaceHealthConcernOverlay>[];

    void addConcern({
      required String concernId,
      required int? score,
      required String zoneNameAr,
    }) {
      final meta = _concernMeta[concernId];
      if (meta == null) return;

      overlays.add(FaceHealthConcernOverlay(
        concernId: concernId,
        labelAr: meta.ar,
        labelEn: concernId,
        globalScore: score,
        severity: score == null
            ? 'unavailable'
            : score >= 70
                ? 'mild'
                : score >= 55
                    ? 'moderate'
                    : 'noticeable',
        zoneScores: const {},
        highlightZoneIds: const [],
        highlightColor: meta.color,
        hasRegionalData: false,
      ));

      if (score == null || score >= 58) return;
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
      score: measured('pore'),
      zoneNameAr: 'الأنف والخدين ووسط الجبهة',
    );
    addConcern(
      concernId: 'moisture',
      score: measured('moisture'),
      zoneNameAr: 'الخدين والجبهة والذقن',
    );
    addConcern(
      concernId: 'oiliness',
      score: measured('oiliness'),
      zoneNameAr: 'منطقة T-Zone',
    );
    addConcern(
      concernId: 'redness',
      score: measured('redness'),
      zoneNameAr: 'الخدين والأنف والذقن',
    );
    addConcern(
      concernId: 'age_spot',
      score: measured('age_spot'),
      zoneNameAr: 'الخدين والجبهة وتحت العين',
    );
    addConcern(
      concernId: 'wrinkle',
      score: measured('wrinkle'),
      zoneNameAr: 'الجبهة وزوايا العين وخطوط الابتسامة',
    );
    addConcern(
      concernId: 'acne',
      score: measured('acne'),
      zoneNameAr: 'الجبهة والخدين والذقن والفك',
    );
    addConcern(
      concernId: 'dark_circle',
      score: measured('dark_circle'),
      zoneNameAr: 'تحت العينين فقط',
    );
    addConcern(
      concernId: 'texture',
      score: measured('texture'),
      zoneNameAr: 'الخدين والجبهة والذقن',
    );

    overlays.sort((a, b) {
      final ai = ReportFaceMapSpec.tabOrder.indexOf(a.concernId);
      final bi = ReportFaceMapSpec.tabOrder.indexOf(b.concernId);
      return (ai < 0 ? 99 : ai).compareTo(bi < 0 ? 99 : bi);
    });

    final weaker = overlays.where((o) => o.globalScore != null && o.globalScore! < 65).toList();
    final defaultId = weaker.isNotEmpty ? weaker.first.concernId : overlays.first.concernId;

    if (overlays.isEmpty) return FaceHealthMap.empty;

    return FaceHealthMap(
      enabled: true,
      confidence: 'guided',
      confidenceLabelAr: ReportFaceMapSpec.confidenceBadgeAr,
      mode: 'educational',
      titleAr: ReportFaceMapSpec.titleAr,
      subtitleAr: ReportFaceMapSpec.subtitleAr,
      disclaimerAr: ReportFaceMapSpec.disclaimerAr,
      zones: _allZones(),
      insightCards: insights.take(4).toList(),
      concernOverlays: overlays,
      defaultConcernId: defaultId,
      markers: const [],
    );
  }

  static int? _contractScore(int? value) {
    if (value == null || value < 0 || value > 100) return null;
    return value;
  }

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
