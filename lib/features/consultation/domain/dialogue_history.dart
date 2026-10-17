import 'dart:typed_data';

/// One stored chat image after a download attempt.
class DialogueImageSlot {
  final String attachmentId;
  final Uint8List? bytes;

  const DialogueImageSlot({required this.attachmentId, required this.bytes});

  bool get failed => bytes == null;
}

/// Downloads each attachment. A failure stays on that slot and does not stop the rest.
Future<List<DialogueImageSlot>> loadDialogueImages(
  List<String> attachmentIds,
  Future<Uint8List> Function(String attachmentId) download,
) async {
  final slots = <DialogueImageSlot>[];
  for (final id in attachmentIds) {
    try {
      slots.add(DialogueImageSlot(attachmentId: id, bytes: await download(id)));
    } catch (_) {
      slots.add(DialogueImageSlot(attachmentId: id, bytes: null));
    }
  }
  return slots;
}
