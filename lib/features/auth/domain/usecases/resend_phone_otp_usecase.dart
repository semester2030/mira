import '../entities/phone_otp_session.dart';
import '../repositories/auth_repository.dart';

class ResendPhoneOtpUseCase {
  final AuthRepository repository;

  ResendPhoneOtpUseCase(this.repository);

  Future<PhoneOtpSession> call(PhoneOtpSession previous) {
    return repository.resendPhoneOtp(previous);
  }
}
