import '../../../../core/json/json_as_string.dart';

class ConsultationSession {
  final String id;
  final String? titleAr;
  final String? activeSnapshotId;
  final int turnCount;
  final List<String> suggestedStartersAr;

  const ConsultationSession({
    required this.id,
    this.titleAr,
    this.activeSnapshotId,
    this.turnCount = 0,
    this.suggestedStartersAr = const [],
  });

  factory ConsultationSession.fromJson(Map<String, dynamic> json) {
    return ConsultationSession(
      id: json['id'] as String? ?? '',
      titleAr: json['titleAr'] as String?,
      activeSnapshotId: json['activeSnapshotId'] as String?,
      turnCount: json['turnCount'] as int? ?? 0,
      suggestedStartersAr: (json['suggestedStartersAr'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }
}

class ConsultationMessage {
  final String id;
  final String role;
  final String contentAr;
  final bool blocked;
  final DateTime createdAt;
  final String? confidence;
  final String? intent;
  final List<MceCitedFact> citedFacts;
  final List<String> attachmentIds;
  final String? clientMessageId;
  final List<String> suggestedQuestionsAr;

  const ConsultationMessage({
    required this.id,
    required this.role,
    required this.contentAr,
    this.blocked = false,
    required this.createdAt,
    this.confidence,
    this.intent,
    this.citedFacts = const [],
    this.attachmentIds = const [],
    this.clientMessageId,
    this.suggestedQuestionsAr = const [],
  });

  factory ConsultationMessage.fromJson(Map<String, dynamic> json) {
    final payload = json['payload'];
    final payloadMap =
        payload is Map<String, dynamic> ? payload : const <String, dynamic>{};
    final confidenceRaw = json['confidence'] ?? payloadMap['confidence'];
    final intentRaw = json['intent'] ?? payloadMap['intent'];
    return ConsultationMessage(
      id: json['id'] as String? ?? '',
      role: json['role'] as String? ?? 'assistant',
      contentAr: json['contentAr'] as String? ?? '',
      blocked: json['blocked'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      confidence: confidenceRaw == null
          ? null
          : JsonAsString.confidenceLabel(confidenceRaw),
      intent: JsonAsString.optional(intentRaw),
      citedFacts: (json['citedFacts'] as List<dynamic>?)
              ?.map((e) => MceCitedFact.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      attachmentIds: (json['attachmentIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      clientMessageId: json['clientMessageId'] as String? ??
          JsonAsString.optional(payloadMap['clientMessageId']),
      suggestedQuestionsAr: (json['suggestedQuestionsAr'] as List<dynamic>? ??
              payloadMap['suggestedQuestionsAr'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }

  bool get isUser => role == 'user';
}

// Re-export for consultation feature consumers
class MceCitedFact {
  final String id;
  final String labelAr;
  final String valueAr;

  const MceCitedFact({
    required this.id,
    required this.labelAr,
    required this.valueAr,
  });

  factory MceCitedFact.fromJson(Map<String, dynamic> json) {
    return MceCitedFact(
      id: json['id'] as String? ?? '',
      labelAr: JsonAsString.required(json['labelAr']),
      valueAr: JsonAsString.required(json['valueAr']),
    );
  }
}

class ConsultationTurn {
  final ConsultationMessage userMessage;
  final ConsultationMessage assistantMessage;
  final ConsultationSession session;

  const ConsultationTurn({
    required this.userMessage,
    required this.assistantMessage,
    required this.session,
  });

  factory ConsultationTurn.fromJson(Map<String, dynamic> json) {
    return ConsultationTurn(
      userMessage: ConsultationMessage.fromJson(
        json['userMessage'] as Map<String, dynamic>? ?? {},
      ),
      assistantMessage: ConsultationMessage.fromJson(
        json['assistantMessage'] as Map<String, dynamic>? ?? {},
      ),
      session: ConsultationSession.fromJson(
        json['session'] as Map<String, dynamic>? ?? {},
      ),
    );
  }
}
