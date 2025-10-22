import '../../domain/entities/profile_entity.dart';
import '../../domain/repositories/profile_repository.dart';
import '../datasources/profile_remote_data_source.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  final ProfileRemoteDataSource remoteDataSource;

  ProfileRepositoryImpl(this.remoteDataSource);

  @override
  Future<ProfileEntity> getCurrentProfile() {
    return remoteDataSource.getCurrentProfile();
  }

  @override
  Future<ProfileEntity> updateProfile(ProfileEntity profile) {
    return remoteDataSource.updateProfile(profile);
  }

  @override
  Future<void> updateAvatar(String imagePath) async {
    final avatarUrl = await remoteDataSource.uploadAvatar(imagePath);
    final currentProfile = await getCurrentProfile();
    final updatedProfile = currentProfile.copyWith(avatarUrl: avatarUrl);
    await remoteDataSource.updateProfile(updatedProfile);
  }

  @override
  Future<void> changePassword(String currentPassword, String newPassword) {
    return remoteDataSource.changePassword(currentPassword, newPassword);
  }

  @override
  Future<void> logout() {
    return remoteDataSource.logout();
  }

  @override
  Stream<ProfileEntity> getProfileStream() {
    return remoteDataSource.getProfileStream();
  }
}
