import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/consultation/domain/dialogue_outbound.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/outfit_piece_art.dart';
import 'package:mirra/shared/widgets/mce/mce_display_text.dart';

void main() {
  test('illustrations stay packaged under fashion icons', () {
    expect(OutfitPieceArt.assetForLabel('فستان'), contains('illustrations'));
    expect(OutfitPieceArt.assetForLabel('حقيبة'), endsWith('.png'));
  });

  test('retry keeps clientMessageId (no free 429 bypass on client)', () {
    final first = DialogueOutbound.first(
      clientMessageId: 'c-rc14-retry',
      text: 'ما رأيك؟',
      attachmentIds: const [],
    );
    expect(first.retry().clientMessageId, 'c-rc14-retry');
  });

  test('display sanitize still strips technical markers', () {
    expect(MceDisplayText.sanitize('**عنابي**'), 'عنابي');
  });
}
