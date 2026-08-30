import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/advisor/data/datasources/advisor_api_data_source.dart';
import 'package:mirra/features/advisor/domain/entities/advisor_fashion_context.dart';

class _CaptureAdapter implements HttpClientAdapter {
  Map<String, dynamic>? lastBody;
  String? lastPath;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastPath = options.path;
    lastBody = Map<String, dynamic>.from(options.data as Map);
    return ResponseBody.fromString(
      '{"answer":"ok","suggestedQuestions":[],"confidence":"medium","intent":"fashion","blocked":false}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  test('AT-3 AdvisorApiDataSource posts fashion context to /advisor/chat', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    final adapter = _CaptureAdapter();
    dio.httpClientAdapter = adapter;
    final api = AdvisorApiDataSource(dio: dio);

    final fashion = AdvisorFashionContext(
      garments: const [
        AdvisorFashionGarmentFact(
          garmentId: 'garment:blouse:red',
          category: 'top',
          type: 'blouse',
          colors: ['red'],
        ),
        AdvisorFashionGarmentFact(
          garmentId: 'garment:skirt:yellow',
          category: 'bottom',
          type: 'skirt',
          colors: ['yellow'],
        ),
      ],
      outfitId: 'outfit:ry_wedding',
      occasion: 'wedding',
      preferenceTokens: const ['bold'],
      evidenceRefs: const ['ev_blouse_red', 'ev_skirt_yellow'],
    );

    await api.chat(
      message: 'وش رأيك بإطلالتي؟',
      fashion: fashion,
    );

    expect(adapter.lastPath, contains('advisor/chat'));
    expect(adapter.lastBody?['message'], 'وش رأيك بإطلالتي؟');
    final f = adapter.lastBody?['fashion'] as Map<String, dynamic>;
    expect(f['occasion'], 'wedding');
    expect(f['outfitId'], 'outfit:ry_wedding');
    expect((f['garments'] as List).length, 2);
    expect(f.containsKey('sourceType'), isFalse);
    expect(f.containsKey('claimLock'), isFalse);
    expect(f.containsKey('provenance'), isFalse);
  });
}
