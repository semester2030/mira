import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/utils/firebase_error_message.dart';
import '../../../../core/utils/saudi_phone.dart';
import '../../../../core/services/guest_session_service.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../../shared/widgets/guest_mode_icon.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/phone_otp_session.dart';
import '../../domain/usecases/resend_phone_otp_usecase.dart';
import '../../domain/usecases/send_phone_otp_usecase.dart';
import '../../domain/usecases/verify_phone_otp_usecase.dart';

/// Unified sign-in / sign-up: name + Saudi phone + SMS OTP only.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();

  late final SendPhoneOtpUseCase _sendOtp;
  late final VerifyPhoneOtpUseCase _verifyOtp;
  late final ResendPhoneOtpUseCase _resendOtp;

  bool _loading = false;
  bool _otpStep = false;
  PhoneOtpSession? _session;
  int _resendSeconds = 0;
  Timer? _resendTimer;

  @override
  void initState() {
    super.initState();
    final repo = AuthRepositoryImpl();
    _sendOtp = SendPhoneOtpUseCase(repo);
    _verifyOtp = VerifyPhoneOtpUseCase(repo);
    _resendOtp = ResendPhoneOtpUseCase(repo);
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    _nameController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  void _startResendCooldown() {
    _resendTimer?.cancel();
    setState(() => _resendSeconds = 60);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_resendSeconds <= 1) {
        t.cancel();
        setState(() => _resendSeconds = 0);
      } else {
        setState(() => _resendSeconds--);
      }
    });
  }

  Future<void> _sendCode() async {
    if (!_formKey.currentState!.validate()) return;

    final e164 = SaudiPhone.toE164(_phoneController.text.trim());
    if (e164 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('رقم الجوال غير صحيح'), backgroundColor: AppColors.error),
      );
      return;
    }

    setState(() => _loading = true);
    try {
      final session = await _sendOtp(e164);
      if (!mounted) return;

      if (session.isAutoVerified) {
        await _completeAuth(session);
        return;
      }

      setState(() {
        _session = session;
        _otpStep = true;
        _otpController.clear();
      });
      _startResendCooldown();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'تم طلب الرمز — انتظري حتى 60 ثانية. '
            'إن ظهرت نافذة تحقق من Google، أكمليها ثم انتظري الرسالة.',
          ),
          duration: Duration(seconds: 6),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyFirebaseError(e)), backgroundColor: AppColors.error),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyCode() async {
    final session = _session;
    if (session == null) return;
    if (_otpController.text.trim().length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('أدخلي رمز التحقق (6 أرقام)'), backgroundColor: AppColors.error),
      );
      return;
    }

    setState(() => _loading = true);
    try {
      await _completeAuth(session, smsCode: _otpController.text.trim());
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyFirebaseError(e)), backgroundColor: AppColors.error),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _completeAuth(PhoneOtpSession session, {String smsCode = ''}) async {
    await _verifyOtp(
      name: _nameController.text.trim(),
      session: session,
      smsCode: smsCode,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'مرحبًا بك في ميرا ✨',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
        ),
        backgroundColor: AppColors.success,
      ),
    );
    Navigator.pushReplacementNamed(context, AppRoutes.dashboard);
  }

  Future<void> _resendCode() async {
    final session = _session;
    if (session == null || _resendSeconds > 0) return;

    setState(() => _loading = true);
    try {
      final newSession = await _resendOtp(session);
      if (!mounted) return;
      setState(() => _session = newSession);
      _otpController.clear();
      _startResendCooldown();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم إرسال رمز جديد')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyFirebaseError(e)), backgroundColor: AppColors.error),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _backToPhoneStep() {
    setState(() {
      _otpStep = false;
      _session = null;
      _otpController.clear();
    });
    _resendTimer?.cancel();
    setState(() => _resendSeconds = 0);
  }

  @override
  Widget build(BuildContext context) {
    final e164 = SaudiPhone.toE164(_phoneController.text.trim());
    final phoneDisplay = e164 != null ? SaudiPhone.display(e164) : _phoneController.text.trim();

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
                  const SizedBox(height: 8),
                  const Center(child: MirraLogo.auth()),
                  const SizedBox(height: 12),
                  Text(
                    _otpStep ? 'رمز التحقق' : 'تسجيل الدخول',
                    style: AppTypography.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _otpStep
                        ? 'أُرسل رمز إلى $phoneDisplay'
                        : 'الاسم ورقم الجوال — حساب جديد أو دخول بنفس الخطوات',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  PremiumCard(
                    glass: true,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        if (!_otpStep) ...[
                          PremiumInputField(
                            label: 'الاسم',
                            controller: _nameController,
                            textInputAction: TextInputAction.next,
                            validator: (v) =>
                                v != null && v.trim().length >= 2 ? null : 'أدخلي اسمك',
                          ),
                          const SizedBox(height: 16),
                          PremiumInputField(
                            label: 'رقم الجوال',
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            textInputAction: TextInputAction.done,
                            hint: '05xxxxxxxx',
                            inputFormatters: [
                              FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s\-]')),
                              LengthLimitingTextInputFormatter(14),
                            ],
                            validator: (v) => SaudiPhone.validateMessage(v ?? ''),
                          ),
                          const SizedBox(height: 24),
                          PremiumButton(
                            label: 'إرسال رمز التحقق',
                            loading: _loading,
                            onPressed: _loading ? null : _sendCode,
                          ),
                        ] else ...[
                          PremiumInputField(
                            label: 'رمز التحقق (6 أرقام)',
                            controller: _otpController,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.done,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(6),
                            ],
                            validator: (v) =>
                                v != null && v.length == 6 ? null : 'أدخلي 6 أرقام',
                          ),
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              TextButton(
                                onPressed: _backToPhoneStep,
                                child: const Text('تغيير الرقم'),
                              ),
                              TextButton(
                                onPressed: _resendSeconds > 0 || _loading ? null : _resendCode,
                                child: Text(
                                  _resendSeconds > 0
                                      ? 'إعادة الإرسال ($_resendSeconds)'
                                      : 'إعادة إرسال الرمز',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          PremiumButton(
                            label: 'تأكيد والدخول',
                            loading: _loading,
                            onPressed: _loading ? null : _verifyCode,
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (!_otpStep) ...[
                    const SizedBox(height: 16),
                    PremiumButton(
                      label: 'تصفّح كزائرة — بدون تسجيل',
                      variant: PremiumButtonVariant.ghost,
                      leading: const GuestModeIcon(size: 22),
                      onPressed: () async {
                        await GuestSessionService.enter();
                        if (!context.mounted) return;
                        Navigator.pushReplacementNamed(context, AppRoutes.dashboard);
                      },
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
