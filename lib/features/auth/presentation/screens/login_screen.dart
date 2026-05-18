import 'package:flutter/material.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../../core/services/guest_session_service.dart';
import '../../../../core/utils/firebase_error_message.dart';
import '../../domain/usecases/login_usecase.dart';
import '../../data/repositories/auth_repository_impl.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  late final LoginUseCase _loginUseCase;

  @override
  void initState() {
    super.initState();
    _loginUseCase = LoginUseCase(AuthRepositoryImpl());
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await _loginUseCase.call(
        _emailController.text.trim(),
        _passwordController.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('مرحبًا بك في ميرا ✨', style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary)),
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
      body: FloatingGradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 16),
                  const Center(child: MirraLogo.medium()),
                  const SizedBox(height: 12),
                  Text(
                    'مرحبًا بك',
                    style: AppTypography.displaySmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'مرآتك الذكية الخاصة',
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),
                  PremiumCard(
                    glass: true,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        PremiumInputField(
                          label: 'البريد الإلكتروني',
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          validator: (v) =>
                              v != null && v.contains('@') ? null : 'أدخل بريدًا صحيحًا',
                        ),
                        const SizedBox(height: 16),
                        PremiumInputField(
                          label: 'كلمة المرور',
                          controller: _passwordController,
                          obscureText: true,
                          textInputAction: TextInputAction.done,
                          validator: (v) =>
                              v != null && v.length >= 6 ? null : 'كلمة المرور قصيرة',
                        ),
                        const SizedBox(height: 8),
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: TextButton(
                            onPressed: () => Navigator.pushNamed(context, AppRoutes.forgot),
                            child: const Text('نسيت كلمة المرور؟'),
                          ),
                        ),
                        const SizedBox(height: 16),
                        PremiumButton(
                          label: 'دخول',
                          loading: _loading,
                          onPressed: _loading ? null : _handleLogin,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  PremiumButton(
                    label: 'إنشاء حساب جديد',
                    variant: PremiumButtonVariant.secondary,
                    onPressed: () => Navigator.pushNamed(context, AppRoutes.register),
                  ),
                  const SizedBox(height: 12),
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
