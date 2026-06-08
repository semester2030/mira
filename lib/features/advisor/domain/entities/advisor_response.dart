class AdvisorMessage {
  final String text;
  final bool isUser;
  final DateTime at;

  const AdvisorMessage({
    required this.text,
    required this.isUser,
    required this.at,
  });
}

class AdvisorResponse {
  final String answer;
  final List<String> suggestedQuestions;
  final String confidence;
  final String intent;
  final bool blocked;

  const AdvisorResponse({
    required this.answer,
    required this.suggestedQuestions,
    required this.confidence,
    required this.intent,
    this.blocked = false,
  });

  factory AdvisorResponse.fromJson(Map<String, dynamic> json) {
    return AdvisorResponse(
      answer: json['answer'] as String? ?? '',
      suggestedQuestions: (json['suggestedQuestions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      confidence: json['confidence'] as String? ?? 'medium',
      intent: json['intent'] as String? ?? 'general',
      blocked: json['blocked'] as bool? ?? false,
    );
  }
}
