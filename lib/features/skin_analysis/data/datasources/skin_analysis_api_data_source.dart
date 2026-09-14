import 'dart:io';

import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
import '../../../../core/services/user_stats_service.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../core/config/mira_api_config.dart';
import '../../../intelligence/data/mappers/mira_beauty_report_mapper.dart';
import '../../../results_experience/domain/perfect_mask_session.dart';
import '../../domain/image_quality/image_quality_evaluator.dart';
import '../../presentation/debug/skin_start_analysis_trace.dart';
import '../models/skin_report_model.dart';

/// Calls NestJS `POST /ai/skin-analysis` — Mira Intelligence Layer response.
class SkinAnalysisApiDataSource {
  final Dio _dio;

  SkinAnalysisApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  /// On success, deletes ephemeral prepared temps and the original capture path.
  /// On failure, retains [imagePath] for deterministic retry/recapture UX.
  Future<SkinReportModel> analyzeAndSave({
    required String imagePath,
    void Function()? onRemoteWaitStarted,
  }) async {
    File? alignedTemp;
    var succeeded = false;

    try {
      final gate = await SkinCaptureQualityGate.run(File(imagePath));
      final sourceForPrepare = gate.readyFile;
      if (sourceForPrepare.path != imagePath) {
        alignedTemp = sourceForPrepare;
      }

      final formMap = <String, dynamic>{
        'image': await MultipartFile.fromFile(
          sourceForPrepare.path,
          filename: 'scan.jpg',
        ),
        'faceIntel': gate.faceIntelJson,
      };

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
      final response = await _dio.post<Map<String, dynamic>>(
        MiraApiEndpoints.skinAnalysis,
        data: FormData.fromMap(formMap),
        options: Options(
          receiveTimeout: const Duration(seconds: 180),
          sendTimeout: const Duration(seconds: 180),
        ),
      );
      SkinStartAnalysisTrace.httpStatus = response.statusCode;
      SkinStartAnalysisTrace.mark(
        'HTTP_STATUS',
        detail: '${response.statusCode}',
      );
      SkinStartAnalysisTrace.mark('RESULT_PARSED starting');

      final model = _parseResponse(response.data);
      SkinStartAnalysisTrace.mark('RESULT_PARSED ok');
      SkinStartAnalysisTrace.mark(
        'MASKS_MATERIALIZED',
        detail: AnalysisSession.lastPerfectMasks?.hasAnyMask == true
            ? 'yes'
            : 'none',
      );
      await UserStatsService.recordSkinAnalysis();
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
      if (alignedTemp != null && alignedTemp.path != imagePath) {
        await TempImageCleanup.deleteIfExists(alignedTemp.path);
      }
      // Only delete the user capture after a successful analysis.
      if (succeeded) {
        await TempImageCleanup.deleteIfExists(imagePath);
      }
    }
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
