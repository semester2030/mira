import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/profile_entity.dart';
import '../../domain/usecases/get_profile_usecase.dart';
import '../../domain/usecases/update_profile_usecase.dart';
import '../../domain/usecases/logout_usecase.dart';
import '../../data/repositories/profile_repository_impl.dart';
import '../../data/datasources/profile_remote_data_source.dart';
import '../blocs/profile_bloc.dart';
import '../blocs/profile_event.dart';

class ProfileService {
  static ProfileBloc createProfileBloc() {
    final repository = ProfileRepositoryImpl(ProfileRemoteDataSourceImpl());

    return ProfileBloc(
      getProfileUseCase: GetProfileUseCase(repository),
      updateProfileUseCase: UpdateProfileUseCase(repository),
      logoutUseCase: LogoutUseCase(repository),
    );
  }

  static void loadProfile(BuildContext context) {
    context.read<ProfileBloc>().add(const LoadProfile());
  }

  static void updateProfile(BuildContext context, ProfileEntity profile) {
    context.read<ProfileBloc>().add(UpdateProfile(profile));
  }

  static void logout(BuildContext context) {
    context.read<ProfileBloc>().add(const Logout());
  }

  static void updateAvatar(BuildContext context, String imagePath) {
    context.read<ProfileBloc>().add(UpdateAvatar(imagePath));
  }
}
