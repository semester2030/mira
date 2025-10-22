import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/profile_entity.dart';
import '../blocs/profile_bloc.dart';
import '../blocs/profile_event.dart';
import '../blocs/profile_state.dart';
import '../services/profile_service.dart';
import 'edit_profile_screen.dart';
import 'change_password_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => ProfileService.createProfileBloc()..add(const LoadProfile()),
      child: const _ProfileScreenContent(),
    );
  }
}

class _ProfileScreenContent extends StatelessWidget {
  const _ProfileScreenContent();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ProfileBloc, ProfileState>(
      builder: (context, state) {
        if (state is ProfileLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        
        if (state is ProfileError) {
          return Scaffold(
            appBar: AppBar(title: const Text('الملف الشخصي')),
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(state.message),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      context.read<ProfileBloc>().add(const LoadProfile());
                    },
                    child: const Text('إعادة المحاولة'),
                  ),
                ],
              ),
            ),
          );
        }
        
        if (state is ProfileLoaded) {
          return _buildProfileContent(context, state.profile);
        }
        
        return const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        );
      },
    );
  }

  Widget _buildProfileContent(BuildContext context, ProfileEntity profile) {
    return Scaffold(
      appBar: AppBar(title: const Text('الملف الشخصي')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // صورة شخصية تفاعلية مع دائرة نقاط
            Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: profile.points / 200.0,
                  strokeWidth: 5,
                  backgroundColor: Colors.purple[50],
                  valueColor: const AlwaysStoppedAnimation(Colors.purple),
                ),
                GestureDetector(
                  onTap: () {
                    // TODO: تغيير الصورة
                  },
                  child: CircleAvatar(
                    radius: 48,
                    backgroundImage: profile.avatarUrl != null 
                        ? NetworkImage(profile.avatarUrl!) 
                        : null,
                    child: profile.avatarUrl == null
                        ? const Icon(Icons.person, size: 48, color: Colors.purple)
                        : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(profile.name, style: Theme.of(context).textTheme.titleLarge),
            Text(profile.email, style: Theme.of(context).textTheme.bodyMedium),
            if (profile.phone != null) 
              Text(profile.phone!, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            Chip(
              label: Text('المستوى: ${profile.level}'),
              avatar: const Icon(Icons.verified, color: Colors.amber),
              backgroundColor: Colors.purple[50],
            ),
            const SizedBox(height: 16),
            // إحصائيات سريعة
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _StatBox(icon: Icons.analytics, label: 'التحليلات', value: '${profile.analyses}'),
                _StatBox(icon: Icons.tips_and_updates, label: 'النصائح', value: '${profile.tips}'),
                _StatBox(icon: Icons.access_time, label: 'آخر نشاط', value: profile.lastActive),
              ],
            ),
            const SizedBox(height: 24),
            // إنجازات
            Align(
              alignment: Alignment.centerRight,
              child: Text('إنجازاتك', style: Theme.of(context).textTheme.titleMedium),
            ),
            const SizedBox(height: 8),
            ...profile.achievements.map((achievement) => ListTile(
              leading: const Icon(Icons.emoji_events, color: Colors.amber),
              title: Text(achievement.title),
              subtitle: Text('بتاريخ: ${achievement.achievedAt.day}/${achievement.achievedAt.month}/${achievement.achievedAt.year}'),
            )),
            const SizedBox(height: 24),
            // أزرار تفاعلية
            ElevatedButton.icon(
              icon: const Icon(Icons.edit),
              label: const Text('تعديل الملف الشخصي'),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EditProfileScreen(profile: profile),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.purple,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              icon: const Icon(Icons.lock_reset),
              label: const Text('تغيير كلمة المرور'),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const ChangePasswordScreen(),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              icon: const Icon(Icons.logout),
              label: const Text('تسجيل الخروج'),
              onPressed: () {
                _showLogoutDialog(context);
              },
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            ),
          ],
        ),
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('تسجيل الخروج'),
          content: const Text('هل أنت متأكد من رغبتك في تسجيل الخروج؟'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('إلغاء'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                context.read<ProfileBloc>().add(const Logout());
              },
              child: const Text('تسجيل الخروج'),
            ),
          ],
        );
      },
    );
  }
}

class _StatBox extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _StatBox({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: Colors.purple, size: 28),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        Text(label, style: Theme.of(context).textTheme.labelSmall),
      ],
    );
  }
}
