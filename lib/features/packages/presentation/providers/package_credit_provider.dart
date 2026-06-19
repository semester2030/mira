import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../domain/entities/package_type.dart';
import '../../domain/entities/user_package.dart';
import '../../domain/services/package_credit_service.dart';

final packageCreditServiceProvider = FutureProvider<PackageCreditService>((ref) async {
  return PackageCreditService.create();
});

final userPackageProvider =
    AsyncNotifierProvider<UserPackageNotifier, UserPackage?>(UserPackageNotifier.new);

class UserPackageNotifier extends AsyncNotifier<UserPackage?> {
  @override
  Future<UserPackage?> build() async {
    if (!MiraFeatures.packagesEnabled) return null;
    final service = await ref.watch(packageCreditServiceProvider.future);
    return service.current;
  }

  Future<void> refresh() async {
    if (!MiraFeatures.packagesEnabled) {
      state = const AsyncData(null);
      return;
    }
    state = const AsyncLoading();
    state = AsyncData(await _service().then((s) => s.current));
  }

  Future<UserPackage> buyPackage(PackageType type) async {
    final service = await _service();
    final pkg = await service.buyPackage(type);
    state = AsyncData(pkg);
    return pkg;
  }

  Future<UserPackage> consumeSkinCredit() async {
    final service = await _service();
    final pkg = await service.consumeSkinCredit();
    state = AsyncData(pkg);
    return pkg;
  }

  Future<UserPackage> consumeSmartOutfitCredit() async {
    final service = await _service();
    final pkg = await service.consumeSmartOutfitCredit();
    state = AsyncData(pkg);
    return pkg;
  }

  Future<PackageCreditService> _service() =>
      ref.read(packageCreditServiceProvider.future);
}

/// Premium analysis gates — skin + smart outfit only; quick outfit stays free.
abstract final class PackageCreditGate {
  PackageCreditGate._();

  static bool get applies =>
      MiraFeatures.packagesEnabled && !AppSession.isGuest;

  static Future<bool> canAnalyzeSkin(WidgetRef ref) async {
    if (!applies) return true;
    final service = await ref.read(packageCreditServiceProvider.future);
    return service.hasSkinCredits();
  }

  static Future<bool> canAnalyzeSmartOutfit(WidgetRef ref) async {
    if (!applies) return true;
    final service = await ref.read(packageCreditServiceProvider.future);
    return service.hasSmartOutfitCredits();
  }

  static Future<bool> canAnalyzeSkinWithoutRef() async {
    if (!applies) return true;
    final service = await PackageCreditService.create();
    return service.hasSkinCredits();
  }

  static void showDepletedDialog(
    BuildContext context, {
    required String message,
  }) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('نفدت رصيدك'),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('لاحقاً')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pushNamed(context, AppRoutes.packageStore);
            },
            child: const Text('شراء باقة جديدة'),
          ),
        ],
      ),
    );
  }

  static Future<bool> ensureSkinCredits(BuildContext context, WidgetRef ref) async {
    if (!applies) return true;
    if (await canAnalyzeSkin(ref)) return true;
    if (!context.mounted) return false;
    showDepletedDialog(
      context,
      message: 'لا يوجد رصيد لتحليل البشرة. اشترِ باقة Starter أو Plus أو Elite.',
    );
    return false;
  }

  static Future<bool> ensureSmartOutfitCredits(
    BuildContext context,
    WidgetRef ref,
  ) async {
    if (!applies) return true;
    if (await canAnalyzeSmartOutfit(ref)) return true;
    if (!context.mounted) return false;
    showDepletedDialog(
      context,
      message: 'لا يوجد رصيد للتحليل الذكي المرتبط بالبشرة. الإطلالة السريعة ما زالت مجانية.',
    );
    return false;
  }

  static Future<bool> ensureSkinCreditsNav(BuildContext context) async {
    if (!applies) return true;
    if (await canAnalyzeSkinWithoutRef()) return true;
    if (!context.mounted) return false;
    showDepletedDialog(
      context,
      message: 'لا يوجد رصيد لتحليل البشرة. اشترِ باقة جديدة للمتابعة.',
    );
    return false;
  }
}
