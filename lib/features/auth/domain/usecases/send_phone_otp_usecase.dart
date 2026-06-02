import '../entities/phone_otp_session.dart';
import '../repositories/auth_repository.dart';

class SendPhoneOtpUseCase {
  final AuthRepository repository;

  SendPhoneOtpUseCase(this.repository);

  Future<PhoneOtpSession> call(String e164Phone) {
    return repository.sendPhoneOtp(e164Phone);
  }
}
