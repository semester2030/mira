import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../../../../core/profile/user_level.dart';
import '../../domain/entities/profile_entity.dart';

abstract class ProfileRemoteDataSource {
  Future<ProfileEntity> getCurrentProfile();
  Future<ProfileEntity> updateProfile(ProfileEntity profile);
  Future<String> uploadAvatar(String imagePath);
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

    final updatedProfile = profile.copyWith(
      updatedAt: DateTime.now(),
      level: UserLevel.fromPoints(profile.points),
    );
    final data = updatedProfile.toJson()
      ..remove('id')
      ..['createdAt'] = Timestamp.fromDate(updatedProfile.createdAt)
      ..['updatedAt'] = Timestamp.fromDate(updatedProfile.updatedAt!);
    await _firestore.collection('users').doc(user.uid).set(data, SetOptions(merge: true));
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
      name: user.displayName ?? 'مستخدمة ميرا',
      phone: user.phoneNumber ?? '',
      avatarUrl: user.photoURL,
      level: UserLevel.fromPoints(0),
      points: 0,
      analyses: 0,
      tips: 0,
      lastActive: 'الآن',
      achievements: [],
      createdAt: DateTime.now(),
    );
  }
}
