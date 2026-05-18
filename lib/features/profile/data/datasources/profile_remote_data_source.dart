import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../../domain/entities/profile_entity.dart';

abstract class ProfileRemoteDataSource {
  Future<ProfileEntity> getCurrentProfile();
  Future<ProfileEntity> updateProfile(ProfileEntity profile);
  Future<String> uploadAvatar(String imagePath);
  Future<void> changePassword(String currentPassword, String newPassword);
  Future<void> logout();
  Stream<ProfileEntity> getProfileStream();
}

class ProfileRemoteDataSourceImpl implements ProfileRemoteDataSource {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;

  @override
  Future<ProfileEntity> getCurrentProfile() async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('المستخدم غير مسجل الدخول');
    }

    final doc = await _firestore.collection('users').doc(user.uid).get();
    if (!doc.exists) {
      // إنشاء ملف شخصي افتراضي إذا لم يكن موجود
      return _createDefaultProfile(user);
    }

    return ProfileEntity.fromJson({...doc.data()!, 'id': user.uid});
  }

  @override
  Future<ProfileEntity> updateProfile(ProfileEntity profile) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('المستخدم غير مسجل الدخول');
    }

    final updatedProfile = profile.copyWith(updatedAt: DateTime.now());
    await _firestore.collection('users').doc(user.uid).set(updatedProfile.toJson());
    return updatedProfile;
  }

  @override
  Future<String> uploadAvatar(String imagePath) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('المستخدم غير مسجل الدخول');
    }

    final ref = _storage.ref().child('avatars/${user.uid}.jpg');
    await ref.putFile(File(imagePath));
    return await ref.getDownloadURL();
  }

  @override
  Future<void> changePassword(String currentPassword, String newPassword) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('المستخدم غير مسجل الدخول');
    }

    // إعادة المصادقة قبل تغيير كلمة المرور
    final credential = EmailAuthProvider.credential(
      email: user.email!,
      password: currentPassword,
    );
    await user.reauthenticateWithCredential(credential);
    
    await user.updatePassword(newPassword);
  }

  @override
  Future<void> logout() async {
    await _auth.signOut();
  }

  @override
  Stream<ProfileEntity> getProfileStream() {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('المستخدم غير مسجل الدخول');
    }

    return _firestore.collection('users').doc(user.uid).snapshots().map((doc) {
      if (!doc.exists) {
        return _createDefaultProfile(user);
      }
      return ProfileEntity.fromJson({...doc.data()!, 'id': user.uid});
    });
  }

  ProfileEntity _createDefaultProfile(User user) {
    return ProfileEntity(
      id: user.uid,
      name: user.displayName ?? 'مستخدم جديد',
      email: user.email ?? '',
      phone: user.phoneNumber,
      avatarUrl: user.photoURL,
      level: 'مبتدئة',
      points: 0,
      analyses: 0,
      tips: 0,
      lastActive: 'الآن',
      achievements: [],
      createdAt: DateTime.now(),
    );
  }
}
