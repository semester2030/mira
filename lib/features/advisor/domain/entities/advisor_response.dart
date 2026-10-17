import 'dart:typed_data';

import '../../../consultation/domain/dialogue_history.dart';

class AdvisorMessage {
  final String text;
  final bool isUser;
  final DateTime at;
  final String? confidence;
  final List<MceCitedFact> citedFacts;
  final bool isStreaming;
  final List<Uint8List> images;
  final List<DialogueImageSlot> imageSlots;
  final List<String> attachmentIds;
  final String? clientMessageId;
  final String? id;
  final bool failed;

  const AdvisorMessage({
    required this.text,
    required this.isUser,
    required this.at,
    this.confidence,
    this.citedFacts = const [],
    this.isStreaming = false,
    this.images = const [],
    this.imageSlots = const [],
    this.attachmentIds = const [],
    this.clientMessageId,
    this.id,
    this.failed = false,
  });

  AdvisorMessage copyWith({
    String? text,
    bool? isUser,
    DateTime? at,
    String? confidence,
    List<MceCitedFact>? citedFacts,
    bool? isStreaming,
    List<Uint8List>? images,
    List<DialogueImageSlot>? imageSlots,
    List<String>? attachmentIds,
    String? clientMessageId,
    String? id,
    bool? failed,
  }) {
    return AdvisorMessage(
      text: text ?? this.text,
      isUser: isUser ?? this.isUser,
      at: at ?? this.at,
      confidence: confidence ?? this.confidence,
      citedFacts: citedFacts ?? this.citedFacts,
      isStreaming: isStreaming ?? this.isStreaming,
      images: images ?? this.images,
      imageSlots: imageSlots ?? this.imageSlots,
      attachmentIds: attachmentIds ?? this.attachmentIds,
      clientMessageId: clientMessageId ?? this.clientMessageId,
      id: id ?? this.id,
      failed: failed ?? this.failed,
    );
  }
}

/// Cited fact for citation chips in advisor UI.
class MceCitedFact {
  final String id;
  final String labelAr;
  final String valueAr;

  const MceCitedFact({
    required this.id,
    required this.labelAr,
    required this.valueAr,
  });
}

class AdvisorResponse {
  final String answer;
  final List<String> suggestedQuestions;
  final String confidence;
  final String intent;
  final bool blocked;
  final String? disclaimerAr;

  const AdvisorResponse({
    required this.answer,
    required this.suggestedQuestions,
    required this.confidence,
    required this.intent,
    this.blocked = false,
    this.disclaimerAr,
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
      disclaimerAr: json['disclaimerAr'] as String?,
    );
  }
}
