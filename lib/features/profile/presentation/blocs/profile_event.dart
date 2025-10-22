import 'package:equatable/equatable.dart';
import '../../domain/entities/profile_entity.dart';

abstract class ProfileEvent extends Equatable {
  const ProfileEvent();

  @override
  List<Object?> get props => [];
}

class LoadProfile extends ProfileEvent {
  const LoadProfile();
}

class UpdateProfile extends ProfileEvent {
  final ProfileEntity profile;
  
  const UpdateProfile(this.profile);
  
  @override
  List<Object?> get props => [profile];
}

class UpdateAvatar extends ProfileEvent {
  final String imagePath;
  
  const UpdateAvatar(this.imagePath);
  
  @override
  List<Object?> get props => [imagePath];
}

class ChangePassword extends ProfileEvent {
  final String currentPassword;
  final String newPassword;
  
  const ChangePassword({
    required this.currentPassword,
    required this.newPassword,
  });
  
  @override
  List<Object?> get props => [currentPassword, newPassword];
}

class Logout extends ProfileEvent {
  const Logout();
}
