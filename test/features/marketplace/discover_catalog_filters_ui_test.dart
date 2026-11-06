import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_facets.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';

void main() {
  test('beauty partnerType clears hidden product filters even when lane is null', () {
    final q = const DiscoverCatalogQuery(
      partnerType: 'salon',
      colors: ['black'],
      sizes: ['m'],
      volumes: ['50ml'],
      inStock: true,
      placeModes: ['branch'],
    ).withoutInapplicableFilters();
    expect(q.colors, isEmpty);
    expect(q.sizes, isEmpty);
    expect(q.volumes, isEmpty);
    expect(q.inStock, isNull);
    expect(q.placeModes, ['branch']);
  });

  test('elegance lane clears service-only filters', () {
    final q = const DiscoverCatalogQuery(
      lane: DiscoverLane.elegance,
      placeModes: ['home'],
      branchIds: ['b1'],
      availableOn: '2026-11-10',
      durationMax: 60,
      colors: ['black'],
    ).withoutInapplicableFilters();
    expect(q.placeModes, isEmpty);
    expect(q.branchIds, isEmpty);
    expect(q.availableOn, isNull);
    expect(q.durationMax, isNull);
    expect(q.colors, ['black']);
  });

  test('facets parse volumes and stale selections', () {
    final facets = DiscoverCatalogFacets.fromJson({
      'variant.volume': [
        {'id': '50ml', 'count': 2, 'labelAr': '50 مل'},
      ],
      'variant.color': [
        {'id': 'black', 'count': 1, 'labelAr': 'أسود', 'swatchHex': '#111111'},
      ],
      'staleSelections': [
        {'field': 'variant.color', 'value': 'neon'},
      ],
    });
    expect(facets.volumes.single.id, '50ml');
    expect(facets.colors.single.swatchHex, '#111111');
    expect(facets.staleSelections.single.value, 'neon');
  });

  testWidgets('price range dialog validates min>max', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: TextButton(
                onPressed: () async {
                  final minCtrl = TextEditingController(text: '500');
                  final maxCtrl = TextEditingController(text: '200');
                  await showDialog<void>(
                    context: context,
                    builder: (dialogContext) {
                      return AlertDialog(
                        title: const Text('نطاق السعر (ريال)'),
                        content: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            TextField(controller: minCtrl, decoration: const InputDecoration(labelText: 'الحد الأدنى')),
                            TextField(controller: maxCtrl, decoration: const InputDecoration(labelText: 'الحد الأعلى')),
                          ],
                        ),
                        actions: [
                          TextButton(
                            onPressed: () {
                              final minVal = int.tryParse(minCtrl.text);
                              final maxVal = int.tryParse(maxCtrl.text);
                              final invalid = minVal != null && maxVal != null && minVal > maxVal;
                              Navigator.pop(dialogContext, invalid ? 'invalid' : 'ok');
                            },
                            child: const Text('تطبيق'),
                          ),
                        ],
                      );
                    },
                  );
                },
                child: const Text('open'),
              ),
            );
          },
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('نطاق السعر (ريال)'), findsOneWidget);
    await tester.tap(find.text('تطبيق'));
    await tester.pumpAndSettle();
  });
}
