import 'package:flutter/material.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../../core/services/guest_session_service.dart';
import '../../../../core/utils/firebase_error_message.dart';
import '../../domain/usecases/register_usecase.dart';
import '../../data/repositories/auth_repository_impl.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _loading = false;
  late final RegisterUseCase _registerUseCase;

  @override
  void initState() {
    super.initState();
    _registerUseCase = RegisterUseCase(AuthRepositoryImpl());
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await _registerUseCase.call(
        _nameController.text.trim(),
        _emailController.text.trim(),
        _passwordController.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تم إنشاء حسابك بنجاح ✨', style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary)),
          backgroundColor: AppColors.success,
        ),
      );
      Navigator.pushReplacementNamed(context, AppRoutes.dashboard);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyFirebaseError(e)), backgroundColor: AppColors.error),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_forward_ios_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  const MirraLogo.medium(),
                  const SizedBox(height: 16),
                  Text('انضمي إلى ميرا', style: AppTypography.displaySmall),
                  const SizedBox(height: 24),
                  PremiumCard(
                    glass: true,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        PremiumInputField(
                          label: 'الاسم الكامل',
                          controller: _nameController,
                          validator: (v) =>
                              v != null && v.trim().length >= 3 ? null : 'أدخل اسمًا صحيحًا',
                        ),
                        const SizedBox(height: 16),
                        PremiumInputField(
                          label: 'البريد الإلكتروني',
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          validator: (v) =>
                              v != null && v.contains('@') ? null : 'أدخل بريدًا صحيحًا',
                        ),
                        const SizedBox(height: 16),
                        PremiumInputField(
                          label: 'كلمة المرور',
                          controller: _passwordController,
                          obscureText: true,
                          validator: (v) =>
                              v != null && v.length >= 6 ? null : 'كلمة المرور قصيرة',
                        ),
                        const SizedBox(height: 16),
                        PremiumInputField(
                          label: 'تأكيد كلمة المرور',
                          controller: _confirmPasswordController,
                          obscureText: true,
                          validator: (v) => v == _passwordController.text
                              ? null
                              : 'كلمتا المرور غير متطابقتين',
                        ),
                        const SizedBox(height: 24),
                        PremiumButton(
                          label: 'تسجيل',
                          loading: _loading,
                          onPressed: _loading ? null : _handleRegister,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  PremiumButton(
                    label: 'لديك حساب؟ تسجيل الدخول',
                    variant: PremiumButtonVariant.ghost,
                    onPressed: () => Navigator.pushReplacementNamed(context, AppRoutes.login),
                  ),
                  const SizedBox(height: 8),
                  PremiumButton(
                    label: 'تصفّح كزائرة — بدون تسجيل',
                    variant: PremiumButtonVariant.ghost,
                    icon: Icons.visibility_outlined,
                    onPressed: () async {
                      await GuestSessionService.enter();
                      if (!context.mounted) return;
                      Navigator.pushReplacementNamed(context, AppRoutes.dashboard);
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
