import '../../data/package_credit_storage.dart';
import '../entities/package_catalog.dart';
import '../entities/package_type.dart';
import '../entities/user_package.dart';

class PackageCreditException implements Exception {
  final String messageAr;
  const PackageCreditException(this.messageAr);

  @override
  String toString() => messageAr;
}

/// Credit package lifecycle — buy, validate, consume (deterministic, local-only).
class PackageCreditService {
  PackageCreditService(this._storage);

  final PackageCreditStorage _storage;
  UserPackage? _cached;

  static Future<PackageCreditService> create() async {
    final storage = await PackageCreditStorage.create();
    final service = PackageCreditService(storage);
    service._cached = storage.load();
    return service;
  }

  UserPackage? get current => _effective(_now());

  DateTime _now() => DateTime.now();

  UserPackage? _effective(DateTime now) {
    final pkg = _cached;
    if (pkg == null) return null;
    if (!pkg.isValidAt(now)) {
      return pkg.copyWith(isActive: false, skinCredits: 0, smartOutfitCredits: 0);
    }
    return pkg;
  }

  Future<UserPackage?> reload() async {
    _cached = _storage.load();
    return current;
  }

  Future<UserPackage> buyPackage(PackageType type, {DateTime? now}) async {
    final clock = now ?? _now();
    final entry = PackageCatalog.of(type);
    final newExpiry = clock.add(Duration(days: entry.validityDays));
    final existing = _effective(clock);

    final UserPackage next;
    if (existing != null && existing.isValidAt(clock)) {
      next = existing.copyWith(
        packageType: type,
        skinCredits: existing.skinCredits + entry.skinCredits,
        smartOutfitCredits: existing.smartOutfitCredits + entry.smartOutfitCredits,
        expiresAt: newExpiry.isAfter(existing.expiresAt) ? newExpiry : existing.expiresAt,
        isActive: true,
      );
    } else {
      next = UserPackage(
        packageType: type,
        skinCredits: entry.skinCredits,
        smartOutfitCredits: entry.smartOutfitCredits,
        purchasedAt: clock,
        expiresAt: newExpiry,
        isActive: true,
      );
    }

    await _persist(next);
    return next;
  }

  bool hasSkinCredits({DateTime? now}) {
    final pkg = _effective(now ?? _now());
    return pkg != null && pkg.hasSkinCreditsAt(now ?? _now());
  }

  bool hasSmartOutfitCredits({DateTime? now}) {
    final pkg = _effective(now ?? _now());
    return pkg != null && pkg.hasSmartOutfitCreditsAt(now ?? _now());
  }

  bool isExpired({DateTime? now}) {
    final pkg = _cached;
    if (pkg == null) return true;
    return pkg.isExpiredAt(now ?? _now());
  }

  bool validatePackage({DateTime? now}) {
    return _effective(now ?? _now()) != null;
  }

  Future<UserPackage> consumeSkinCredit({DateTime? now}) async {
    final clock = now ?? _now();
    final pkg = _requireActive(clock);
    if (pkg.skinCredits <= 0) {
      throw const PackageCreditException('نفد رصيد تحليلات البشرة');
    }
    final next = pkg.copyWith(skinCredits: pkg.skinCredits - 1);
    await _persist(next);
    return next;
  }

  Future<UserPackage> consumeSmartOutfitCredit({DateTime? now}) async {
    final clock = now ?? _now();
    final pkg = _requireActive(clock);
    if (pkg.smartOutfitCredits <= 0) {
      throw const PackageCreditException('نفد رصيد التحليل الذكي للإطلالة');
    }
    final next = pkg.copyWith(smartOutfitCredits: pkg.smartOutfitCredits - 1);
    await _persist(next);
    return next;
  }

  UserPackage _requireActive(DateTime now) {
    final pkg = _effective(now);
    if (pkg == null || !pkg.isValidAt(now)) {
      throw const PackageCreditException('انتهت صلاحية باقتك — اشترِ باقة جديدة');
    }
    return pkg;
  }

  Future<void> clear() async {
    _cached = null;
    await _storage.clear();
  }

  Future<void> _persist(UserPackage package) async {
    _cached = package;
    await _storage.save(package);
  }
}
