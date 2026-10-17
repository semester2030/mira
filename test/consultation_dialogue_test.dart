import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/consultation/domain/consultation_session_gate.dart';
import 'package:mirra/features/consultation/domain/dialogue_history.dart';
import 'package:mirra/features/consultation/domain/dialogue_outbound.dart';
import 'package:mirra/features/consultation/presentation/widgets/consultation_composer.dart';
import 'package:mirra/features/consultation/presentation/widgets/consultation_image_strip.dart';

void main() {
  final png = Uint8List.fromList(base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ));

  test('attachments wait for a real session id', () {
    expect(consultationSessionReady(markedReady: true, sessionId: null), isFalse);
    expect(consultationSessionReady(markedReady: true, sessionId: ''), isFalse);
    expect(consultationSessionReady(markedReady: true, sessionId: 'session-1'), isTrue);
  });

  test('older pages do not duplicate messages', () {
    final current = ['m3', 'm4'];
    final older = ['m2', 'm3'];
    expect(prependOlderMessages(older, current, (item) => item), ['m2', 'm3', 'm4']);
  });

  test('retry keeps the client id and does not append another user bubble', () {
    final first = DialogueOutbound.first(
      clientMessageId: 'c-1',
      text: 'هل الحقيبة تناسب الفستان؟',
      attachmentIds: const ['bag-1'],
    );
    final again = first.retry();
    expect(first.appendUserBubble, isTrue);
    expect(again.appendUserBubble, isFalse);
    expect(again.clientMessageId, 'c-1');
    expect(again.attachmentIds, ['bag-1']);
  });

  testWidgets('composer previews, removes, and shows upload retry', (tester) async {
    final controller = TextEditingController();
    var images = <ChatImageDraft>[
      ChatImageDraft(localId: 'a', bytes: png),
      ChatImageDraft(localId: 'b', bytes: png, status: 'failed', errorAr: 'تعذر الرفع'),
    ];
    String? removed;
    String? retried;

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) {
            return ConsultationComposer(
              controller: controller,
              images: images,
              maxImages: 3,
              onRemove: (id) => setState(() {
                removed = id;
                images = images.where((image) => image.localId != id).toList();
              }),
              onRetry: (id) => retried = id,
              onSend: () {},
            );
          },
        ),
      ),
    ));

    expect(find.byKey(const Key('chat_image_a')), findsOneWidget);
    expect(find.byKey(const Key('chat_image_retry_b')), findsOneWidget);
    await tester.tap(find.byKey(const Key('chat_image_remove_a')));
    await tester.pump();
    expect(removed, 'a');
    expect(find.byKey(const Key('chat_image_a')), findsNothing);
    await tester.tap(find.byKey(const Key('chat_image_retry_b')));
    expect(retried, 'b');
  });

  testWidgets('gallery pick is disabled at the configured maximum', (tester) async {
    final controller = TextEditingController();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ConsultationComposer(
          controller: controller,
          maxImages: 3,
          images: [
            ChatImageDraft(localId: '1', bytes: png),
            ChatImageDraft(localId: '2', bytes: png),
            ChatImageDraft(localId: '3', bytes: png),
          ],
          onRemove: (_) {},
          onRetry: (_) {},
          onPick: () {},
          onSend: () {},
        ),
      ),
    ));
    final button = tester.widget<IconButton>(find.byKey(const Key('consultation_pick_image')));
    expect(button.onPressed, isNull);
  });

  test('older messages keep a failure on the image that did not load', () async {
    final slots = await loadDialogueImages(['dress', 'bag'], (id) async {
      if (id == 'bag') throw Exception('missing');
      return png;
    });
    expect(slots.map((slot) => slot.attachmentId).toList(), ['dress', 'bag']);
    expect(slots[0].failed, isFalse);
    expect(slots[1].failed, isTrue);
  });

  testWidgets('each failed older image stays visible on its own', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: ConsultationImageStrip(
          slots: [
            DialogueImageSlot(attachmentId: 'dress', bytes: null),
            DialogueImageSlot(attachmentId: 'bag', bytes: null),
          ],
        ),
      ),
    ));
    expect(find.byKey(const Key('image-failed-dress')), findsOneWidget);
    expect(find.byKey(const Key('image-failed-bag')), findsOneWidget);
    expect(find.text('تعذر تحميل الصورة'), findsNWidgets(2));
  });
}
