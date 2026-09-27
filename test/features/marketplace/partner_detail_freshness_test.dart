import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/domain/entities/partner_detail.dart';
import 'package:mirra/features/marketplace/domain/entities/partner_summary.dart';
import 'package:mirra/features/marketplace/presentation/screens/partner_detail_screen.dart';

void main() {
  testWidgets('store screen uses the fetched partner, including removed contact fields', (tester) async {
    final stale = _summary(name: 'قديم', phone: '050', url: 'https://old.example');
    final fresh = PartnerDetail(
      summary: _summary(name: 'جديد', phone: null, url: 'https://new.example'),
      products: const [],
      services: const [],
    );
    await tester.pumpWidget(
      MaterialApp(
        home: PartnerDetailScreen(
          partner: stale,
          loadDetail: (_) async => CatalogLoad(
            value: fresh,
            transport: CatalogTransport.server,
            contentMark: ContentMark.unmarked,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('جديد'), findsWidgets);
    expect(find.text('قديم'), findsNothing);
    expect(find.text('050'), findsNothing);
    expect(find.text('لا توجد وسيلة تواصل منشورة'), findsOneWidget);
    expect(find.text('زيارة المتجر'), findsOneWidget);
  });

  testWidgets('a failed store load can be retried', (tester) async {
    var calls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: PartnerDetailScreen(
          partner: _summary(name: 'متجر', phone: null, url: null),
          loadDetail: (_) async {
            calls++;
            if (calls == 1) return null;
            return CatalogLoad(
              value: PartnerDetail(
                summary: _summary(name: 'بعد إعادة المحاولة', phone: null, url: null),
                products: const [],
                services: const [],
              ),
              transport: CatalogTransport.server,
              contentMark: ContentMark.unmarked,
            );
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('تعذر تحميل البيانات'), findsOneWidget);
    await tester.tap(find.text('إعادة المحاولة'));
    await tester.pumpAndSettle();
    expect(find.text('بعد إعادة المحاولة'), findsWidgets);
  });
}

PartnerSummary _summary({required String name, required String? phone, required String? url}) {
  return PartnerSummary(
    id: 'partner-1',
    type: 'brand',
    nameAr: name,
    nameEn: name,
    city: 'الرياض',
    rating: 0,
    contactPhone: phone,
    storeUrl: url,
  );
}
