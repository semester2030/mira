import 'package:firebase_auth/firebase_auth.dart';

/// Result of [AuthRepository.sendPhoneOtp] — manual OTP or instant verify (Android).
class PhoneOtpSession {
  final String e164Phone;
  final String? verificationId;
  final int? resendToken;
  final PhoneAuthCredential? autoCredential;

  const PhoneOtpSession({
    required this.e164Phone,
    this.verificationId,
    this.resendToken,
    this.autoCredential,
  });

  bool get isAutoVerified => autoCredential != null;

  bool get needsManualCode => verificationId != null && autoCredential == null;
}
