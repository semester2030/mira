import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart' as auth;
import '../../../../core/services/guest_session_service.dart';
import '../../../../core/services/user_document_service.dart';
import '../../domain/entities/phone_otp_session.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  final auth.FirebaseAuth _firebaseAuth = auth.FirebaseAuth.instance;

  UserEntity? _userFromFirebase(auth.User user, {String? phoneOverride}) {
    return UserEntity(
      id: user.uid,
      name: user.displayName ?? '',
      phone: phoneOverride ?? user.phoneNumber ?? '',
      avatarUrl: user.photoURL,
    );
  }

  @override
  Future<PhoneOtpSession> sendPhoneOtp(String e164Phone) {
    return _verifyPhoneNumber(e164Phone, resendToken: null);
  }

  @override
  Future<PhoneOtpSession> resendPhoneOtp(PhoneOtpSession previous) {
    return _verifyPhoneNumber(
      previous.e164Phone,
      resendToken: previous.resendToken,
    );
  }

  Future<PhoneOtpSession> _verifyPhoneNumber(
    String e164Phone, {
    int? resendToken,
  }) {
    final completer = Completer<PhoneOtpSession>();

    _firebaseAuth.verifyPhoneNumber(
      phoneNumber: e164Phone,
      forceResendingToken: resendToken,
      timeout: const Duration(seconds: 120),
      verificationCompleted: (credential) {
        if (!completer.isCompleted) {
          completer.complete(
            PhoneOtpSession(
              e164Phone: e164Phone,
              autoCredential: credential,
            ),
          );
        }
      },
      verificationFailed: (e) {
        if (!completer.isCompleted) {
          completer.completeError(e);
        }
      },
      codeSent: (verificationId, newResendToken) {
        if (!completer.isCompleted) {
          completer.complete(
            PhoneOtpSession(
              e164Phone: e164Phone,
              verificationId: verificationId,
              resendToken: newResendToken,
            ),
          );
        }
      },
      codeAutoRetrievalTimeout: (_) {},
    );

    return completer.future;
  }

  @override
  Future<UserEntity> verifyPhoneOtp({
    required String name,
    required PhoneOtpSession session,
    required String smsCode,
  }) async {
    try {
      final auth.PhoneAuthCredential credential;
      if (session.autoCredential != null) {
        credential = session.autoCredential!;
      } else {
        if (session.verificationId == null) {
          throw Exception('انتهت صلاحية الجلسة — أعيدي إرسال الرمز');
        }
        final code = smsCode.trim();
        if (code.length < 6) {
          throw Exception('أدخلي رمز التحقق المكوّن من 6 أرقام');
        }
        credential = auth.PhoneAuthProvider.credential(
          verificationId: session.verificationId!,
          smsCode: code,
        );
      }

      final userCredential = await _firebaseAuth.signInWithCredential(credential);
      final user = userCredential.user;
      if (user == null) {
        throw Exception('فشل التحقق من الرمز');
      }

      final trimmedName = name.trim();
      final isNewUser = userCredential.additionalUserInfo?.isNewUser ?? false;

      if (trimmedName.isNotEmpty && (isNewUser || (user.displayName ?? '').isEmpty)) {
        await user.updateDisplayName(trimmedName);
      }
      await user.reload();
      final current = _firebaseAuth.currentUser!;

      await GuestSessionService.exit();
      await UserDocumentService.ensureUserDocument(
        user: current,
        displayName: trimmedName.isNotEmpty ? trimmedName : null,
        phoneE164: session.e164Phone,
        isNewUser: isNewUser,
      );

      return _userFromFirebase(current, phoneOverride: session.e164Phone)!;
    } on auth.FirebaseAuthException catch (e) {
      throw _mapPhoneAuthError(e);
    }
  }

  Exception _mapPhoneAuthError(auth.FirebaseAuthException e) {
    switch (e.code) {
      case 'invalid-verification-code':
        return Exception('رمز التحقق غير صحيح');
      case 'session-expired':
        return Exception('انتهت صلاحية الرمز — أعيدي الإرسال');
      case 'invalid-phone-number':
        return Exception('رقم الجوال غير صحيح');
      case 'too-many-requests':
        return Exception('محاولات كثيرة — انتظري قليلًا');
      case 'quota-exceeded':
        return Exception('تم تجاوز حد الرسائل — حاولي لاحقًا');
      default:
        return Exception(e.message ?? 'فشل التحقق من الرمز');
    }
  }

  @override
  Future<UserEntity?> getCurrentUser() async {
    final user = _firebaseAuth.currentUser;
    if (user == null) return null;
    return _userFromFirebase(user);
  }

  @override
  Future<void> logout() async {
    await GuestSessionService.exit();
    await _firebaseAuth.signOut();
  }
}
