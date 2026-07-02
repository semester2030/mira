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

  const ConsultationMessage({
    required this.id,
    required this.role,
    required this.contentAr,
    this.blocked = false,
    required this.createdAt,
    this.confidence,
    this.intent,
    this.citedFacts = const [],
  });

  factory ConsultationMessage.fromJson(Map<String, dynamic> json) {
    return ConsultationMessage(
      id: json['id'] as String? ?? '',
      role: json['role'] as String? ?? 'assistant',
      contentAr: json['contentAr'] as String? ?? '',
      blocked: json['blocked'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      confidence: json['confidence'] as String?,
      intent: json['intent'] as String?,
      citedFacts: (json['citedFacts'] as List<dynamic>?)
              ?.map((e) => MceCitedFact.fromJson(e as Map<String, dynamic>))
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
      labelAr: json['labelAr'] as String? ?? '',
      valueAr: json['valueAr'] as String? ?? '',
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
