import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_core_platform_interface/src/pigeon/mocks.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:mirra/core/ai/mappers/skin_result_mapper.dart';
import 'package:mirra/core/ai/mocks/mock_skin_analysis_provider.dart';
import 'package:mirra/core/exceptions/vision_platform_exception.dart';
import 'package:mirra/core/face_gate/face_gate_result.dart';
import 'package:mirra/core/navigation/route_args.dart';
import 'package:mirra/core/services/guest_session_service.dart';
import 'package:mirra/core/utils/mira_api_error_message.dart';
import 'package:mirra/features/consultation/data/datasources/consultation_stream_data_source.dart';
import 'package:mirra/features/intelligence/domain/entities/mira_beauty_report.dart';
import 'package:mirra/features/intelligence/domain/entities/result_provenance.dart';
import 'package:mirra/features/intelligence/presentation/widgets/beauty_score_hero.dart';
import 'package:mirra/features/intelligence/presentation/widgets/mira_report_helpers.dart';
import 'package:mirra/features/intelligence/presentation/widgets/skin_age_comparison_card.dart';
import 'package:mirra/features/outfit_analysis/data/datasources/vision_api_data_source.dart';
import 'package:mirra/features/outfit_analysis/data/services/outfit_analysis_cache_service.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/canonical_garment.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_capture_validation.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_result_trust.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_capture_validator.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_intelligence_service.dart';
import 'package:mirra/features/outfit_analysis/presentation/providers/outfit_intelligence_notifier.dart';
import 'package:mirra/features/outfit_analysis/presentation/providers/outfit_intelligence_providers.dart';
import 'package:mirra/features/outfit_analysis/presentation/screens/occasion_select_screen.dart';
import 'package:mirra/features/outfit_analysis/presentation/widgets/outfit_untrusted_result_view.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/image_quality_evaluator.dart';
import 'package:mirra/features/skin_analysis/domain/services/skin_report_matrix.dart';
import 'package:mirra/features/skin_analysis/presentation/utils/face_image_processor.dart';
import 'package:mirra/shared/widgets/mce/mce_streaming_text.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mirra/core/ai/models/mira_occasion.dart';

final _log = <String, Object?>{};
late OutfitAnalysisCacheService _outfitCache;
late Object _emptyVisionError;
late String _emptyVisionMessage;

void _check(String id, bool pass, Object? actual) {
  _log[id] = {'pass': pass, 'actual': actual};
  expect(pass, isTrue, reason: '$id => $actual');
}

Future<File> _jpeg(img.Image image) async {
  final file = File('${Directory.systemTemp.path}/mira-rc3-${DateTime.now().microsecondsSinceEpoch}.jpg');
  await file.writeAsBytes(img.encodeJpg(image));
  addTearDown(file.delete);
  return file;
}

img.Image _solid(int width, int height, int red, int green, int blue) {
  final image = img.Image(width: width, height: height);
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      image.setPixelRgb(x, y, red, green, blue);
    }
  }
  return image;
}

MiraBeautyReport _withProvenance(MiraBeautyReport source, ResultProvenance provenance) {
  return MiraBeautyReport(
    version: source.version,
    scoreSchemaVersion: source.scoreSchemaVersion,
    spatialConfidence: source.spatialConfidence,
    overallBeautyScore: source.overallBeautyScore,
    overallScoreAvailable: source.overallScoreAvailable,
    displayScoreLabelAr: source.displayScoreLabelAr,
    displayScoreLabelEn: source.displayScoreLabelEn,
    scoreSupportingAr: source.scoreSupportingAr,
    disclaimerAr: source.disclaimerAr,
    disclaimerEn: source.disclaimerEn,
    provenance: provenance,
    headlineAr: source.headlineAr,
    skinTypeAr: source.skinTypeAr,
    skinTypeEn: source.skinTypeEn,
    skinAgeEstimate: source.skinAgeEstimate,
    ageComparison: source.ageComparison,
    childSafety: source.childSafety,
    mainConcerns: source.mainConcerns,
    dailyRoutine: source.dailyRoutine,
    summaryAdviceAr: source.summaryAdviceAr,
    tipsAr: source.tipsAr,
    faceMapEnabled: source.faceMapEnabled,
    concernZonesSection: source.concernZonesSection,
    faceHealthMap: source.faceHealthMap,
    concernZonesNarrative: source.concernZonesNarrative,
    recommendedProducts: source.recommendedProducts,
    weeklyPlan: source.weeklyPlan,
    progressForecast: source.progressForecast,
    beautyJourney: source.beautyJourney,
    confidenceLayer: source.confidenceLayer,
  );
}

ResultProvenance _provenance({required bool isMock, required bool canDisplay, String? reason}) {
  return ResultProvenance(
    resultSource: isMock ? ResultSource.mock : ResultSource.providerMeasured,
    provider: isMock ? 'mock_skin' : 'perfect_corp',
    calculationVersion: 'rc3',
    confidence: isMock ? 0 : 70,
    confidenceLevel: isMock ? ProvenanceConfidenceLevel.unavailable : ProvenanceConfidenceLevel.medium,
    generatedAt: DateTime.utc(2026, 10, 16),
    limitations: const [],
    isMock: isMock,
    canDisplay: canDisplay,
    unavailableReason: reason,
  );
}

class _ReadyCapture extends OutfitCaptureValidator {
  @override
  Future<OutfitCaptureValidationResult> validateFile(File file) async {
    return OutfitCaptureValidationResult.ready;
  }

  @override
  Future<void> dispose() async {}
}

class _ScriptedVision extends VisionApiDataSource {
  _ScriptedVision(this._body) : super(dio: Dio());

  final Future<VisionOutfitAnalyzeResult?> Function() _body;
  int calls = 0;

  @override
  Future<VisionOutfitAnalyzeResult?> analyze({
    required String imagePath,
    required String occasionId,
    required String mode,
    Map<String, dynamic>? skinSnapshot,
    String locale = 'ar',
  }) async {
    calls += 1;
    return _body();
  }
}

class _BoomNotifier extends OutfitIntelligenceNotifier {
  _BoomNotifier(super.ref);

  void fail(Object error) {
    state = AsyncError(error, StackTrace.current);
  }
}

Future<void> _showOutfitError(WidgetTester tester, Object error) async {
  final container = ProviderContainer(
    overrides: [
      outfitIntelligenceNotifierProvider.overrideWith((ref) => _BoomNotifier(ref)),
    ],
  );
  addTearDown(container.dispose);
  final notifier = container.read(outfitIntelligenceNotifierProvider.notifier) as _BoomNotifier;
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        initialRoute: '/',
        onGenerateRoute: (settings) {
          return MaterialPageRoute<void>(
            settings: RouteSettings(
              name: settings.name,
              arguments: OutfitOccasionRouteArgs(
                imagePath: 'audit-fixture.jpg',
                mode: OutfitAnalysisMode.quick,
              ),
            ),
            builder: (_) => const OccasionSelectScreen(),
          );
        },
      ),
    ),
  );
  await tester.pump();
  ScaffoldMessenger.of(tester.element(find.byType(OccasionSelectScreen))).clearSnackBars();
  await tester.pump();
  notifier.fail(error);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    _outfitCache = OutfitAnalysisCacheService(await SharedPreferences.getInstance());
    setupFirebaseCoreMocks();
    await Firebase.initializeApp();
    await GuestSessionService.enter();
  });

  tearDownAll(() async {
    final file = File('audit-out/rc3-flutter.json');
    await file.parent.create(recursive: true);
    await file.writeAsString(const JsonEncoder.withIndent('  ').convert({
      'round': 'RC3',
      'paidCalls': 0,
      'checks': _log,
    }));
  });

  setUp(() {
    FaceImageProcessor.viewportAspectRatio = null;
  });

  test('undecodable image is rejected before a report', () async {
    final file = File('${Directory.systemTemp.path}/mira-rc3-bad.bin');
    await file.writeAsBytes(const [9, 9, 9, 9, 9, 9, 9, 9]);
    addTearDown(file.delete);
    final report = await ImageQualityEvaluator.evaluateFile(file);
    _check(
      'undecodable-image-blocked',
      report.verdict.name == 'blocked' && report.messageAr.contains('تعذر قراءة الصورة'),
      report.messageAr,
    );
  });

  test('rejected face blocks before provider numbers', () async {
    final image = _solid(32, 32, 120, 120, 120);
    final report = ImageQualityEvaluator.evaluateImage(
      image,
      faceGate: const FaceGateResult.rejected(
        reasonCode: 'no_face',
        messageAr: 'لم نرَ وجهًا في الصورة',
      ),
    );
    _check(
      'rejected-face-blocks',
      !report.mayProceedToProvider && report.messageAr == 'لم نرَ وجهًا في الصورة',
      {'verdict': report.verdict.name, 'message': report.messageAr},
    );
  });

  test('accepted face geometry can pass the quality mapper', () async {
    final image = img.Image(width: 640, height: 640);
    for (var y = 0; y < 640; y++) {
      for (var x = 0; x < 640; x++) {
        final band = ((x ~/ 4) + (y ~/ 4)).isEven ? 90 : 160;
        image.setPixelRgb(x, y, band, band, band);
      }
    }
    final report = ImageQualityEvaluator.evaluateImage(
      image,
      faceGate: const FaceGateResult.acceptedWithFace(
        faceBox: Rect.fromLTWH(160, 120, 280, 320),
        imageSize: Size(640, 640),
        faceCount: 1,
        faceAreaRatio: 0.22,
        headYawDegrees: 2,
        headPitchDegrees: 1,
        headRollDegrees: 0,
        centerOffsetXRatio: 0.02,
        centerOffsetYRatio: 0.02,
        eyesVisible: true,
        mouthVisible: true,
      ),
    );
    _check(
      'accepted-face-may-proceed',
      report.mayProceedToProvider,
      {'verdict': report.verdict.name, 'reasons': report.blockingReasons},
    );
  });

  test('exif orientation, mirror, and crop move a marker to the predeclared pixel', () async {
    final rotated = img.Image(width: 4, height: 2);
    rotated.setPixelRgb(0, 0, 220, 0, 0);
    rotated.exif.imageIfd.orientation = 6;
    final rotatedFile = await _jpeg(rotated);
    final rotatedBytes = await FaceImageProcessor.readOrientedJpegBytes(rotatedFile);
    final rotatedOut = img.decodeJpg(rotatedBytes)!;
    final rotatedRed = _firstRed(rotatedOut);
    // EXIF 6: stored (0,0) is the visual top-right. Display size becomes 2×4.
    _check('exif-rotate-90', rotatedRed == (x: 1, y: 0), {'pixel': {'x': rotatedRed?.x, 'y': rotatedRed?.y}, 'size': '${rotatedOut.width}x${rotatedOut.height}'});

    final mirrored = img.Image(width: 4, height: 2);
    mirrored.setPixelRgb(0, 0, 220, 0, 0);
    mirrored.exif.imageIfd.orientation = 2;
    final mirroredFile = await _jpeg(mirrored);
    final mirroredBytes = await FaceImageProcessor.readOrientedJpegBytes(mirroredFile);
    final mirroredOut = img.decodeJpg(mirroredBytes)!;
    final mirroredRed = _firstRed(mirroredOut);
    // EXIF 2: horizontal mirror. Stored (0,0) lands at (width-1, 0).
    _check('exif-mirror', mirroredRed == (x: 3, y: 0), {'pixel': {'x': mirroredRed?.x, 'y': mirroredRed?.y}});

    final wide = img.Image(width: 40, height: 20);
    wide.setPixelRgb(10, 5, 220, 0, 0);
    wide.setPixelRgb(0, 5, 0, 0, 220);
    final wideFile = await _jpeg(wide);
    final croppedBytes = await FaceImageProcessor.readOrientedJpegBytes(wideFile, targetAspectRatio: 1);
    final cropped = img.decodeJpg(croppedBytes)!;
    // Wider than tall, aspect 1: crop width 20 from x=10. Marker (10,5) becomes (0,5). Left edge is removed.
    _check(
      'center-crop',
      cropped.width == 20 && cropped.height == 20 && _firstRed(cropped) == (x: 0, y: 5) && !_hasBlue(cropped),
      {'size': '${cropped.width}x${cropped.height}', 'red': {'x': _firstRed(cropped)?.x, 'y': _firstRed(cropped)?.y}},
    );
  });

  test('face alignment keeps the face-center marker near the output center', () async {
    final image = _solid(200, 200, 20, 20, 20);
    for (var y = 98; y < 103; y++) {
      for (var x = 98; x < 103; x++) {
        image.setPixelRgb(x, y, 230, 0, 0);
      }
    }
    final source = await _jpeg(image);
    final aligned = await FaceImageProcessor.alignForAnalysis(
      source,
      faceBox: const Rect.fromLTWH(50, 50, 100, 100),
      imageSize: const Size(200, 200),
    );
    addTearDown(aligned.delete);
    final decoded = img.decodeJpg(await aligned.readAsBytes())!;
    final center = _redCentroid(decoded);
    final dx = (center.x - decoded.width / 2).abs();
    final dy = (center.y - decoded.height / 2).abs();
    // Crop origin rounds to 14, then the short side is raised to 1280. Center stays within 48px.
    _check(
      'mask-alignment-center',
      decoded.width >= 1280 && decoded.height >= 1280 && dx <= 48 && dy <= 48,
      {'size': '${decoded.width}x${decoded.height}', 'centroid': {'x': center.x, 'y': center.y}, 'dx': dx, 'dy': dy},
    );
  });

  test('alignment failure on corrupt bytes does not invent a crop', () async {
    final file = File('${Directory.systemTemp.path}/mira-rc3-corrupt.jpg');
    await file.writeAsBytes(const [1, 2, 3, 4]);
    addTearDown(file.delete);
    Object? thrown;
    try {
      await FaceImageProcessor.alignForAnalysis(
        file,
        faceBox: const Rect.fromLTWH(1, 1, 2, 2),
        imageSize: const Size(4, 4),
      );
    } catch (error) {
      thrown = error;
    }
    _check(
      'alignment-corrupt',
      thrown is RangeError && '$thrown'.contains('Not in inclusive range'),
      '$thrown',
    );
  });

  test('missing skin age uses 70 and a stored age does not', () {
    final missing = SkinReportMatrix.skinAge(SkinReport(
      skinType: 'عادية',
      score: 0,
      hydration: 100,
      oiliness: 0,
      pores: 0,
      wrinkles: 0,
      spots: 0,
      advice: '',
      concernScores: const {'moisture': 100},
    ));
    final stored = SkinReportMatrix.skinAge(SkinReport(
      skinType: 'عادية',
      score: 0,
      hydration: 100,
      oiliness: 0,
      pores: 0,
      wrinkles: 0,
      spots: 0,
      advice: '',
      skinAge: 28,
      concernScores: const {'moisture': 100},
    ));
    _check('radar-age-fallback', missing == 36 && stored == 28, {'missing': missing, 'stored': stored});
  });

  testWidgets('guest chain shows the generator number and hides a mock provenance', (tester) async {
    final bytes = List<int>.generate(64, (index) => index + 1);
    final pending = MockSkinAnalysisProvider().analyze(bytes);
    await tester.pump(const Duration(milliseconds: 1000));
    final generated = await pending;
    final mapped = SkinResultMapper.toReport(generated, createdAt: DateTime.utc(2026, 10, 16));
    final attached = attachMiraReport(mapped);
    final mira = resolveMiraReport(attached);

    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: Column(
            children: [
              BeautyScoreHero(report: mira),
              SkinAgeComparisonCard(
                comparison: mira.ageComparison,
                childSafety: mira.childSafety,
              ),
            ],
          ),
        ),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 1300));

    final scoreText = '${mira.overallBeautyScore}';
    final showsScore = find.text(scoreText).evaluate().isNotEmpty;
    final showsSimulation = find.textContaining('محاكاة').evaluate().isNotEmpty;
    final showsAgeHeadline = find.text(mira.ageComparison.summaryAr).evaluate().isNotEmpty;
    final showsSkinAge = mira.skinAgeEstimate != null &&
        find.textContaining('${mira.skinAgeEstimate}').evaluate().isNotEmpty;
    _check(
      'guest-numbers-visible-without-simulation-label',
      mira.provenance == null &&
          mira.canDisplayInProduction &&
          showsScore &&
          !showsSimulation &&
          showsAgeHeadline &&
          !showsSkinAge,
      {
        'provenance': mira.provenance == null ? 'null' : 'present',
        'canDisplay': mira.canDisplayInProduction,
        'score': mira.overallBeautyScore,
        'scoreVisible': showsScore,
        'simulationVisible': showsSimulation,
        'ageHeadline': mira.ageComparison.headlineAr,
        'ageSummary': mira.ageComparison.summaryAr,
        'ageSummaryVisible': showsAgeHeadline,
        'skinAgeVisible': showsSkinAge,
        'skinAge': mira.skinAgeEstimate,
        'guestFlag': GuestSessionService.isActive,
      },
    );

    final blocked = _withProvenance(
      mira,
      _provenance(isMock: true, canDisplay: true, reason: 'النتيجة محاكاة وليست للعرض.'),
    );
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: BeautyScoreHero(report: blocked))));
    await tester.pump();
    _check(
      'mock-provenance-hides-the-number',
      !blocked.canDisplayInProduction &&
          find.text('النتيجة محاكاة وليست للعرض.').evaluate().isNotEmpty &&
          find.text(scoreText).evaluate().isEmpty,
      blocked.canDisplayInProduction,
    );

    final hidden = _withProvenance(
      mira,
      _provenance(isMock: false, canDisplay: false, reason: 'النتيجة غير متاحة.'),
    );
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: BeautyScoreHero(report: hidden))));
    await tester.pump();
    _check(
      'can-display-false-hides-the-number',
      find.text('النتيجة غير متاحة.').evaluate().isNotEmpty && find.text(scoreText).evaluate().isEmpty,
      hidden.canDisplayInProduction,
    );
  });

  test('stream deltas replace the visible text and a short stream fails', () async {
    final deltas = <String>[];
    final dio = Dio()
      ..httpClientAdapter = _SseAdapter([
        utf8.encode('event: delta\ndata: {"text":"مسودة"}\n\n'),
        utf8.encode('event: delta\ndata: {"text":"الجواب النهائي"}\n\n'),
        utf8.encode('event: done\ndata: {"userMessage":{"id":"u","contentAr":"س","role":"user","createdAt":"2026-10-16T00:00:00.000Z"},"assistantMessage":{"id":"a","contentAr":"الجواب النهائي","role":"assistant","createdAt":"2026-10-16T00:00:00.000Z"},"session":{"id":"s"}}\n\n'),
      ]);
    final turn = await ConsultationStreamDataSource(dio: dio).sendMessageStream(
      sessionId: 's',
      message: 'سؤال',
      onDelta: deltas.add,
    );
    _check(
      'stream-deltas-are-replacements',
      deltas.join('|') == 'مسودة|الجواب النهائي' && turn.assistantMessage.contentAr == 'الجواب النهائي',
      deltas,
    );

    final short = Dio()..httpClientAdapter = _SseAdapter([utf8.encode('event: delta\ndata: {"text":"ناقص"}\n\n')]);
    Object? thrown;
    try {
      await ConsultationStreamDataSource(dio: short).sendMessageStream(sessionId: 's', message: 'سؤال');
    } catch (error) {
      thrown = error;
    }
    _check('incomplete-stream-errors', '$thrown'.contains('انتهى البث دون إجابة كاملة'), '$thrown');
  });

  testWidgets('the streaming widget shows the latest text only', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: MceStreamingText(text: 'مسودة', isStreaming: true)));
    expect(find.text('مسودة'), findsOneWidget);
    await tester.pumpWidget(const MaterialApp(home: MceStreamingText(text: 'الجواب النهائي', isStreaming: false)));
    await tester.pump();
    _check(
      'streaming-widget-replaces',
      find.text('مسودة').evaluate().isEmpty && find.text('الجواب النهائي').evaluate().isNotEmpty,
      'replaced',
    );
  });

  test('outfit service rejects an empty vision response and a missing photo', () async {
    final vision = _ScriptedVision(() async => null);
    final service = OutfitIntelligenceService(
      visionApi: vision,
      captureValidatorFactory: _ReadyCapture.new,
      cacheService: _outfitCache,
    );
    final photo = await _jpeg(_solid(8, 8, 80, 80, 80));
    Object? emptyError;
    try {
      await service.analyze(
        outfitImage: photo,
        occasion: MiraOccasion.casual,
        mode: OutfitAnalysisMode.quick,
      );
    } catch (error) {
      emptyError = error;
    }
    final thrown = emptyError;
    final emptyMessage = friendlyMiraError(thrown ?? StateError('missing'));
    _emptyVisionError = thrown ?? StateError('missing');
    _emptyVisionMessage = emptyMessage;
    _check(
      'empty-vision-response',
      thrown is VisionPlatformException &&
          vision.calls == 1 &&
          emptyMessage == 'تعذّر تحليل الإطلالة. أعيدي التقاط الصورة وحاولي مجددًا.',
      emptyMessage,
    );

    final missing = File('${Directory.systemTemp.path}/mira-rc3-absent.jpg');
    final invalidService = OutfitIntelligenceService(visionApi: vision);
    Object? invalidError;
    try {
      await invalidService.analyze(
        outfitImage: missing,
        occasion: MiraOccasion.casual,
        mode: OutfitAnalysisMode.quick,
      );
    } catch (error) {
      invalidError = error;
    }
    final invalidMessage = friendlyMiraError(invalidError!);
    _check('missing-photo-rejected', invalidMessage == 'لم نستلم صورة — أعيدي التقاط الإطلالة', invalidMessage);
  });

  testWidgets('outfit rejection text reaches the occasion screen', (tester) async {
    await _showOutfitError(tester, _emptyVisionError);
    _check('empty-vision-visible', find.text(_emptyVisionMessage).evaluate().isNotEmpty, _emptyVisionMessage);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 1));

    final quota = DioException(
      requestOptions: RequestOptions(path: '/vision'),
      type: DioExceptionType.badResponse,
      response: Response(
        requestOptions: RequestOptions(path: '/vision'),
        statusCode: 503,
        data: {'code': 'FASHN_QUOTA_EXCEEDED', 'message': 'quota'},
      ),
    );
    final quotaMessage = friendlyMiraError(quota);
    await _showOutfitError(tester, quota);
    final visible = tester.widgetList<Text>(find.byType(Text)).map((text) => text.data).whereType<String>().toList();
    _check(
      'provider-failure-visible',
      visible.contains(quotaMessage) && quotaMessage.contains('خدمة تحديد القطع غير متاحة'),
      visible,
    );

    final blocked = OutfitAnalysis(
      occasion: MiraOccasion.casual,
      clothingType: '',
      styleType: '',
      dominantColors: const [],
      compatibilityScore: 0,
      recommendedColors: const [],
      rejectedColors: const [],
      suggestedAccessories: const [],
      suggestedMakeup: '',
      explanation: '',
      confidence: 0,
      analysisGate: 'blocked',
    );
    final trust = OutfitResultTrustPolicy.evaluate(blocked);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: OutfitUntrustedResultView(trust: trust))));
    await tester.pump();
    _check(
      'blocked-outfit-screen',
      find.text('لم نتحقق من إطلالتك').evaluate().isNotEmpty &&
          find.text(OutfitResultTrustPolicy.blockedDefaultMessage).evaluate().isNotEmpty,
      trust.messageAr,
    );
  });
}

({int x, int y})? _firstRed(img.Image image) {
  for (var y = 0; y < image.height; y++) {
    for (var x = 0; x < image.width; x++) {
      final pixel = image.getPixel(x, y);
      if (pixel.r > 180 && pixel.g < 40 && pixel.b < 40) return (x: x, y: y);
    }
  }
  return null;
}

bool _hasBlue(img.Image image) {
  for (var y = 0; y < image.height; y++) {
    for (var x = 0; x < image.width; x++) {
      final pixel = image.getPixel(x, y);
      if (pixel.b > 180 && pixel.r < 40) return true;
    }
  }
  return false;
}

({double x, double y}) _redCentroid(img.Image image) {
  var count = 0;
  var sx = 0.0;
  var sy = 0.0;
  for (var y = 0; y < image.height; y++) {
    for (var x = 0; x < image.width; x++) {
      final pixel = image.getPixel(x, y);
      if (pixel.r > 180 && pixel.g < 80) {
        count += 1;
        sx += x;
        sy += y;
      }
    }
  }
  if (count == 0) return (x: -1, y: -1);
  return (x: sx / count, y: sy / count);
}

class _SseAdapter implements HttpClientAdapter {
  _SseAdapter(this.chunks);

  final List<List<int>> chunks;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    return ResponseBody(
      Stream.fromIterable(chunks.map(Uint8List.fromList)),
      200,
      headers: {Headers.contentTypeHeader: ['text/event-stream']},
    );
  }

  @override
  void close({bool force = false}) {}
}
