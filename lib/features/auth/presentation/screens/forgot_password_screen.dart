import 'package:flutter/material.dart';
import '../widgets/auth_text_field.dart';
import '../../../../shared/widgets/mirra_ui.dart';
import '../../../../shared/widgets/mirra_logo.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('استعادة كلمة المرور')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const MirraLogo.large(),
                const SizedBox(height: 32),
                if (_sent)
                  Column(
                    children: const [
                      Icon(Icons.check_circle, color: Colors.green, size: 64),
                      SizedBox(height: 16),
                      Text('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني', textAlign: TextAlign.center),
                      SizedBox(height: 24),
                    ],
                  ),
                if (!_sent) ...[
                  AuthTextField(
                    label: 'البريد الإلكتروني',
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    validator: (v) => v != null && v.contains('@') ? null : 'أدخل بريدًا صحيحًا',
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: PrimaryButton(
                      text: 'إرسال رابط الاستعادة',
                      loading: _loading,
                      onPressed: _loading
                          ? () {}
                          : () {
                              if (_formKey.currentState!.validate()) {
                                setState(() => _loading = true);
                                // TODO: تنفيذ إرسال رابط الاستعادة
                                Future.delayed(const Duration(seconds: 2), () {
                                  setState(() {
                                    _loading = false;
                                    _sent = true;
                                  });
                                });
                              }
                            },
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SecondaryButton(
                      text: 'العودة لتسجيل الدخول',
                      onPressed: () {
                        Navigator.pushReplacementNamed(context, '/login');
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
