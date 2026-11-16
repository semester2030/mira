import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../domain/entities/consultation_entities.dart';
import '../consultation_api_endpoints.dart';

class ConsultationStreamException implements Exception {
  final String messageAr;
  const ConsultationStreamException(this.messageAr);
  @override
  String toString() => messageAr;
}

/// Keeps an unfinished UTF-8 character until the next chunk completes it.
class ConsultationUtf8Decoder {
  final _buffer = StringBuffer();
  late final ByteConversionSink _sink = utf8.decoder.startChunkedConversion(_Utf8TextSink(_buffer));
  var _closed = false;

  String add(List<int> chunk, {bool end = false}) {
    if (_closed) return '';
    final before = _buffer.length;
    try {
      if (chunk.isNotEmpty) _sink.add(chunk);
      if (end) {
        _sink.close();
        _closed = true;
      }
    } on FormatException {
      throw const ConsultationStreamException(
        'تعذر قراءة الرد العربي. أعيدي المحاولة بنفس الطلب.',
      );
    }
    return _buffer.toString().substring(before);
  }
}

class _Utf8TextSink implements Sink<String> {
  final StringBuffer buffer;

  _Utf8TextSink(this.buffer);

  @override
  void add(String data) => buffer.write(data);

  @override
  void close() {}
}

/// SSE client for consultation streaming responses.
class ConsultationStreamDataSource {
  final Dio _dio;

  ConsultationStreamDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<ConsultationTurn> sendMessageStream({
    required String sessionId,
    required String message,
    String? contextSnapshotId,
    List<String> attachmentIds = const [],
    String? clientMessageId,
    void Function(String deltaText)? onDelta,
  }) async {
    late final Response<ResponseBody> response;
    try {
      response = await _dio.post<ResponseBody>(
        '${ConsultationApiEndpoints.sessionMessages(sessionId)}/stream',
        data: {
          'message': message,
          if (contextSnapshotId != null && contextSnapshotId.isNotEmpty)
            'contextSnapshotId': contextSnapshotId,
          if (attachmentIds.isNotEmpty) 'attachmentIds': attachmentIds,
          if (clientMessageId != null && clientMessageId.isNotEmpty)
            'clientMessageId': clientMessageId,
        },
        options: Options(
          responseType: ResponseType.stream,
          headers: {'Accept': 'text/event-stream'},
          receiveTimeout: const Duration(seconds: 120),
          // Keep clientMessageId on the request for device log correlation.
          extra: {
            if (clientMessageId != null && clientMessageId.isNotEmpty)
              'clientMessageId': clientMessageId,
          },
        ),
      );
    } on DioException catch (error) {
      throw await _mapHttpFailure(error);
    }

    final body = response.data;
    if (body == null) throw Exception('بث الاستشارة فارغ');

    final completer = Completer<ConsultationTurn>();
    var buffer = '';
    ConsultationTurn? finalTurn;
    final decoder = ConsultationUtf8Decoder();

    await for (final chunk in body.stream) {
      buffer += decoder.add(chunk);
      final parsedTurn = _drainEvents(buffer, onDelta);
      buffer = parsedTurn.rest;
      finalTurn = parsedTurn.turn ?? finalTurn;
    }
    buffer += decoder.add(const [], end: true);
    final tail = _drainEvents(buffer, onDelta);
    buffer = tail.rest;
    finalTurn = tail.turn ?? finalTurn;
    if (buffer.trim().isNotEmpty && finalTurn == null) {
      throw const ConsultationStreamException(
        'انقطع الرد قبل اكتماله. أعيدي المحاولة بنفس الطلب.',
      );
    }

    if (finalTurn != null) {
      completer.complete(finalTurn);
    } else if (!completer.isCompleted) {
      completer.completeError(Exception('انتهى البث دون إجابة كاملة'));
    }
    return completer.future;
  }

  ({String rest, ConsultationTurn? turn}) _drainEvents(
    String buffer,
    void Function(String deltaText)? onDelta,
  ) {
    ConsultationTurn? turn;
    while (true) {
      final sep = _eventSeparator(buffer);
      if (sep < 0) break;
      final width = buffer.startsWith('\r\n\r\n', sep) ? 4 : 2;
      final block = buffer.substring(0, sep);
      buffer = buffer.substring(sep + width);
      final parsed = _parseSseBlock(block);
      if (parsed == null) continue;
      if (parsed.event == 'delta' && onDelta != null) {
        final text = parsed.data['text'] as String? ?? '';
        if (text.isNotEmpty) onDelta(text);
      } else if (parsed.event == 'done') {
        turn = ConsultationTurn.fromJson(parsed.data);
      } else if (parsed.event == 'error') {
        final msg = parsed.data['message'] as String? ?? 'تعذر إكمال الرد. أعيدي المحاولة.';
        throw ConsultationStreamException(msg);
      }
    }
    return (rest: buffer, turn: turn);
  }

  Future<ConsultationStreamException> _mapHttpFailure(DioException error) async {
    final status = error.response?.statusCode;
    final parsed = await _readErrorPayload(error.response?.data);
    final message = () {
      final fromMap = parsed?['message'] ?? parsed?['messageAr'];
      if (fromMap is String && fromMap.trim().isNotEmpty) return fromMap.trim();
      if (error.message != null && error.message!.contains('تعذر')) {
        return error.message!.trim();
      }
      if (status == 429) {
        return 'وصلتِ لحد الاستشارة اليوم. حاولي لاحقاً أو غداً.';
      }
      return 'تعذر إكمال الرد. أعيدي المحاولة بنفس الطلب.';
    }();
    // ignore: avoid_print
    print(
      'mira_consultation_stream_http status=$status '
      'clientMessageId=${error.requestOptions.extra['clientMessageId']} '
      'code=${parsed?['code']}',
    );
    return ConsultationStreamException(message);
  }

  Future<Map<String, dynamic>?> _readErrorPayload(Object? data) async {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    String? raw;
    if (data is ResponseBody) {
      raw = await utf8.decoder.bind(data.stream).join();
    } else if (data is List<int>) {
      raw = utf8.decode(data);
    } else if (data is String) {
      raw = data;
    }
    if (raw == null || raw.trim().isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
      if (decoded is String) return {'message': decoded};
    } catch (_) {
      return {'message': raw.trim()};
    }
    return null;
  }

  int _eventSeparator(String buffer) {
    final lf = buffer.indexOf('\n\n');
    final crlf = buffer.indexOf('\r\n\r\n');
    if (lf < 0) return crlf;
    if (crlf < 0) return lf;
    return lf < crlf ? lf : crlf;
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
