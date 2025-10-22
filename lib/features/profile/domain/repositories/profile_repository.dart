import '../entities/profile_entity.dart';

abstract class ProfileRepository {
  Future<ProfileEntity> getCurrentProfile();
  Future<ProfileEntity> updateProfile(ProfileEntity profile);
  Future<void> updateAvatar(String imagePath);
  Future<void> changePassword(String currentPassword, String newPassword);
  Future<void> logout();
  Stream<ProfileEntity> getProfileStream();
}
