abstract final class ConsultationApiEndpoints {
  static String sessions() => '/consultation/sessions';
  static String sessionMessages(String sessionId) =>
      '/consultation/sessions/$sessionId/messages';
}
