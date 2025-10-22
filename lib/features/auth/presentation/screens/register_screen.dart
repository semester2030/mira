import 'package:flutter/material.dart';
import '../widgets/auth_text_field.dart';
import '../../../../shared/widgets/mirra_ui.dart';
import '../../../../shared/widgets/mirra_logo.dart';
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

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);
    
    try {
      await _registerUseCase.call(
        _nameController.text.trim(),
        _emailController.text.trim(),
        _passwordController.text,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('تم إنشاء الحساب بنجاح! ✅'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('خطأ: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('إنشاء حساب جديد')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 32),
            const Center(child: MirraLogo.large()),
            const SizedBox(height: 32),
            Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AuthTextField(
                    label: 'الاسم الكامل',
                    controller: _nameController,
                    validator: (v) => v != null && v.trim().length >= 3 ? null : 'أدخل اسمًا صحيحًا',
                  ),
                  const SizedBox(height: 16),
                  AuthTextField(
                    label: 'البريد الإلكتروني',
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    validator: (v) => v != null && v.contains('@') ? null : 'أدخل بريدًا صحيحًا',
                  ),
                  const SizedBox(height: 16),
                  AuthTextField(
                    label: 'كلمة المرور',
                    controller: _passwordController,
                    isPassword: true,
                    validator: (v) => v != null && v.length >= 6 ? null : 'كلمة المرور قصيرة',
                  ),
                  const SizedBox(height: 16),
                  AuthTextField(
                    label: 'تأكيد كلمة المرور',
                    controller: _confirmPasswordController,
                    isPassword: true,
                    validator: (v) => v == _passwordController.text ? null : 'كلمتا المرور غير متطابقتين',
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: PrimaryButton(
                      text: 'تسجيل',
                      loading: _loading,
                      onPressed: _loading ? () {} : _handleRegister,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SecondaryButton(
                        text: 'لديك حساب؟ تسجيل الدخول',
                        onPressed: () {
                          Navigator.pushReplacementNamed(context, '/login');
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
