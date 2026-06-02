import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/profile_entity.dart';
import '../../domain/usecases/get_profile_usecase.dart';
import '../../domain/usecases/update_profile_usecase.dart';
import '../../domain/usecases/logout_usecase.dart';
import 'profile_event.dart';
import 'profile_state.dart';

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final GetProfileUseCase getProfileUseCase;
  final UpdateProfileUseCase updateProfileUseCase;
  final LogoutUseCase logoutUseCase;

  ProfileBloc({
    required this.getProfileUseCase,
    required this.updateProfileUseCase,
    required this.logoutUseCase,
  }) : super(const ProfileInitial()) {
    on<LoadProfile>(_onLoadProfile);
    on<UpdateProfile>(_onUpdateProfile);
    on<UpdateAvatar>(_onUpdateAvatar);
    on<Logout>(_onLogout);
  }

  ProfileEntity? _profileFromState(ProfileState s) {
    if (s is ProfileLoaded) return s.profile;
    if (s is ProfileUpdated) return s.profile;
    if (s is ProfileUpdating) return s.profile;
    return null;
  }

  Future<void> _onLoadProfile(LoadProfile event, Emitter<ProfileState> emit) async {
    try {
      emit(const ProfileLoading());
      final profile = await getProfileUseCase();
      emit(ProfileLoaded(profile));
    } catch (e) {
      emit(ProfileError('فشل في تحميل الملف الشخصي: ${e.toString()}'));
    }
  }

  Future<void> _onUpdateProfile(UpdateProfile event, Emitter<ProfileState> emit) async {
    try {
      emit(ProfileUpdating(event.profile));
      final updatedProfile = await updateProfileUseCase(event.profile);
      emit(ProfileUpdated(updatedProfile));
      emit(ProfileLoaded(updatedProfile));
    } catch (e) {
      emit(ProfileError('فشل في تحديث الملف الشخصي: ${e.toString()}'));
    }
  }

  Future<void> _onUpdateAvatar(UpdateAvatar event, Emitter<ProfileState> emit) async {
    final current = _profileFromState(state);
    if (current == null) return;

    try {
      emit(ProfileUpdating(current));
      final repository = getProfileUseCase.repository;
      await repository.updateAvatar(event.imagePath);
      final updatedProfile = await getProfileUseCase();
      emit(ProfileUpdated(updatedProfile));
      emit(ProfileLoaded(updatedProfile));
    } catch (e) {
      emit(ProfileError('فشل في تحديث الصورة الشخصية: ${e.toString()}'));
    }
  }

  Future<void> _onLogout(Logout event, Emitter<ProfileState> emit) async {
    try {
      emit(const LoggingOut());
      await logoutUseCase();
      emit(const LoggedOut());
    } catch (e) {
      emit(ProfileError('فشل في تسجيل الخروج: ${e.toString()}'));
    }
  }
}
