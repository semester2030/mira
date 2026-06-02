import '../entities/phone_otp_session.dart';
import '../entities/user_entity.dart';

abstract class AuthRepository {
  /// Sends SMS OTP via Firebase Auth. Same flow for sign-up and sign-in.
  Future<PhoneOtpSession> sendPhoneOtp(String e164Phone);

  /// Resends OTP using Firebase resend token when available.
  Future<PhoneOtpSession> resendPhoneOtp(PhoneOtpSession previous);

  /// Verifies OTP (or auto-credential) and syncs Firestore profile.
  Future<UserEntity> verifyPhoneOtp({
    required String name,
    required PhoneOtpSession session,
    required String smsCode,
  });

  Future<UserEntity?> getCurrentUser();

  Future<void> logout();
}
