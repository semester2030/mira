/// Plans one consultation send so a retry keeps the same client id
/// and does not add a second user bubble.
class DialogueOutbound {
  final String clientMessageId;
  final String text;
  final List<String> attachmentIds;
  final bool appendUserBubble;

  const DialogueOutbound({
    required this.clientMessageId,
    required this.text,
    required this.attachmentIds,
    required this.appendUserBubble,
  });

  factory DialogueOutbound.first({
    required String clientMessageId,
    required String text,
    required List<String> attachmentIds,
  }) {
    return DialogueOutbound(
      clientMessageId: clientMessageId,
      text: text,
      attachmentIds: List.unmodifiable(attachmentIds),
      appendUserBubble: true,
    );
  }

  DialogueOutbound retry() {
    return DialogueOutbound(
      clientMessageId: clientMessageId,
      text: text,
      attachmentIds: attachmentIds,
      appendUserBubble: false,
    );
  }

  DialogueOutbound withAttachments(List<String> attachmentIds) {
    return DialogueOutbound(
      clientMessageId: clientMessageId,
      text: text,
      attachmentIds: List.unmodifiable(attachmentIds),
      appendUserBubble: appendUserBubble,
    );
  }
}
