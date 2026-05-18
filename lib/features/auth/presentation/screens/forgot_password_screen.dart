import 'package:flutter/material.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/usecases/forgot_password_usecase.dart';
import '../../data/repositories/auth_repository_impl.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  late final ForgotPasswordUseCase _useCase;

  @override
  void initState() {
    super.initState();
    _useCase = ForgotPasswordUseCase(AuthRepositoryImpl());
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await _useCase.call(_emailController.text.trim());
      if (!mounted) return;
      setState(() {
        _loading = false;
        _sent = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('خطأ: ${e.toString()}'), backgroundColor: AppColors.error),
      );
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
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  const MirraLogo.medium(),
                  const SizedBox(height: 24),
                  Text('استعادة كلمة المرور', style: AppTypography.displaySmall),
                  const SizedBox(height: 32),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: _sent
                        ? PremiumCard(
                            key: const ValueKey('sent'),
                            child: Column(
                              children: [
                                const Icon(Icons.mark_email_read_outlined,
                                    size: 64, color: AppColors.success),
                                const SizedBox(height: 16),
                                Text(
                                  'تم إرسال رابط الاستعادة إلى بريدك الإلكتروني',
                                  style: AppTypography.bodyLarge,
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          )
                        : PremiumCard(
                            key: const ValueKey('form'),
                            glass: true,
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              children: [
                                PremiumInputField(
                                  label: 'البريد الإلكتروني',
                                  controller: _emailController,
                                  keyboardType: TextInputType.emailAddress,
                                  validator: (v) =>
                                      v != null && v.contains('@') ? null : 'أدخل بريدًا صحيحًا',
                                ),
                                const SizedBox(height: 24),
                                PremiumButton(
                                  label: 'إرسال رابط الاستعادة',
                                  loading: _loading,
                                  onPressed: _loading ? null : _submit,
                                ),
                              ],
                            ),
                          ),
                  ),
                  const SizedBox(height: 16),
                  PremiumButton(
                    label: 'العودة لتسجيل الدخول',
                    variant: PremiumButtonVariant.ghost,
                    onPressed: () => Navigator.pushReplacementNamed(context, AppRoutes.login),
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
