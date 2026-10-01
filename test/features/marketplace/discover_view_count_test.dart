import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_view_count.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_visual_chrome.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/shared/theme/theme.dart';

void main() {
  test('late count does not attach to the next target and media switches do not rebind', () {
    final latch = DiscoverViewLatch();
    latch.bind('product', 'one', countingEnabled: false);
    final firstGeneration = latch.generation;
    latch.bind('product', 'one', countingEnabled: false);
    expect(latch.generation, firstGeneration);
    expect(latch.current.state, DiscoverViewState.disabled);
    expect(latch.current.count, isNull);
    final applied = latch.apply(DiscoverViewSnapshot(
      state: DiscoverViewState.available,
      targetKind: 'product',
      targetId: 'two',
      count: 4,
      generation: firstGeneration,
    ));
    expect(applied, isFalse);
    expect(latch.current.count, isNull);
    latch.bind('product', 'two', countingEnabled: true);
    expect(latch.current.state, DiscoverViewState.loading);
    expect(latch.apply(DiscoverViewSnapshot(
      state: DiscoverViewState.available,
      targetKind: 'product',
      targetId: 'two',
      count: 0,
      generation: latch.generation,
    )), isTrue);
    expect(latch.current.count, 0);
    var recordedViews = 0;
    expect(latch.apply(DiscoverViewSnapshot(
      state: DiscoverViewState.unavailable,
      targetKind: 'product',
      targetId: 'two',
      generation: latch.generation,
    )), isTrue);
    final generation = latch.generation;
    expect(latch.retry(), isTrue);
    expect(latch.generation, generation);
    expect(latch.current.state, DiscoverViewState.loading);
    expect(recordedViews, 0);
    expect(latch.current.count, isNull);
  });

  testWidgets('the eye stays without a zero count', (tester) async {
    Future<void> pump(DiscoverViewSnapshot snapshot) async {
      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: DiscoverVisualChrome(
            slide: const PresentationSlide(
              entityId: 'dress',
              partnerId: 'seller',
              title: 'فستان',
              partnerName: 'البائع',
              kindLabel: 'منتج',
              media: [],
            ),
            mediaCount: 2,
            mediaIndex: 1,
            showMute: false,
            muted: true,
            onBack: () {},
            onDetails: () {},
            onMute: () {},
            onBuy: () {},
            onUnavailable: (_) {},
            selectedCategory: 0,
            onCategory: (_) {},
            viewCount: snapshot,
            advertisementLabel: 'إعلان · المعلن: المعلن · الجهة: البائع',
          ),
        ),
      ));
    }

    await pump(const DiscoverViewSnapshot.disabled(targetKind: 'product', targetId: 'dress'));
    expect(find.bySemanticsLabel('المشاهدات غير مفعلة'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.text('—'), findsOneWidget);
    expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
    expect(find.text('إعلان · المعلن: المعلن · الجهة: البائع'), findsOneWidget);

    await pump(const DiscoverViewSnapshot(state: DiscoverViewState.unavailable, targetKind: 'product', targetId: 'dress'));
    expect(find.text('0'), findsNothing);
    expect(find.text('—'), findsWidgets);

    await pump(const DiscoverViewSnapshot(state: DiscoverViewState.available, targetKind: 'product', targetId: 'dress', count: 0));
    expect(find.text('0'), findsNothing);
    expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
  });
}
