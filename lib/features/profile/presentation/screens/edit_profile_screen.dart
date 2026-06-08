import 'dart:io';

import 'package:flutter/material.dart';
import '../../../../core/utils/saudi_phone.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/profile_entity.dart';
import '../blocs/profile_bloc.dart';
import '../blocs/profile_event.dart';
import '../blocs/profile_state.dart';

class EditProfileScreen extends StatefulWidget {
  final ProfileEntity profile;

  const EditProfileScreen({super.key, required this.profile});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  int? _birthYear;
  String? _avatarUrl;
  String? _localAvatarPath;
  bool _savePending = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.profile.name);
    _birthYear = widget.profile.birthYear;
    _avatarUrl = widget.profile.avatarUrl;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _choosePhotoSource() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('من المعرض'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('التقاط صورة'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 85);
    if (file == null || !mounted) return;

    setState(() => _localAvatarPath = file.path);
    if (!mounted) return;
    context.read<ProfileBloc>().add(UpdateAvatar(file.path));
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    _savePending = true;
    final updated = widget.profile.copyWith(
      name: _nameController.text.trim(),
      birthYear: _birthYear,
    );
    context.read<ProfileBloc>().add(UpdateProfile(updated));
  }

  ImageProvider? get _avatarImage {
    if (_localAvatarPath != null) {
      return FileImage(File(_localAvatarPath!));
    }
    if (_avatarUrl != null) {
      return NetworkImage(_avatarUrl!);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'تعديل الملف الشخصي'),
      body: BlocConsumer<ProfileBloc, ProfileState>(
        listener: (context, state) {
          if (state is ProfileLoaded) {
            setState(() {
              _avatarUrl = state.profile.avatarUrl;
              _localAvatarPath = null;
            });
            if (_savePending) {
              _savePending = false;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('تم تحديث الملف الشخصي بنجاح')),
              );
              Navigator.pop(context);
            }
          } else if (state is ProfileError) {
            _savePending = false;
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.message)));
          }
        },
        builder: (context, state) {
          final updating = state is ProfileUpdating;
          final level = state is ProfileLoaded
              ? state.profile.level
              : (state is ProfileUpdating ? state.profile.level : widget.profile.level);

          return FloatingGradientBackground(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    PremiumCard(
                      child: Column(
                        children: [
                          GestureDetector(
                            onTap: updating ? null : _choosePhotoSource,
                            child: CircleAvatar(
                              radius: 48,
                              backgroundImage: _avatarImage,
                              backgroundColor: AppColors.primaryLight,
                              child: _avatarImage == null
                                  ? const Icon(Icons.person_rounded,
                                      size: 48, color: AppColors.primary)
                                  : null,
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: updating ? null : _choosePhotoSource,
                            child: const Text('تغيير الصورة'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    PremiumInputField(
                      label: 'الاسم',
                      controller: _nameController,
                      validator: (v) =>
                          v != null && v.trim().length >= 2 ? null : 'يرجى إدخال الاسم',
                    ),
                    const SizedBox(height: 12),
                    PremiumCard(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: DropdownButtonFormField<int?>(
                        initialValue: _birthYear,
                        decoration: InputDecoration(
                          labelText: 'سنة الميلاد (اختياري)',
                          labelStyle: AppTypography.labelSmall,
                          border: InputBorder.none,
                        ),
                        items: [
                          const DropdownMenuItem<int?>(
                            value: null,
                            child: Text('لم أحدد بعد'),
                          ),
                          ...List.generate(
                            DateTime.now().year - 1920 + 1,
                            (i) {
                              final year = DateTime.now().year - i;
                              return DropdownMenuItem<int?>(
                                value: year,
                                child: Text('$year'),
                              );
                            },
                          ),
                        ],
                        onChanged: updating
                            ? null
                            : (value) => setState(() => _birthYear = value),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'سنة الميلاد تُستخدم لمقارنة عمرك مع عمر بشرتك — وليست مطلوبة للتسجيل.',
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    PremiumCard(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          const Icon(Icons.phone_android_rounded, color: AppColors.primary),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('رقم الجوال', style: AppTypography.labelSmall),
                                Text(
                                  SaudiPhone.display(widget.profile.phone),
                                  style: AppTypography.titleMedium,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    PremiumCard(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          const Icon(Icons.verified_rounded, color: AppColors.gold),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('المستوى', style: AppTypography.labelSmall),
                                Text(level, style: AppTypography.titleMedium),
                                Text(
                                  'يُحسب تلقائياً من نقاطك — ${widget.profile.points} نقطة',
                                  style: AppTypography.bodySmall
                                      .copyWith(color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    PremiumButton(
                      label: 'حفظ التغييرات',
                      loading: updating,
                      onPressed: updating ? null : _save,
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
