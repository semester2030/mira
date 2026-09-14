import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../../../../core/entitlements/mira_runtime_entitlement_store.dart';
import '../../../../core/profile/user_level.dart';
import '../../domain/entities/profile_entity.dart';
import '../storage/avatar_storage_contract.dart';

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
    await _firestore
        .collection('users')
        .doc(user.uid)
        .set(data, SetOptions(merge: true));
    return updatedProfile;
  }

  @override
  Future<String> uploadAvatar(String imagePath) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('المستخدم غير مسجل الدخول');
    }

    final file = File(imagePath);
    final size = await file.length();
    if (size > AvatarStorageContract.maxBytes) {
      throw ArgumentError('Avatar image exceeds the 5 MiB limit');
    }
    final contentType = AvatarStorageContract.contentTypeForPath(imagePath);
    final ref = _storage.ref().child(
      AvatarStorageContract.objectPath(user.uid),
    );
    await ref.putFile(file, SettableMetadata(contentType: contentType));
    return await ref.getDownloadURL();
  }

  @override
  Future<void> logout() async {
    MiraRuntimeEntitlementStore.clear();
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
