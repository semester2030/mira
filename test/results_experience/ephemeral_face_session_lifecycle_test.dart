import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/privacy/ephemeral_analysis_face_registry.dart';
import 'package:mirra/core/session/analysis_session.dart';
import 'package:mirra/features/face_analysis_experience/presentation/result/session/face_result_mirror_image_hold.dart';

void main() {
  late Directory tmp;

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('mira_face_ephemeral_');
    await AnalysisSession.releaseEphemeralFace();
    await EphemeralAnalysisFaceRegistry.releaseAll();
  });

  tearDown(() async {
    await AnalysisSession.releaseEphemeralFace();
    await EphemeralAnalysisFaceRegistry.releaseAll();
    if (await tmp.exists()) {
      await tmp.delete(recursive: true);
    }
  });

  test(
    'ONE canonical owner: AnalysisSession holds Perfect-input copy',
    () async {
      final source = File('${tmp.path}/perfect_input.jpg');
      await source.writeAsBytes(List<int>.filled(64, 7));

      final hold = await FaceResultMirrorImageHold.prepareFrom(source.path);
      expect(hold, isNotNull);
      expect(hold!.endsWith('.mira_9f_hold'), isTrue);
      expect(await File(hold).exists(), isTrue);

      AnalysisSession.setEphemeralFace(path: hold, width: 1200, height: 1680);
      expect(AnalysisSession.lastEphemeralFacePath, hold);
      expect(AnalysisSession.lastEphemeralFaceWidth, 1200);
      expect(AnalysisSession.lastEphemeralFaceHeight, 1680);
      expect(EphemeralAnalysisFaceRegistry.activeCount, 1);

      // Simulate post-success cleanup of Perfect input — hold must survive.
      await source.delete();
      expect(await File(hold).exists(), isTrue);
      expect(AnalysisSession.lastEphemeralFacePath, isNotNull);
    },
  );

  test('release at end of result session deletes hold only', () async {
    final source = File('${tmp.path}/capture.jpg');
    await source.writeAsBytes(List<int>.filled(32, 3));
    final hold = await FaceResultMirrorImageHold.prepareFrom(source.path);
    AnalysisSession.setEphemeralFace(path: hold!);

    await AnalysisSession.releaseEphemeralFace();
    expect(AnalysisSession.lastEphemeralFacePath, isNull);
    expect(await File(hold).exists(), isFalse);
    expect(EphemeralAnalysisFaceRegistry.activeCount, 0);
  });

  test('navigation path equals session owner path', () {
    AnalysisSession.setEphemeralFace(
      path: '/tmp/mira_face_aligned_1.jpg.mira_9f_hold',
      width: 800,
      height: 1000,
    );
    final routePath = AnalysisSession.lastEphemeralFacePath;
    expect(routePath, AnalysisSession.lastEphemeralFacePath);
    expect(routePath!.contains('.mira_9f_hold'), isTrue);
  });
}
