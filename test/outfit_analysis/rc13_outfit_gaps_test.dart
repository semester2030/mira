import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/consultation/domain/dialogue_outbound.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/outfit_piece_art.dart';
import 'package:mirra/shared/widgets/mce/mce_display_text.dart';

void main() {
  test('illustrations directory is declared for packaging', () {
    expect(
      OutfitPieceArt.illustrationsRoot,
      'assets/icons/fashion/illustrations',
    );
    expect(OutfitPieceArt.assetForLabel('فستان'), endsWith('.png'));
  });

  test('display text strips markdown markers during/after stream', () {
    expect(
      MceDisplayText.sanitize('جرّبي **العنابي** مع الحذاء'),
      'جرّبي العنابي مع الحذاء',
    );
    expect(
      MceDisplayText.sanitize('رمز `MCE_LLM_FAILED` غير مطلوب'),
      isNot(contains('MCE_LLM_FAILED')),
    );
    expect(MceDisplayText.sanitize('### عنوان'), 'عنوان');
  });

  test('dialogue outbound retry keeps the same clientMessageId', () {
    final first = DialogueOutbound.first(
      clientMessageId: 'c-1792639982099619',
      text: 'ما رأيك؟',
      attachmentIds: const [],
    );
    final retry = first.retry();
    expect(retry.clientMessageId, first.clientMessageId);
    expect(retry.appendUserBubble, isFalse);
  });
}
