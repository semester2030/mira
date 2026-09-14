import '../contracts/face_advisor_context.dart';

/// Client route decision for Face contextual Ask Mira (9I).
enum FaceAdvisorClientRoute {
  /// POST /advisor/chat with face context (canonical Evidence Envelope path).
  advisorFaceChat,

  /// Legacy MCE consultation (non-face / fallback).
  mceConsultation,
}

abstract final class FaceAdvisorRouteDecision {
  /// When Face context is present, always prefer frozen Advisor chat path.
  /// Face Result Mirror already gates the UX that assembles this context.
  static FaceAdvisorClientRoute decide({
    required FaceAdvisorContext? faceContext,
  }) {
    if (faceContext != null && faceContext.analysisId.isNotEmpty) {
      return FaceAdvisorClientRoute.advisorFaceChat;
    }
    return FaceAdvisorClientRoute.mceConsultation;
  }
}
