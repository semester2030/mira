/// Phase 4D — Face styling recommendations (Flutter mirror of API).
///
/// Engine id: face-styling-reco-v1
library;

import 'canonical_face_model.dart';
import 'face_client_mirror_gate.dart';
import 'face_finding_engine.dart';
import 'face_shape_classifier.dart';

const faceRecommendationVersion = 'face-reco-v1';
const faceRecommendationEngineId = 'face-styling-reco-v1';

enum FaceRecommendationCategory {
  hairstyle,
  makeupContour,
  eyewear,
  accessories,
  educational,
}

class FaceRecommendationEvidence {
  final List<String> metricIds;
  final List<String> findingIds;
  final Map<String, Object> values;

  const FaceRecommendationEvidence({
    required this.metricIds,
    required this.findingIds,
    required this.values,
  });
}

class FaceRecommendation {
  final String id;
  final FaceRecommendationCategory category;
  final String titleAr;
  final String titleEn;
  final String bodyAr;
  final String bodyEn;
  final String reasonAr;
  final String reasonEn;
  final FaceRecommendationEvidence evidence;
  final int confidence;
  final int priority;
  final List<String> limitations;

  const FaceRecommendation({
    required this.id,
    required this.category,
    required this.titleAr,
    required this.titleEn,
    required this.bodyAr,
    required this.bodyEn,
    required this.reasonAr,
    required this.reasonEn,
    required this.evidence,
    required this.confidence,
    required this.priority,
    required this.limitations,
  });

  bool get cosmeticOnly => true;
  bool get productLockIn => false;
}

abstract final class FaceRecommendationEngine {
  FaceRecommendationEngine._();

  static const _cosmeticLimit =
      'Cosmetic styling guidance only — not a medical prescription or diagnosis.';
  static const _noProductLock =
      'No Perfect Corp / marketplace product lock-in in Phase 4D.';

  static List<FaceRecommendation> build({
    required CanonicalFaceModel model,
    required List<FaceFinding> findings,
  }) {
    FaceClientMirrorGate.assertMirrorAllowed('FaceRecommendationEngine');
    final out = <FaceRecommendation>[];
    final findingIds = findings.map((f) => f.id).toSet();

    out.add(
      const FaceRecommendation(
        id: 'edu_face_styling_disclaimer',
        category: FaceRecommendationCategory.educational,
        titleAr: 'طبيعة توصيات التنسيق',
        titleEn: 'About styling recommendations',
        bodyAr:
            'اقتراحات ميرا للشعر/المكياج/النظارات تجميلية وإرشادية من شكل الوجه الظاهر والقياسات المتاحة. لا تشخّص ولا تربط بمنتج إلزامي.',
        bodyEn:
            'Mira hairstyle/makeup/eyewear tips are cosmetic guidance from apparent face shape and available measurements. Not diagnostic; no mandatory product lock-in.',
        reasonAr: 'شفافية المنتج وثقة المستخدم.',
        reasonEn: 'Product transparency and user trust.',
        evidence: FaceRecommendationEvidence(
          metricIds: [],
          findingIds: [],
          values: {},
        ),
        confidence: 100,
        priority: 5,
        limitations: [_cosmeticLimit, _noProductLock],
      ),
    );

    final eligible = findings.where((f) => f.recommendationEligible).toList();
    final shapeFinding =
        eligible.where((f) => f.id.startsWith('face_shape_')).firstOrNull;
    final shapeId = shapeFinding != null
        ? _shapeIdFromFinding(shapeFinding.id)
        : null;

    if (shapeFinding != null && shapeId != null) {
      final labels = FaceShapeClassifier.labels(shapeId);
      final conf = _confFromFinding(shapeFinding);
      final evidence = FaceRecommendationEvidence(
        metricIds: [
          'faceShape',
          ...shapeFinding.metricIds.where((x) => x != 'faceShape'),
        ],
        findingIds: [shapeFinding.id],
        values: {'faceShape': shapeId.name},
      );

      final hair = _hairstyle(shapeId);
      out.add(
        FaceRecommendation(
          id: 'rec_hairstyle_${shapeId.name}',
          category: FaceRecommendationCategory.hairstyle,
          titleAr: hair.$1,
          titleEn: hair.$2,
          bodyAr: hair.$3,
          bodyEn: hair.$4,
          reasonAr: 'بناءً على شكل الوجه الظاهر: ${labels.$1}.',
          reasonEn: 'Based on apparent face shape: ${labels.$2}.',
          evidence: evidence,
          confidence: conf,
          priority: 20,
          limitations: [
            _cosmeticLimit,
            _noProductLock,
            ...shapeFinding.limitations.take(2),
          ],
        ),
      );

      final contour = _contour(shapeId);
      if (contour != null) {
        out.add(
          FaceRecommendation(
            id: 'rec_contour_${shapeId.name}',
            category: FaceRecommendationCategory.makeupContour,
            titleAr: contour.$1,
            titleEn: contour.$2,
            bodyAr: contour.$3,
            bodyEn: contour.$4,
            reasonAr: 'دليل الشكل: ${labels.$1}.',
            reasonEn: 'Shape evidence: ${labels.$2}.',
            evidence: evidence,
            confidence: conf,
            priority: 30,
            limitations: const [_cosmeticLimit, _noProductLock],
          ),
        );
      }

      final eyewear = _eyewear(shapeId);
      if (eyewear != null) {
        out.add(
          FaceRecommendation(
            id: 'rec_eyewear_${shapeId.name}',
            category: FaceRecommendationCategory.eyewear,
            titleAr: eyewear.$1,
            titleEn: eyewear.$2,
            bodyAr: eyewear.$3,
            bodyEn: eyewear.$4,
            reasonAr: 'دليل الشكل: ${labels.$1}.',
            reasonEn: 'Shape evidence: ${labels.$2}.',
            evidence: evidence,
            confidence: conf,
            priority: 40,
            limitations: const [_cosmeticLimit, _noProductLock],
          ),
        );
      }
    }

    for (final f in eligible) {
      if (f.id == 'elongated_vertical_proportion') {
        out.add(
          FaceRecommendation(
            id: 'rec_accessories_elongation',
            category: FaceRecommendationCategory.accessories,
            titleAr: 'إكسسوارات تُقرّب الطول الظاهر',
            titleEn: 'Accessories that soften elongation',
            bodyAr:
                'أقراط أعرض أفقياً أو قلائد متوسطة الطول قد تُوازن الإحساس بالطول — اختيار شخصي تجميلي.',
            bodyEn:
                'Wider earrings or mid-length necklaces may balance elongation — personal cosmetic choice.',
            reasonAr: f.detailAr,
            reasonEn: f.detailEn,
            evidence: FaceRecommendationEvidence(
              metricIds: f.metricIds,
              findingIds: [f.id],
              values: const {},
            ),
            confidence: _confFromFinding(f),
            priority: 45,
            limitations: const [_cosmeticLimit, _noProductLock],
          ),
        );
      }
      if (f.id == 'narrower_lower_face') {
        out.add(
          FaceRecommendation(
            id: 'rec_accessories_narrow_lower',
            category: FaceRecommendationCategory.accessories,
            titleAr: 'تفصيل يضيف عرضاً سفلياً خفيفاً',
            titleEn: 'Detail that adds soft lower width',
            bodyAr:
                'أقراط تتسع للأسفل أو طوق يلامس عظمة الترقوة قد يوازن الجزء السفلي الأضيق ظاهرياً.',
            bodyEn:
                'Earrings that widen downward or a collarbone necklace may balance an apparently narrower lower face.',
            reasonAr: f.detailAr,
            reasonEn: f.detailEn,
            evidence: FaceRecommendationEvidence(
              metricIds: f.metricIds,
              findingIds: [f.id],
              values: const {},
            ),
            confidence: _confFromFinding(f),
            priority: 46,
            limitations: const [_cosmeticLimit, _noProductLock],
          ),
        );
      }
      if (f.id == 'wider_lower_face') {
        out.add(
          FaceRecommendation(
            id: 'rec_accessories_wider_lower',
            category: FaceRecommendationCategory.accessories,
            titleAr: 'تفصيل يرفع الانتباه للأعلى',
            titleEn: 'Detail that lifts focus upward',
            bodyAr:
                'أقراط أعلى أو أقرب للوجه مع تجنّب قطع ثقيلة عند الفك قد يوازن العرض السفلي الظاهر.',
            bodyEn:
                'Higher-set earrings closer to the face, avoiding heavy jaw pieces, may balance apparent lower width.',
            reasonAr: f.detailAr,
            reasonEn: f.detailEn,
            evidence: FaceRecommendationEvidence(
              metricIds: f.metricIds,
              findingIds: [f.id],
              values: const {},
            ),
            confidence: _confFromFinding(f),
            priority: 46,
            limitations: const [_cosmeticLimit, _noProductLock],
          ),
        );
      }
      if (f.id == 'balanced_facial_thirds') {
        out.add(
          FaceRecommendation(
            id: 'rec_edu_balanced_thirds',
            category: FaceRecommendationCategory.educational,
            titleAr: 'توازن أثلاث جيد — حافظي على البساطة',
            titleEn: 'Balanced thirds — keep styling simple',
            bodyAr:
                'عندما تكون الأثلاث متوازنة ظاهرياً، المكياج الخفيف والقصّات غير المعقّدة غالباً تكفي.',
            bodyEn:
                'When thirds look balanced, light makeup and uncomplicated cuts usually suffice.',
            reasonAr: f.detailAr,
            reasonEn: f.detailEn,
            evidence: FaceRecommendationEvidence(
              metricIds: f.metricIds,
              findingIds: [f.id],
              values: const {},
            ),
            confidence: _confFromFinding(f),
            priority: 55,
            limitations: const [_cosmeticLimit, _noProductLock],
          ),
        );
      }
    }

    // Keep model param for API parity / future metric lookups.
    // ignore: unused_local_variable
    final _ = model;

    out.retainWhere((r) {
      if (r.category == FaceRecommendationCategory.educational &&
          r.evidence.findingIds.isEmpty) {
        return true;
      }
      if (r.evidence.findingIds.isEmpty && r.evidence.metricIds.isEmpty) {
        return r.category == FaceRecommendationCategory.educational;
      }
      return r.evidence.findingIds.every(findingIds.contains);
    });
    out.sort((a, b) => a.priority.compareTo(b.priority));
    return out;
  }

  static FaceShapeId? _shapeIdFromFinding(String findingId) {
    final m = RegExp(r'^face_shape_([a-z]+)$').firstMatch(findingId);
    if (m == null) return null;
    final name = m.group(1)!;
    return FaceShapeId.values.where((e) => e.name == name).firstOrNull;
  }

  static int _confFromFinding(FaceFinding f) {
    return switch (f.confidence) {
      'high' => 82,
      'medium' => 68,
      'low' => 52,
      _ => 0,
    };
  }

  static (String, String, String, String) _hairstyle(FaceShapeId id) =>
      switch (id) {
        FaceShapeId.oval => (
            'مرونة في قصّات الشعر',
            'Flexible hairstyle options',
            'الشكل البيضاوي الظاهري يتقبّل معظم الأطوال؛ جرّبي طبقات خفيفة حول الوجه لإبراز التوازن.',
            'An apparent oval shape suits most lengths; soft face-framing layers can highlight balance.',
          ),
        FaceShapeId.round => (
            'ارتفاع وطبقات لإطالة المظهر',
            'Height and layers for elongation',
            'أضيفي حجماً عند التاج وتجنّبي قصّات قصيرة جداً عند الخدين لإطالة المظهر الظاهري.',
            'Add crown volume and avoid very short cuts at the cheeks to lengthen the apparent look.',
          ),
        FaceShapeId.square => (
            'ليونة حول خط الفك',
            'Softness around the jawline',
            'طبقات متموجة أو انحناءات ناعمة حول الفك تخفّف الزوايا الظاهرة دون ادعاء طبي.',
            'Waves or soft bends around the jaw soften apparent angles — cosmetic tip only.',
          ),
        FaceShapeId.heart => (
            'توازن الجزء السفلي',
            'Balance the lower face',
            'أطوال تصل للذقن أو أطول مع طبقات سفلية تساعد على موازنة جبهة أعرض ظاهرياً.',
            'Chin-length or longer cuts with lower layers help balance an apparently wider forehead.',
          ),
        FaceShapeId.oblong => (
            'عرض جانبي خفيف',
            'Gentle lateral width',
            'تجنّبي الارتفاع الزائد عند التاج؛ طبقات جانبية أو انحناء عند الخدين تُقرّب النسب ظاهرياً.',
            'Avoid excess crown height; side layers or cheek curves can soften elongated proportions.',
          ),
        FaceShapeId.diamond => (
            'تخفيف عرض الوجنة الظاهر',
            'Softening apparent cheek width',
            'خصل أمامية ناعمة أو طول متوسط يقلّل التركيز على أوسع نقطة في الوجنة.',
            'Soft front pieces or mid-length styles reduce focus on the widest cheek point.',
          ),
        FaceShapeId.triangle => (
            'حجم علوي متوازن',
            'Balanced upper volume',
            'حجم خفيف عند الجبهة/التاج مع تجنّب كثافة زائدة عند الفك يوازن الجزء السفلي الأعراض ظاهرياً.',
            'Light crown/forehead volume while avoiding heavy jaw bulk balances an apparently wider lower face.',
          ),
      };

  static (String, String, String, String)? _contour(FaceShapeId id) =>
      switch (id) {
        FaceShapeId.oval => null,
        FaceShapeId.round => (
            'كنتور عمودي خفيف',
            'Soft vertical contour',
            'ظلال أغمق رقيقة على جانبي الوجه وإبراز عمودي خفيف يطيل المظهر — تجميلي فقط.',
            'Soft side shadow and a light vertical highlight can lengthen the look — cosmetic only.',
          ),
        FaceShapeId.oblong => (
            'كنتور أفقي لطيف',
            'Gentle horizontal contour',
            'إبراز على التفاحات وكنتور خفيف تحت عظمة الوجنة يقرّب الطول الظاهر دون مبالغة.',
            'Apple highlight with soft under-cheek contour can shorten the apparent length gently.',
          ),
        FaceShapeId.heart => (
            'تخفيف الجبهة وإبراز الذقن',
            'Soften forehead, lift chin',
            'كنتور خفيف على الصدغين وإبراز بسيط على الذقن يوازن النسب الظاهرة.',
            'Light temple contour and a soft chin highlight balance apparent proportions.',
          ),
        FaceShapeId.square => (
            'تدوير زوايا الفك الظاهر',
            'Softening apparent jaw corners',
            'دمج ناعم عند زوايا الفك بدل خطوط حادة يعطي مظهراً ألطف.',
            'Soft blending at jaw corners rather than hard lines creates a gentler look.',
          ),
        FaceShapeId.diamond => (
            'موازنة الوجنة',
            'Balancing the cheeks',
            'إبراز على الجبهة والذقن مع كنتور خفيف على قمة الوجنة يوزّع الانتباه.',
            'Forehead and chin highlight with soft cheekbone contour redistributes focus.',
          ),
        FaceShapeId.triangle => (
            'تضييق الجزء السفلي الظاهر',
            'Softening apparent lower width',
            'كنتور لطيف على جانبي الفك السفلي وإبراز علوي خفيف يوازن العرض الظاهر.',
            'Gentle lower-jaw contour with light upper highlight balances apparent width.',
          ),
      };

  static (String, String, String, String)? _eyewear(FaceShapeId id) =>
      switch (id) {
        FaceShapeId.round => (
            'إطارات بزوايا أوضح',
            'Frames with clearer angles',
            'إطارات مستطيلة أو بزوايا خفيفة تضيف تبايناً للوجه المستدير الظاهر.',
            'Rectangular or softly angled frames contrast an apparently round face.',
          ),
        FaceShapeId.square => (
            'إطارات منحنية',
            'Curved frames',
            'عدسات دائرية أو بيضاوية تليّن الزوايا الظاهرة حول الفك.',
            'Round or oval lenses soften apparent angles around the jaw.',
          ),
        FaceShapeId.heart => (
            'إطارات أخف في الأعلى',
            'Lighter upper frames',
            'إطارات أرفع عند الحافة العلوية أو بشكل قطة خفيف توازن الجبهة الأعراض ظاهرياً.',
            'Lighter top edges or soft cat-eye shapes balance an apparently wider forehead.',
          ),
        FaceShapeId.oblong => (
            'إطارات أعرض أفقياً',
            'Wider horizontal frames',
            'إطارات أعرض من منتصف الوجه تقلّل الإحساس بالطول الظاهر.',
            'Frames wider than mid-face reduce the sense of elongation.',
          ),
        _ => null,
      };
}
