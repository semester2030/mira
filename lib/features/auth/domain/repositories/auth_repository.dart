import '../entities/user_entity.dart';

abstract class AuthRepository {
  Future<UserEntity> login(String email, String password);
  Future<UserEntity> register(String name, String email, String password);
  Future<void> forgotPassword(String email);
  Future<UserEntity?> getCurrentUser();
  Future<void> logout();
} 