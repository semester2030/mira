import 'dart:io';

import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
import '../../../../core/services/user_stats_service.dart';
import '../../../intelligence/data/mappers/mira_beauty_report_mapper.dart';
import '../../domain/image_quality/image_quality_evaluator.dart';
import '../../presentation/utils/face_image_processor.dart';
import '../models/skin_report_model.dart';

/// Calls NestJS `POST /ai/skin-analysis` — Mira Intelligence Layer response.
class SkinAnalysisApiDataSource {
  final Dio _dio;

  SkinAnalysisApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<SkinReportModel> analyzeAndSave({required String imagePath}) async {
    Object? lastError;
    File? alignedTemp;

    try {
      // Phase 2: quality gate BEFORE upload — no Perfect credits on fail.
      final gate = await SkinCaptureQualityGate.run(File(imagePath));
      final sourceForPrepare = gate.readyFile;
      if (sourceForPrepare.path != imagePath) {
        alignedTemp = sourceForPrepare;
      }

      for (var attempt = 0; attempt < 2; attempt++) {
        File? prepared;
        try {
          prepared = await FaceImageProcessor.prepareForAnalysis(
            sourceForPrepare,
            boostLevel: attempt,
          );

          final formMap = <String, dynamic>{
            'image': await MultipartFile.fromFile(
              prepared.path,
              filename: 'scan.jpg',
            ),
            // Operational Hardening — always send faceIntel with explicit runtime.
            'faceIntel': gate.faceIntelJson,
          };

          final response = await _dio.post<Map<String, dynamic>>(
            MiraApiEndpoints.skinAnalysis,
            data: FormData.fromMap(formMap),
            options: Options(
              sendTimeout: const Duration(seconds: 120),
              receiveTimeout: const Duration(seconds: 120),
            ),
          );

          final model = _parseResponse(response.data);
          await UserStatsService.recordSkinAnalysis();
          return model;
        } on DioException catch (e) {
          lastError = e;
          if (attempt == 0 && _shouldRetryOnDevice(e)) {
            continue;
          }
          rethrow;
        } catch (e) {
          lastError = e;
          rethrow;
        } finally {
          if (prepared != null && prepared.path != imagePath) {
            await TempImageCleanup.deleteIfExists(prepared.path);
          }
        }
      }

      throw lastError ?? Exception('تعذر إرسال الصورة');
    } on ImageQualityException {
      rethrow;
    } finally {
      if (alignedTemp != null) {
        await TempImageCleanup.deleteIfExists(alignedTemp.path);
      }
      await TempImageCleanup.deleteIfExists(imagePath);
    }
  }

  bool _shouldRetryOnDevice(DioException error) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return false;
    }

    final status = error.response?.statusCode;
    if (status != 400 && status != 500) return false;

    final message = _responseMessage(error.response?.data)?.toLowerCase() ?? '';
    return message.contains('face') ||
        message.contains('lighting') ||
        message.contains('youcam') ||
        message.contains('وجه') ||
        message.contains('إضاء');
  }

  String? _responseMessage(dynamic data) {
    if (data is! Map) return null;
    final message = data['message'];
    if (message is String) return message;
    if (message is List && message.isNotEmpty) {
      return message.first.toString();
    }
    return null;
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
