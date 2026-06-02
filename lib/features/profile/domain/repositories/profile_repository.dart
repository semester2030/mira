import '../entities/profile_entity.dart';

abstract class ProfileRepository {
  Future<ProfileEntity> getCurrentProfile();
  Future<ProfileEntity> updateProfile(ProfileEntity profile);
  Future<void> updateAvatar(String imagePath);
  Future<void> logout();
  Stream<ProfileEntity> getProfileStream();
}
