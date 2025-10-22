import 'package:firebase_auth/firebase_auth.dart' as auth;
import '../../domain/repositories/auth_repository.dart';
import '../../domain/entities/user_entity.dart';

class AuthRepositoryImpl implements AuthRepository {
  final auth.FirebaseAuth _firebaseAuth = auth.FirebaseAuth.instance;

  UserEntity? _userFromFirebase(auth.User? user) {
    if (user == null) return null;
    return UserEntity(
      id: user.uid,
      name: user.displayName ?? '',
      email: user.email ?? '',
      avatarUrl: user.photoURL,
    );
  }

  @override
  auth.User? get currentUser => _firebaseAuth.currentUser;

  @override
  Future<UserEntity> login(String email, String password) async {
    try {
      final credential = await _firebaseAuth.signInWithEmailAndPassword(
        email: email, 
        password: password,
      );
      final user = credential.user;
      if (user == null) {
        throw Exception('فشل تسجيل الدخول');
      }
      return _userFromFirebase(user)!;
    } on auth.FirebaseAuthException catch (e) {
      // معالجة أخطاء Firebase المحددة
      String errorMessage = 'فشل تسجيل الدخول';
      if (e.code == 'user-not-found') {
        errorMessage = 'البريد الإلكتروني غير مسجل';
      } else if (e.code == 'wrong-password') {
        errorMessage = 'كلمة المرور غير صحيحة';
      } else if (e.code == 'invalid-email') {
        errorMessage = 'البريد الإلكتروني غير صحيح';
      } else if (e.code == 'user-disabled') {
        errorMessage = 'هذا الحساب معطل';
      } else if (e.message != null) {
        errorMessage = e.message!;
      }
      throw Exception(errorMessage);
    }
  }

  @override
  Future<UserEntity> register(String name, String email, String password) async {
    try {
      final credential = await _firebaseAuth.createUserWithEmailAndPassword(
        email: email, 
        password: password,
      );
      final user = credential.user;
      if (user == null) {
        throw Exception('فشل إنشاء الحساب');
      }
      await user.updateDisplayName(name);
      await user.reload();
      return _userFromFirebase(_firebaseAuth.currentUser)!;
    } on auth.FirebaseAuthException catch (e) {
      // معالجة أخطاء Firebase المحددة
      String errorMessage = 'فشل إنشاء الحساب';
      if (e.code == 'email-already-in-use') {
        errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
      } else if (e.code == 'weak-password') {
        errorMessage = 'كلمة المرور ضعيفة جداً';
      } else if (e.code == 'invalid-email') {
        errorMessage = 'البريد الإلكتروني غير صحيح';
      } else if (e.message != null) {
        errorMessage = e.message!;
      }
      throw Exception(errorMessage);
    }
  }

  @override
  Future<void> forgotPassword(String email) async {
    try {
      await _firebaseAuth.sendPasswordResetEmail(email: email);
    } on auth.FirebaseAuthException catch (e) {
      String errorMessage = 'فشل إرسال رابط الاستعادة';
      if (e.code == 'user-not-found') {
        errorMessage = 'البريد الإلكتروني غير مسجل';
      } else if (e.code == 'invalid-email') {
        errorMessage = 'البريد الإلكتروني غير صحيح';
      } else if (e.message != null) {
        errorMessage = e.message!;
      }
      throw Exception(errorMessage);
    }
  }

  @override
  Future<UserEntity?> getCurrentUser() async {
    return _userFromFirebase(_firebaseAuth.currentUser);
  }

  @override
  Future<void> logout() async {
    await _firebaseAuth.signOut();
  }
} 