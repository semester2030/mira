import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/packages/data/package_credit_storage.dart';
import 'package:mirra/features/packages/domain/entities/package_type.dart';
import 'package:mirra/features/packages/domain/services/package_credit_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<PackageCreditService> service() async {
    final storage = await PackageCreditStorage.create();
    await storage.clear();
    return PackageCreditService(storage);
  }

  test('buyPackage grants catalog credits', () async {
    final s = await service();
    final now = DateTime(2026, 1, 1);

    final pkg = await s.buyPackage(PackageType.starter, now: now);

    expect(pkg.skinCredits, 5);
    expect(pkg.smartOutfitCredits, 20);
    expect(pkg.isValidAt(now), isTrue);
    expect(s.hasSkinCredits(now: now), isTrue);
    expect(s.hasSmartOutfitCredits(now: now), isTrue);
  });

  test('buyPackage stacks credits on active package', () async {
    final s = await service();
    final now = DateTime(2026, 1, 1);

    await s.buyPackage(PackageType.starter, now: now);
    final stacked = await s.buyPackage(PackageType.plus, now: now.add(const Duration(days: 1)));

    expect(stacked.skinCredits, 5 + 20);
    expect(stacked.smartOutfitCredits, 20 + 100);
  });

  test('consumeSkinCredit decrements balance', () async {
    final s = await service();
    final now = DateTime(2026, 1, 1);
    await s.buyPackage(PackageType.starter, now: now);

    final after = await s.consumeSkinCredit(now: now);

    expect(after.skinCredits, 4);
    expect(after.smartOutfitCredits, 20);
  });

  test('consumeSmartOutfitCredit decrements balance', () async {
    final s = await service();
    final now = DateTime(2026, 1, 1);
    await s.buyPackage(PackageType.starter, now: now);

    final after = await s.consumeSmartOutfitCredit(now: now);

    expect(after.smartOutfitCredits, 19);
    expect(after.skinCredits, 5);
  });

  test('cannot consume below zero', () async {
    final s = await service();
    final now = DateTime(2026, 1, 1);
    await s.buyPackage(PackageType.starter, now: now);

    for (var i = 0; i < 5; i++) {
      await s.consumeSkinCredit(now: now);
    }

    expect(
      () => s.consumeSkinCredit(now: now),
      throwsA(isA<PackageCreditException>()),
    );
    expect(s.current?.skinCredits, 0);
  });

  test('expired package blocks consumption', () async {
    final s = await service();
    final purchased = DateTime(2026, 1, 1);
    await s.buyPackage(PackageType.starter, now: purchased);

    final afterExpiry = purchased.add(const Duration(days: 31));
    expect(s.hasSkinCredits(now: afterExpiry), isFalse);
    expect(
      () => s.consumeSkinCredit(now: afterExpiry),
      throwsA(isA<PackageCreditException>()),
    );
  });

  test('validatePackage false when no package', () async {
    final s = await service();
    expect(s.validatePackage(), isFalse);
  });

  test('elite catalog matches spec', () async {
    final s = await service();
    final now = DateTime(2026, 6, 1);
    final pkg = await s.buyPackage(PackageType.elite, now: now);

    expect(pkg.skinCredits, 50);
    expect(pkg.smartOutfitCredits, 300);
    expect(pkg.expiresAt, purchasedPlusDays(now, 180));
  });
}

DateTime purchasedPlusDays(DateTime start, int days) =>
    start.add(Duration(days: days));
