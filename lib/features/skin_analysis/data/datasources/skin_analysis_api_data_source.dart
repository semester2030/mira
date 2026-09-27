import 'dart:io';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
import '../../../../core/services/user_stats_service.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../core/config/mira_api_config.dart';
import '../../../face_analysis_experience/presentation/result/session/face_result_mirror_image_hold.dart';
import '../../../intelligence/data/mappers/mira_beauty_report_mapper.dart';
import '../../../results_experience/domain/perfect_mask_session.dart';
import '../../domain/image_quality/image_quality_evaluator.dart';
import '../../presentation/debug/mira_measure_trace.dart';
import '../../presentation/debug/skin_start_analysis_trace.dart';
import '../models/skin_report_model.dart';

/// Calls NestJS `POST /ai/skin-analysis` — Mira Intelligence Layer response.
class SkinAnalysisApiDataSource {
  final Dio _dio;

  SkinAnalysisApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  /// On success, promotes Perfect-input bytes into [AnalysisSession] ephemeral
  /// face hold, then deletes non-hold temps. On failure, retains [imagePath]
  /// for deterministic retry/recapture UX.
  Future<SkinReportModel> analyzeAndSave({
    required String imagePath,
    void Function()? onRemoteWaitStarted,
  }) async {
    File? alignedTemp;
    var succeeded = false;
    String? perfectInputPath;

    try {
      final gateT0 = MiraMeasureTrace.monoMs;
      MiraMeasureTrace.span('T5_QUALITY_GATE_BEGIN');
      final gate = await SkinCaptureQualityGate.run(File(imagePath));
      MiraMeasureTrace.span('T5_QUALITY_GATE_END', t0Ms: gateT0);
      final sourceForPrepare = gate.readyFile;
      perfectInputPath = sourceForPrepare.path;
      if (sourceForPrepare.path != imagePath) {
        alignedTemp = sourceForPrepare;
      }

      // ignore: avoid_print
      print(
        'FACE_EPHEMERAL stage=ANALYSIS_INPUT present=1 '
        'aligned=${alignedTemp != null} '
        'id=${AnalysisSession.lastEphemeralFaceId ?? "pending"}',
      );

      final encT0 = MiraMeasureTrace.monoMs;
      MiraMeasureTrace.span('T6_REQUEST_ENCODE_BEGIN');
      final formMap = <String, dynamic>{
        'image': await MultipartFile.fromFile(
          sourceForPrepare.path,
          filename: 'scan.jpg',
        ),
        'faceIntel': gate.faceIntelJson,
      };
      MiraMeasureTrace.span('T6_REQUEST_ENCODE_END', t0Ms: encT0);

      onRemoteWaitStarted?.call();
      SkinStartAnalysisTrace.mark('REQUEST_STARTED');
      SkinStartAnalysisTrace.mark(
        'REQUEST_URL_HOST',
        detail: Uri.tryParse(MiraApiConfig.baseUrl)?.host ?? 'unknown',
      );
      SkinStartAnalysisTrace.mark(
        'HD_ENDPOINT_REACHED',
        detail: MiraApiEndpoints.skinAnalysis,
      );
      final netT0 = MiraMeasureTrace.monoMs;
      MiraMeasureTrace.span('T7_NETWORK_POST_BEGIN');
      final response = await _dio.post<Map<String, dynamic>>(
        MiraApiEndpoints.skinAnalysis,
        data: FormData.fromMap(formMap),
        options: Options(
          receiveTimeout: const Duration(seconds: 180),
          sendTimeout: const Duration(seconds: 180),
        ),
      );
      // T8 send-body complete is NOT INSTRUMENTED precisely with Dio default;
      // T9 is response arrival (post returns).
      MiraMeasureTrace.span(
        'T9_NETWORK_RESPONSE',
        t0Ms: netT0,
        detail: 'status=${response.statusCode} T8=NOT_INSTRUMENTED',
      );
      SkinStartAnalysisTrace.httpStatus = response.statusCode;
      SkinStartAnalysisTrace.mark(
        'HTTP_STATUS',
        detail: '${response.statusCode}',
      );
      final parseT0 = MiraMeasureTrace.monoMs;
      MiraMeasureTrace.span('T10_PARSE_BEGIN');
      SkinStartAnalysisTrace.mark('RESULT_PARSED starting');

      final model = _parseResponse(response.data);
      SkinStartAnalysisTrace.mark('RESULT_PARSED ok');
      SkinStartAnalysisTrace.mark(
        'MASKS_MATERIALIZED',
        detail: AnalysisSession.lastPerfectMasks?.hasAnyMask == true
            ? 'yes'
            : 'none',
      );
      MiraMeasureTrace.span('T10_PARSE_END', t0Ms: parseT0);
      await UserStatsService.recordSkinAnalysis();

      // Promote Perfect-input image → session hold BEFORE any cleanup.
      await _promotePerfectInputToSessionHold(perfectInputPath);
      // ignore: avoid_print
      print(
        'FACE_EPHEMERAL stage=ANALYSIS_SUCCESS present='
        '${AnalysisSession.lastEphemeralFacePath != null ? 1 : 0} '
        'id=${AnalysisSession.lastEphemeralFaceId ?? "-"} '
        'dims=${AnalysisSession.lastEphemeralFaceWidth ?? "-"}'
        'x${AnalysisSession.lastEphemeralFaceHeight ?? "-"}',
      );

      succeeded = true;
      return model;
    } on ImageQualityException catch (e) {
      SkinStartAnalysisTrace.fail('IMAGE_QUALITY', e);
      rethrow;
    } on DioException catch (e) {
      SkinStartAnalysisTrace.httpStatus = e.response?.statusCode;
      SkinStartAnalysisTrace.fail(
        e.type == DioExceptionType.connectionError ||
                e.type == DioExceptionType.connectionTimeout
            ? 'BACKEND_REACHABLE'
            : 'HTTP_STATUS',
        e,
      );
      rethrow;
    } catch (e) {
      SkinStartAnalysisTrace.fail('REQUEST_OR_PARSE', e);
      rethrow;
    } finally {
      final hold = AnalysisSession.lastEphemeralFacePath;
      if (alignedTemp != null &&
          alignedTemp.path != imagePath &&
          alignedTemp.path != hold) {
        await TempImageCleanup.deleteIfExists(alignedTemp.path);
      }
      // Delete original capture after success — never the session hold.
      if (succeeded && imagePath != hold) {
        await TempImageCleanup.deleteIfExists(imagePath);
      }
    }
  }

  /// Copy Perfect-input file into a session-scoped hold owned by AnalysisSession.
  Future<void> _promotePerfectInputToSessionHold(
    String? perfectInputPath,
  ) async {
    if (perfectInputPath == null || perfectInputPath.isEmpty) return;
    final hold = await FaceResultMirrorImageHold.prepareFrom(perfectInputPath);
    if (hold == null) {
      // ignore: avoid_print
      print('FACE_EPHEMERAL stage=HOLD_CREATE present=0');
      return;
    }
    int? w;
    int? h;
    try {
      final bytes = await File(hold).readAsBytes();
      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      w = frame.image.width;
      h = frame.image.height;
      frame.image.dispose();
      codec.dispose();
    } catch (_) {
      // Dimensions optional for ownership; Face Explorer still loads bytes.
    }
    AnalysisSession.setEphemeralFace(path: hold, width: w, height: h);
  }

  SkinReportModel _parseResponse(Map<String, dynamic>? data) {
    if (data == null) {
      throw Exception('استجابة فارغة من الخادم');
    }

    final miraJson = data['miraReport'] as Map<String, dynamic>?;
    if (miraJson == null) {
      throw Exception('تنسيق تقرير ميرا غير صالح — Intelligence Layer مطلوب');
    }

    final miraReport = MiraBeautyReportMapper.fromJson(miraJson);
    final id = data['id'] as String?;
    final createdAtRaw = data['createdAt'] as String?;
    final createdAt =
        createdAtRaw != null ? DateTime.tryParse(createdAtRaw) : null;

    final report = MiraBeautyReportMapper.toSkinReport(
      miraReport,
      id: id,
      createdAt: createdAt ?? DateTime.now(),
    );

    // Session-only Perfect masks — never History.
    final rawMasks = data['ephemeralMasks'];
    final list = rawMasks is List ? List<dynamic>.from(rawMasks) : null;
    final masks = PerfectMaskSession.fromApiPayload(list);
    AnalysisSession.setPerfectMasks(masks);

    final keys = <String>{};
    var withBytes = 0;
    if (list != null) {
      for (final row in list) {
        if (row is! Map) continue;
        final m = Map<String, dynamic>.from(row);
        final ct = '${m['concernType'] ?? ''}';
        if (ct.isEmpty || ct == 'resize_image') continue;
        keys.add(ct);
        final b64 = m['maskBase64'];
        if (b64 is String && b64.isNotEmpty) withBytes++;
      }
    }
    AnalysisSession.recordMaskCreateProof(
      PerfectMaskCreateProof(
        endpoint: MiraApiEndpoints.skinAnalysis,
        rawPresent: list != null,
        rawCount: list?.length ?? 0,
        withBytesCount: withBytes,
        providerKeys: keys.toList()..sort(),
        sessionCreated: masks != null,
        skipReason: list == null
            ? 'ephemeralMasks_missing_from_response'
            : (list.isEmpty ? 'ephemeralMasks_empty' : null),
      ),
    );

    return SkinReportModel.fromEntity(report, miraReport: miraReport);
  }

  Future<List<SkinReportModel>> fetchHistory({int limit = 50}) async {
    final response = await _dio.get<List<dynamic>>(
      MiraApiEndpoints.skinHistory,
      queryParameters: {'limit': limit},
    );

    final list = response.data ?? [];
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      final miraJson = map['miraReport'] as Map<String, dynamic>;
      final miraReport = MiraBeautyReportMapper.fromJson(miraJson);
      final id = map['id'] as String;
      final createdAt = DateTime.tryParse(map['createdAt'] as String? ?? '');
      final report = MiraBeautyReportMapper.toSkinReport(
        miraReport,
        id: id,
        createdAt: createdAt,
      );
      return SkinReportModel.fromEntity(report, miraReport: miraReport);
    }).toList();
  }
}
