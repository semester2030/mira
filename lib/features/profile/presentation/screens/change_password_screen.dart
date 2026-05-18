import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../blocs/profile_bloc.dart';
import '../blocs/profile_event.dart';
import '../blocs/profile_state.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    context.read<ProfileBloc>().add(ChangePassword(
          currentPassword: _currentController.text,
          newPassword: _newController.text,
        ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تغيير كلمة المرور')),
      body: BlocListener<ProfileBloc, ProfileState>(
        listener: (context, state) {
          if (state is PasswordChanged) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('تم تغيير كلمة المرور بنجاح')),
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
                  PremiumInputField(
                    label: 'كلمة المرور الحالية',
                    controller: _currentController,
                    obscureText: true,
                    validator: (v) => v == null || v.isEmpty ? 'مطلوبة' : null,
                  ),
                  const SizedBox(height: 12),
                  PremiumInputField(
                    label: 'كلمة المرور الجديدة',
                    controller: _newController,
                    obscureText: true,
                    validator: (v) {
                      if (v == null || v.length < 6) return '6 أحرف على الأقل';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  PremiumInputField(
                    label: 'تأكيد كلمة المرور',
                    controller: _confirmController,
                    obscureText: true,
                    validator: (v) => v != _newController.text ? 'غير متطابقة' : null,
                  ),
                  const SizedBox(height: 24),
                  BlocBuilder<ProfileBloc, ProfileState>(
                    builder: (context, state) {
                      return PremiumButton(
                        label: 'تغيير كلمة المرور',
                        loading: state is PasswordChanging,
                        onPressed: state is PasswordChanging ? null : _submit,
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
