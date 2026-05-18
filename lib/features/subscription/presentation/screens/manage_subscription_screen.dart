import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../data/repositories/subscription_repository_impl.dart';
import '../../domain/entities/subscription_status.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class ManageSubscriptionScreen extends StatefulWidget {
  const ManageSubscriptionScreen({super.key});

  @override
  State<ManageSubscriptionScreen> createState() => _ManageSubscriptionScreenState();
}

class _ManageSubscriptionScreenState extends State<ManageSubscriptionScreen> {
  final _repo = SubscriptionRepositoryImpl();
  late Future<SubscriptionStatus> _future;

  @override
  void initState() {
    super.initState();
    _future = _repo.getStatus();
  }

  Future<void> _activateDev() async {
    await _repo.activatePremiumDev();
    if (!mounted) return;
    setState(() => _future = _repo.getStatus());
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('تم تفعيل بريميوم (تطوير) ✨')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الاشتراك')),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: FutureBuilder<SubscriptionStatus>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snap.hasError) {
                return Center(child: Text(snap.error.toString()));
              }
              final s = snap.data!;

              return Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.isPremium ? 'ميرا بريميوم ✨' : 'الخطة المجانية',
                            style: AppTypography.headlineSmall,
                          ),
                          const SizedBox(height: 8),
                          Text('الحالة: ${s.status}', style: AppTypography.bodyMedium),
                          if (s.currentPeriodEnd != null)
                            Text(
                              'تنتهي: ${s.currentPeriodEnd!.day}/${s.currentPeriodEnd!.month}/${s.currentPeriodEnd!.year}',
                              style: AppTypography.bodySmall.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (!s.isPremium) ...[
                      const Text(
                        'الاشتراك عبر App Store قريباً. حالياً يمكنك الاشتراك من المتجر عند الإطلاق الرسمي.',
                        style: TextStyle(height: 1.5),
                      ),
                      const SizedBox(height: 16),
                      if (kDebugMode)
                        PremiumButton(
                          label: 'تفعيل بريميوم (تطوير فقط)',
                          onPressed: _activateDev,
                        ),
                    ] else
                      Text(
                        'شكراً لاشتراكك — استمتعي بتحليلات بلا حدود.',
                        style: AppTypography.bodyLarge.copyWith(height: 1.5),
                      ),
                    const Spacer(),
                    PremiumButton(
                      label: 'تم',
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
