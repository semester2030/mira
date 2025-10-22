import 'package:equatable/equatable.dart';
import '../../domain/entities/profile_entity.dart';

abstract class ProfileState extends Equatable {
  const ProfileState();

  @override
  List<Object?> get props => [];
}

class ProfileInitial extends ProfileState {
  const ProfileInitial();
}

class ProfileLoading extends ProfileState {
  const ProfileLoading();
}

class ProfileLoaded extends ProfileState {
  final ProfileEntity profile;
  
  const ProfileLoaded(this.profile);
  
  @override
  List<Object?> get props => [profile];
}

class ProfileError extends ProfileState {
  final String message;
  
  const ProfileError(this.message);
  
  @override
  List<Object?> get props => [message];
}

class ProfileUpdating extends ProfileState {
  final ProfileEntity profile;
  
  const ProfileUpdating(this.profile);
  
  @override
  List<Object?> get props => [profile];
}

class ProfileUpdated extends ProfileState {
  final ProfileEntity profile;
  
  const ProfileUpdated(this.profile);
  
  @override
  List<Object?> get props => [profile];
}

class PasswordChanging extends ProfileState {
  final ProfileEntity profile;
  
  const PasswordChanging(this.profile);
  
  @override
  List<Object?> get props => [profile];
}

class PasswordChanged extends ProfileState {
  final ProfileEntity profile;
  
  const PasswordChanged(this.profile);
  
  @override
  List<Object?> get props => [profile];
}

class LoggingOut extends ProfileState {
  const LoggingOut();
}

class LoggedOut extends ProfileState {
  const LoggedOut();
}
