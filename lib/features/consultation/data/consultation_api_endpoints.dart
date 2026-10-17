abstract final class ConsultationApiEndpoints {
  static String sessions() => '/consultation/sessions';
  static String limits() => '/consultation/limits';
  static String sessionMessages(String sessionId) =>
      '/consultation/sessions/$sessionId/messages';
  static String sessionAttachments(String sessionId) =>
      '/consultation/sessions/$sessionId/attachments';
  static String attachment(String attachmentId) =>
      '/consultation/attachments/$attachmentId';
}
