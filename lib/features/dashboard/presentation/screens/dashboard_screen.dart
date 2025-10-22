import 'package:flutter/material.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/widgets/side_menu.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../skin_analysis/presentation/widgets/face_frame_overlay.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // بيانات وهمية كمثال، اربطها لاحقًا بمصادر البيانات الحقيقية
    final user = {
      'name': 'ميرا',
      'avatar': null,
    };
    final stats = [
      _StatData('عدد التحليلات', 27, AppColors.primary, Icons.analytics, 'تحليل جديد هذا الشهر', '/analysis'),
      _StatData('نقاط التميز', 120, AppColors.secondary, Icons.star_rounded, '+15 هذا الأسبوع', '/points'),
      _StatData('نصائح مخصصة', 8, AppColors.accent, Icons.lightbulb, 'تم تحديثها اليوم', '/tips'),
    ];
    final progress = 0.65; // نسبة التقدم في رحلة العناية
    final tip = '✨ نصيحة اليوم: احرصي على شرب 8 أكواب ماء يومياً للحفاظ على نضارة بشرتك!';

    return Scaffold(
      appBar: AppBar(
        title: const MirraLogo.small(),
        centerTitle: true,
        actions: [
          Builder(
            builder: (context) => IconButton(
              icon: const Icon(Icons.menu),
              onPressed: () => Scaffold.of(context).openEndDrawer(),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.notifications_none),
            onPressed: () {},
          ),
        ],
      ),
      endDrawer: const SideMenu(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundImage: user['avatar'] != null ? NetworkImage(user['avatar'] ?? '') : null,
                  child: user['avatar'] == null ? const Icon(Icons.person, size: 32) : null,
                ),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('مرحبًا، ${user['name'] ?? ''} 👋', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 4),
                    Text('نتمنى لك يومًا جميلاً وبشرة صحية!', style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () {
                Navigator.pushNamed(context, '/new-analysis');
              },
              child: const FaceFrameOverlay(),
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 140,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: stats.length,
                separatorBuilder: (_, __) => const SizedBox(width: 16),
                itemBuilder: (context, i) => _StatCard(data: stats[i]),
              ),
            ),
            const SizedBox(height: 32),
            Text('تقدمك في رحلة العناية', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Stack(
              alignment: Alignment.centerLeft,
              children: [
                Container(
                  height: 18,
                  decoration: BoxDecoration(
                    color: AppColors.accent.withOpacity(0.13),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                FractionallySizedBox(
                  widthFactor: progress,
                  child: Container(
                    height: 18,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [AppColors.primary, AppColors.secondary]),
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                Positioned.fill(
                  child: Center(
                    child: Text('${(progress * 100).toInt()}%', style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.accent.withOpacity(0.13),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: AppColors.accent.withOpacity(0.08), blurRadius: 12, offset: const Offset(0, 4)),
                ],
              ),
              child: Row(
                children: [
                  Icon(Icons.tips_and_updates, color: AppColors.accent, size: 32),
                  const SizedBox(width: 16),
                  Expanded(child: Text(tip, style: Theme.of(context).textTheme.bodyLarge)),
                ],
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _StatData {
  final String label;
  final int value;
  final Color color;
  final IconData icon;
  final String subtitle;
  final String route;
  _StatData(this.label, this.value, this.color, this.icon, this.subtitle, this.route);
}

class _StatCard extends StatelessWidget {
  final _StatData data;
  const _StatCard({required this.data});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        Navigator.pushNamed(context, data.route);
      },
      child: Container(
        width: 140,
        height: 160,
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
        decoration: BoxDecoration(
          color: data.color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(color: data.color.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, 4)),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(data.icon, color: data.color, size: 28),
            const SizedBox(height: 10),
            Text('${data.value}', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: data.color)),
            const SizedBox(height: 8),
            Flexible(
              child: Text(
                data.label,
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (data.subtitle.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                data.subtitle,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(color: data.color),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
