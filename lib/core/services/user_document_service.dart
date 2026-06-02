import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../profile/user_level.dart';

/// Result of syncing the Firestore user profile after Auth sign-in/up.
enum UserDocumentSyncResult { created, updated, skippedPermissionDenied, failed }

/// Ensures Firestore user profile exists after phone sign-in/up.
class UserDocumentService {
  UserDocumentService._();

  static final _firestore = FirebaseFirestore.instance;

  /// Never throws [FirebaseException] for permission-denied — Auth already succeeded.
  static Future<UserDocumentSyncResult> ensureUserDocument({
    required User user,
    String? displayName,
    String? phoneE164,
    bool isNewUser = false,
  }) async {
    try {
      final doc = _firestore.collection('users').doc(user.uid);
      final snap = await doc.get();
      final phone = phoneE164 ?? user.phoneNumber ?? '';

      if (snap.exists) {
        final updates = <String, dynamic>{
          'lastActive': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        };
        if (phone.isNotEmpty) updates['phone'] = phone;
        if (isNewUser && displayName != null && displayName.isNotEmpty) {
          updates['name'] = displayName;
        }
        await doc.set(updates, SetOptions(merge: true));
        return UserDocumentSyncResult.updated;
      }

      await doc.set({
        'id': user.uid,
        'name': displayName ?? user.displayName ?? 'مستخدمة ميرا',
        'phone': phone,
        'avatarUrl': user.photoURL,
        'level': UserLevel.fromPoints(0),
        'points': 0,
        'analyses': 0,
        'tips': 0,
        'lastActive': FieldValue.serverTimestamp(),
        'achievements': <Map<String, dynamic>>[],
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return UserDocumentSyncResult.created;
    } on FirebaseException catch (e) {
      if (e.code == 'permission-denied') {
        return UserDocumentSyncResult.skippedPermissionDenied;
      }
      rethrow;
    }
  }
}
