import 'package:dio/dio.dart';

import '../../../../core/config/mira_api_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../domain/entities/outfit_segment_map.dart';
import '../mappers/outfit_segment_map_mapper.dart';

/// Server-side pixel contour segmentation via Render → FASHN geometry + sharp.
class OutfitSegmentationApiDataSource {
  final Dio _dio;

  OutfitSegmentationApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<OutfitSegmentMap?> segment({required String imagePath}) async {
    if (!MiraApiConfig.useBackend) return null;

    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(imagePath, filename: 'outfit.jpg'),
    });

    final response = await _dio.post<Map<String, dynamic>>(
      MiraApiEndpoints.outfitSegmentation,
      data: formData,
      options: Options(
        sendTimeout: const Duration(seconds: 90),
        receiveTimeout: const Duration(seconds: 90),
      ),
    );

    final data = response.data;
    if (data == null) return null;
    final map = OutfitSegmentMapMapper.fromJson(data);
    if (map.regions.isEmpty) return null;
    return map;
  }
}
