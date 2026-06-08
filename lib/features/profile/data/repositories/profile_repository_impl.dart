import '../../../../core/config/mira_api_config.dart';
import '../../domain/entities/profile_entity.dart';
import '../../domain/repositories/profile_repository.dart';
import '../datasources/profile_remote_data_source.dart';
import '../datasources/user_api_data_source.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  final ProfileRemoteDataSource remoteDataSource;
  final UserApiDataSource? _userApi;

  ProfileRepositoryImpl(
    this.remoteDataSource, {
    UserApiDataSource? userApi,
  }) : _userApi = MiraApiConfig.useBackend ? (userApi ?? UserApiDataSource()) : null;

  @override
  Future<ProfileEntity> getCurrentProfile() async {
    final profile = await remoteDataSource.getCurrentProfile();
    if (_userApi == null) return profile;

    try {
      final prefs = await _userApi.getPreferences();
      return profile.copyWith(birthYear: prefs.birthYear);
    } catch (_) {
      // Firestore profile remains source when API unavailable.
    }
    return profile;
  }

  @override
  Future<ProfileEntity> updateProfile(ProfileEntity profile) async {
    final updated = await remoteDataSource.updateProfile(profile);

    if (_userApi != null) {
      try {
        await _userApi.updatePreferences(birthYear: profile.birthYear);
      } catch (_) {
        // Local profile saved; API sync best-effort.
      }
    }

    return updated;
  }

  @override
  Future<void> updateAvatar(String imagePath) async {
    final avatarUrl = await remoteDataSource.uploadAvatar(imagePath);
    final currentProfile = await getCurrentProfile();
    final updatedProfile = currentProfile.copyWith(avatarUrl: avatarUrl);
    await remoteDataSource.updateProfile(updatedProfile);
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
