import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../domain/entities/consultation_entities.dart';
import '../consultation_api_endpoints.dart';

/// SSE client for MCE Phase 4 streaming responses.
class ConsultationStreamDataSource {
  final Dio _dio;

  ConsultationStreamDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<ConsultationTurn> sendMessageStream({
    required String sessionId,
    required String message,
    String? contextSnapshotId,
    void Function(String deltaText)? onDelta,
  }) async {
    final response = await _dio.post<ResponseBody>(
      '${ConsultationApiEndpoints.sessionMessages(sessionId)}/stream',
      data: {
        'message': message,
        if (contextSnapshotId != null && contextSnapshotId.isNotEmpty)
          'contextSnapshotId': contextSnapshotId,
      },
      options: Options(
        responseType: ResponseType.stream,
        headers: {'Accept': 'text/event-stream'},
        receiveTimeout: const Duration(seconds: 120),
      ),
    );

    final body = response.data;
    if (body == null) throw Exception('بث الاستشارة فارغ');

    final completer = Completer<ConsultationTurn>();
    var buffer = '';
    ConsultationTurn? finalTurn;

    await for (final chunk in body.stream) {
      buffer += utf8.decode(chunk);
      while (true) {
        final sep = buffer.indexOf('\n\n');
        if (sep < 0) break;
        final block = buffer.substring(0, sep);
        buffer = buffer.substring(sep + 2);
        final parsed = _parseSseBlock(block);
        if (parsed == null) continue;

        if (parsed.event == 'delta' && onDelta != null) {
          final text = parsed.data['text'] as String? ?? '';
          if (text.isNotEmpty) onDelta(text);
        } else if (parsed.event == 'done') {
          finalTurn = ConsultationTurn.fromJson(parsed.data);
        } else if (parsed.event == 'error') {
          final msg = parsed.data['message'] as String? ?? 'فشل البث';
          throw Exception(msg);
        }
      }
    }

    if (finalTurn != null) {
      completer.complete(finalTurn);
    } else if (!completer.isCompleted) {
      completer.completeError(Exception('انتهى البث دون إجابة كاملة'));
    }
    return completer.future;
  }

  _SseEvent? _parseSseBlock(String block) {
    var event = 'message';
    String? dataLine;
    for (final line in block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataLine = line.substring(5).trim();
      }
    }
    if (dataLine == null) return null;
    return _SseEvent(event: event, data: jsonDecode(dataLine) as Map<String, dynamic>);
  }
}

class _SseEvent {
  final String event;
  final Map<String, dynamic> data;

  const _SseEvent({required this.event, required this.data});
}
