import '../repositories/profile_repository.dart';

class ChangePasswordUseCase {
  final ProfileRepository repository;

  ChangePasswordUseCase(this.repository);

  Future<void> call(String currentPassword, String newPassword) {
    return repository.changePassword(currentPassword, newPassword);
  }
}
