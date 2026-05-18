import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../shared/theme/colors.dart';
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
  late final TextEditingController _emailController;
  late final TextEditingController _phoneController;
  late final TextEditingController _levelController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.profile.name);
    _emailController = TextEditingController(text: widget.profile.email);
    _phoneController = TextEditingController(text: widget.profile.phone ?? '');
    _levelController = TextEditingController(text: widget.profile.level);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _levelController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null || !mounted) return;
    context.read<ProfileBloc>().add(UpdateAvatar(file.path));
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    final updated = widget.profile.copyWith(
      name: _nameController.text,
      email: _emailController.text,
      phone: _phoneController.text,
      level: _levelController.text,
    );
    context.read<ProfileBloc>().add(UpdateProfile(updated));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تعديل الملف الشخصي')),
      body: BlocListener<ProfileBloc, ProfileState>(
        listener: (context, state) {
          if (state is ProfileUpdated) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('تم تحديث الملف الشخصي بنجاح')),
            );
            Navigator.pop(context);
          } else if (state is ProfileError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.message)));
          }
        },
        child: FloatingGradientBackground(
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
                          onTap: _pickImage,
                          child: CircleAvatar(
                            radius: 48,
                            backgroundImage: widget.profile.avatarUrl != null
                                ? NetworkImage(widget.profile.avatarUrl!)
                                : null,
                            backgroundColor: AppColors.primaryLight,
                            child: widget.profile.avatarUrl == null
                                ? const Icon(Icons.person_rounded, size: 48, color: AppColors.primary)
                                : null,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: _pickImage,
                          child: const Text('تغيير الصورة'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  PremiumInputField(
                    label: 'الاسم',
                    controller: _nameController,
                    validator: (v) => v == null || v.isEmpty ? 'يرجى إدخال الاسم' : null,
                  ),
                  const SizedBox(height: 12),
                  PremiumInputField(
                    label: 'البريد الإلكتروني',
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'يرجى إدخال البريد';
                      if (!v.contains('@')) return 'بريد غير صحيح';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  PremiumInputField(label: 'رقم الهاتف', controller: _phoneController),
                  const SizedBox(height: 12),
                  PremiumInputField(label: 'المستوى', controller: _levelController),
                  const SizedBox(height: 24),
                  BlocBuilder<ProfileBloc, ProfileState>(
                    builder: (context, state) {
                      return PremiumButton(
                        label: 'حفظ التغييرات',
                        loading: state is ProfileUpdating,
                        onPressed: state is ProfileUpdating ? null : _save,
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
