import '../entities/phone_otp_session.dart';
import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class VerifyPhoneOtpUseCase {
  final AuthRepository repository;

  VerifyPhoneOtpUseCase(this.repository);

  Future<UserEntity> call({
    required String name,
    required PhoneOtpSession session,
    required String smsCode,
  }) {
    return repository.verifyPhoneOtp(
      name: name,
      session: session,
      smsCode: smsCode,
    );
  }
}
