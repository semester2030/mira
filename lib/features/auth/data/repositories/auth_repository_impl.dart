import 'package:firebase_auth/firebase_auth.dart' as auth;
import '../../../../core/services/guest_session_service.dart';
import '../../../../core/services/user_document_service.dart';
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
      await GuestSessionService.exit();
      await UserDocumentService.ensureUserDocument(user: user);
      return _userFromFirebase(user)!;
    } on auth.FirebaseAuthException catch (e) {
      String errorMessage = 'فشل تسجيل الدخول';
      if (e.code == 'user-not-found') {
        errorMessage = 'البريد الإلكتروني غير مسجل';
      } else if (e.code == 'wrong-password' || e.code == 'invalid-credential') {
        errorMessage = 'كلمة المرور غير صحيحة';
      } else if (e.code == 'invalid-email') {
        errorMessage = 'البريد الإلكتروني غير صحيح';
      } else if (e.code == 'user-disabled') {
        errorMessage = 'هذا الحساب معطل';
      } else if (e.message != null) {
        errorMessage = e.message!;
      }
      throw Exception(errorMessage);
    } catch (_) {
      final user = _firebaseAuth.currentUser;
      if (user != null) {
        await GuestSessionService.exit();
        return _userFromFirebase(user)!;
      }
      rethrow;
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
      final current = _firebaseAuth.currentUser!;
      await GuestSessionService.exit();
      await UserDocumentService.ensureUserDocument(user: current, displayName: name);
      return _userFromFirebase(current)!;
    } on auth.FirebaseAuthException catch (e) {
      String errorMessage = 'فشل إنشاء الحساب';
      if (e.code == 'email-already-in-use') {
        errorMessage = 'البريد الإلكتروني مستخدم بالفعل — جرّبي تسجيل الدخول';
      } else if (e.code == 'weak-password') {
        errorMessage = 'كلمة المرور ضعيفة جداً';
      } else if (e.code == 'invalid-email') {
        errorMessage = 'البريد الإلكتروني غير صحيح';
      } else if (e.message != null) {
        errorMessage = e.message!;
      }
      throw Exception(errorMessage);
    } catch (_) {
      final user = _firebaseAuth.currentUser;
      if (user != null) {
        await GuestSessionService.exit();
        return _userFromFirebase(user)!;
      }
      rethrow;
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
    await GuestSessionService.exit();
    await _firebaseAuth.signOut();
  }
}
